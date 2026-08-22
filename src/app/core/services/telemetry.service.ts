import { inject, Injectable } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { safePath } from '../../shared/util/safe-path';

/**
 * Thu thap loi phia trinh duyet roi gui ve /api/telemetry/client.
 *
 * NGUYEN TAC SO MOT — duong ghi loi khong duoc tu sinh ra loi.
 * Moi thu trong file nay boc trong try/catch va nuot im. Neu viec bao loi lai
 * nem loi thi ErrorHandler bat duoc, lai goi bao loi, lai nem... => vong lap
 * chet lam treo trinh duyet cua nguoi dung. Tha mat mot su kien con hon.
 */

/** Toi da su kien gui mot lo (khop MAX_EVENTS_PER_BATCH ben server). */
const BATCH_MAX = 10;
/** Cho toi da bao lau truoc khi day hang doi di (ms). */
const FLUSH_MS = 5000;
/** Tran su kien MOT PHIEN — chan bao loi khi mot loi lap vo han trong vong lap render. */
const SESSION_CAP = 30;
/** Vong dem breadcrumb. */
const CRUMB_MAX = 20;
/** Tran luot xem cho trong mot lo. */
const PV_MAX = 20;
/** Hang doi du phong trong localStorage khi API chet. */
const LS_KEY = 'avp.telemetry.q';
const LS_MAX = 50;
const LS_TTL_MS = 24 * 3600 * 1000;
/** Rage click: bam >= ngan nay lan vao cung mot phan tu trong cua so nay. */
const RAGE_N = 5;
const RAGE_MS = 2000;
/** Dead click: bam roi trong ngan nay ma khong doi route, khong goi API, DOM khong doi. */
const DEAD_MS = 1200;

export interface Crumb {
  t: number;
  type: 'nav' | 'api' | 'click';
  text: string;
}

export interface TelemetryEvent {
  kind: string;
  message: string;
  stack?: string;
  route?: string;
  url?: string;
  status?: number;
  requestId?: string;
  breadcrumbs?: Crumb[];
  build?: string;
}

@Injectable({ providedIn: 'root' })
export class TelemetryService {
  private readonly router = inject(Router);

  /** Tat tu server qua /api/me. Mac dinh BAT — thieu co thi van thu thap. */
  private enabled = true;
  /** Dang gui: moi loi phat sinh trong luc nay bi bo hoan toan (chong vong lap). */
  private sending = false;

  private queue: TelemetryEvent[] = [];
  /** Luot xem trang di GHEP vao cung lo voi loi — khong tao request rieng. */
  private pageviews: string[] = [];
  private crumbs: Crumb[] = [];
  private seen = new Set<string>();
  private sentCount = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  private buildId = '';
  private lastRequestId = '';

  private clickKey = '';
  private clickTimes: number[] = [];
  private lastApiAt = 0;
  private lastNavAt = 0;

  private started = false;

  /** Goi mot lan luc khoi dong app (app.config.ts). */
  init(): void {
    if (this.started) return;
    this.started = true;
    try {
      this.router.events.subscribe((e) => {
        if (e instanceof NavigationEnd) {
          this.lastNavAt = Date.now();
          const path = safePath(e.urlAfterRedirects);
          this.crumb('nav', path);
          if (this.enabled && this.pageviews.length < PV_MAX) {
            this.pageviews.push(path);
            this.schedule();
          }
        }
      });
      document.addEventListener('click', (ev) => this.onClick(ev), { capture: true, passive: true });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') this.flush(true);
      });
      this.drainStored();
      void this.loadBuildId();
    } catch {
      // Khoi dong that bai thi portal van phai chay binh thuong.
    }
  }

  /** Server bao telemetry dang tat (TELEMETRY_ENABLED=0) => client im luon. */
  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on) {
      this.queue = [];
      this.pageviews = [];
      this.clearStored();
    }
  }

  /** Nho request id gan nhat de dinh kem khi co loi / khi nguoi dung bao loi. */
  noteRequestId(id: string): void {
    if (id) this.lastRequestId = id;
  }

  noteApiCall(method: string, path: string, status: number, ms: number): void {
    this.lastApiAt = Date.now();
    this.crumb('api', `${method} ${safePath(path)} -> ${status} (${ms}ms)`);
  }

  crumb(type: Crumb['type'], text: string): void {
    try {
      this.crumbs.push({ t: Date.now(), type, text: String(text).slice(0, 200) });
      if (this.crumbs.length > CRUMB_MAX) this.crumbs.shift();
    } catch {
      /* bo qua */
    }
  }

  /** Anh chup breadcrumb hien tai — nut "Bao loi" dung lai. */
  snapshot(): { breadcrumbs: Crumb[]; build: string; requestId: string; route: string } {
    return {
      breadcrumbs: this.crumbs.slice(),
      build: this.buildId,
      requestId: this.lastRequestId,
      route: safePath(location.pathname),
    };
  }

  /** Diem vao duy nhat de bao mot su kien. Khong bao gio nem. */
  report(ev: TelemetryEvent): void {
    try {
      if (!this.enabled || this.sending) return;
      if (this.sentCount >= SESSION_CAP) return;

      // Gop trung trong phien: mot loi lap 500 lan van chi gui mot lan.
      const key = `${ev.kind}|${(ev.message || '').slice(0, 200)}`;
      if (this.seen.has(key)) return;
      this.seen.add(key);

      this.sentCount++;
      this.queue.push({
        ...ev,
        route: ev.route ?? safePath(location.pathname),
        url: safePath(ev.url ?? location.pathname),
        requestId: ev.requestId || this.lastRequestId,
        breadcrumbs: this.crumbs.slice(),
        build: this.buildId,
        stack: (ev.stack || '').slice(0, 6000),
        message: (ev.message || '').slice(0, 1000),
      });

      if (this.queue.length >= BATCH_MAX) this.flush();
      else this.schedule();
    } catch {
      /* bo qua */
    }
  }

  // ------------------------------------------------------------- gui di --

  private schedule(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush();
    }, FLUSH_MS);
  }

  private flush(beacon = false): void {
    try {
      if (!this.enabled) return;
      if (!this.queue.length && !this.pageviews.length) return;
      const events = this.queue.splice(0, BATCH_MAX);
      const pageviews = this.pageviews.splice(0, PV_MAX);
      const body = JSON.stringify({ events, pageviews });

      // Dong tab: fetch bi huy giua chung, sendBeacon thi khong.
      if (beacon && navigator.sendBeacon) {
        const ok = navigator.sendBeacon(
          '/api/telemetry/client',
          new Blob([body], { type: 'application/json' }),
        );
        if (!ok) this.store(events);
        return;
      }

      this.sending = true;
      fetch('/api/telemetry/client', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      })
        .then((res) => {
          // Server tra khac 2xx = coi nhu chua gui duoc, giu lai cho lan sau.
          if (!res.ok) this.store(events);
        })
        .catch(() => this.store(events))
        .finally(() => {
          this.sending = false;
        });
    } catch {
      this.sending = false;
    }
  }

  // ------------------------------------- hang doi ben qua localStorage --
  // API chet chinh la luc loi nghiem trong nhat xay ra. Khong luu lai thi
  // dung nhung su kien dang gia nhat lai la nhung su kien bi mat.

  private store(events: TelemetryEvent[]): void {
    try {
      const now = Date.now();
      const old = this.readStored();
      const merged = [...old, ...events.map((e) => ({ at: now, e }))].slice(-LS_MAX);
      localStorage.setItem(LS_KEY, JSON.stringify(merged));
    } catch {
      // Het dung luong / che do rieng tu: bo qua, khong the lam gi hon.
    }
  }

  private readStored(): { at: number; e: TelemetryEvent }[] {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw) as { at: number; e: TelemetryEvent }[];
      const cut = Date.now() - LS_TTL_MS;
      return Array.isArray(arr) ? arr.filter((x) => x && x.at > cut) : [];
    } catch {
      return [];
    }
  }

  private clearStored(): void {
    try {
      localStorage.removeItem(LS_KEY);
    } catch {
      /* bo qua */
    }
  }

  /** Tai trang moi: gui not nhung gi con ket lai tu lan truoc. */
  private drainStored(): void {
    const stored = this.readStored();
    if (!stored.length) return;
    this.clearStored();
    this.queue.push(...stored.map((x) => x.e));
    this.schedule();
  }

  // ------------------------------------------------ tin hieu hanh vi --
  // Nguoi dung o day hiem khi mo ticket. Ngon tay ho bao truoc.

  private onClick(ev: Event): void {
    try {
      const el = ev.target as HTMLElement | null;
      if (!el) return;
      const label = describe(el);
      this.crumb('click', label);

      const now = Date.now();
      if (label === this.clickKey) {
        this.clickTimes.push(now);
        this.clickTimes = this.clickTimes.filter((t) => now - t <= RAGE_MS);
        if (this.clickTimes.length >= RAGE_N) {
          this.clickTimes = [];
          this.report({ kind: 'RageClick', message: `bam lien tuc vao: ${label}` });
        }
      } else {
        this.clickKey = label;
        this.clickTimes = [now];
      }

      // Dead click: chi xet phan tu TRONG NHU bam duoc, khong xet chu thuong.
      if (!isClickable(el)) return;
      const navBefore = this.lastNavAt;
      const apiBefore = this.lastApiAt;
      setTimeout(() => {
        if (this.lastNavAt === navBefore && this.lastApiAt === apiBefore) {
          this.report({ kind: 'DeadClick', message: `bam khong co phan hoi: ${label}` });
        }
      }, DEAD_MS);
    } catch {
      /* bo qua */
    }
  }

  private async loadBuildId(): Promise<void> {
    try {
      const res = await fetch('build.json', { cache: 'no-store' });
      if (!res.ok) return;
      const j = (await res.json()) as { build?: string };
      this.buildId = String(j.build || '').slice(0, 40);
    } catch {
      // Chua co build.json (lat 4 moi sinh ra) — de rong, khong sao.
    }
  }
}

/** Nhan dien phan tu de doc ma KHONG lo noi dung nguoi dung go. */
function describe(el: HTMLElement): string {
  const target = (el.closest('button,a,[role="button"],input,select,textarea') as HTMLElement) || el;
  const tag = target.tagName.toLowerCase();
  const id = target.id ? `#${target.id}` : '';
  const cls = typeof target.className === 'string' && target.className
    ? `.${target.className.trim().split(/\s+/).slice(0, 2).join('.')}`
    : '';
  // aria-label la nhan do lap trinh vien dat, an toan. TUYET DOI khong lay
  // textContent cua o nhap lieu hay khung chat — do la noi dung rieng tu.
  const aria = target.getAttribute('aria-label') || '';
  return `${tag}${id}${cls}${aria ? `[${aria}]` : ''}`.slice(0, 120);
}

function isClickable(el: HTMLElement): boolean {
  return !!el.closest('button,a,[role="button"],input[type="submit"],input[type="button"]');
}
