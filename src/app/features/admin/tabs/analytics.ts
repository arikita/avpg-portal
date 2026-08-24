import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiService } from '../../../core/services/api';
import { LanguageService } from '../../../core/services/language.service';
import { IconComponent } from '../../../shared/components/icon/icon';
import { AdmBars, AdmCols, AdmTrend, Point, compact } from '../charts';
import { ago, dayLabel, when } from '../admin.store';

interface Analytics {
  days: number;
  series: { date: string; views: number; users: number }[];
  routes: { route: string; views: number; users: number }[];
  departments: { department: string; views: number; users: number }[];
  people: { username: string; views: number; days: number; last: string }[];
  hours: { h: number; views: number }[];
  active: { d1: number; d7: number; d30: number };
  totals: { views: number; users: number };
}

interface Ga4 {
  configured: boolean;
  ok?: boolean;
  reason?: string;
  detail?: string;
  error?: string;
  days?: number;
  property: string;
  measurementId: string;
  setup?: string[];
  totals?: { users: number; sessions: number; views: number; engagedSec: number; engagementRate: number };
  series?: { date: string; users: number; views: number }[];
  pages?: { title: string; path: string; views: number; users: number }[];
  devices?: { device: string; users: number }[];
  realtimeUsers?: number;
}

/**
 * Tab "Luot truy cap" — HAI nguon so lieu, co y de canh nhau chu khong tron.
 *
 *   - Tu host (PostgreSQL, bang app_page_view): biet CHINH XAC ai va phong ban
 *     nao dung portal. Dieu khoan Google cam gui PII nen GA4 khong tra loi duoc
 *     cau nay — ben do /profile/<user> da bi boi thanh /profile/*.
 *   - GA4: thiet bi, phien, thoi luong, so lieu thoi gian thuc.
 *
 * Hai ben dem theo hai luat khac nhau (GA4 co lo chan bot, tu host dem moi lan
 * doi route) nen SO SE KHONG BANG NHAU. Do khong phai loi — trang co ghi ro
 * dieu do, thay vi de nguoi xem tu doan roi mat long tin vao ca hai.
 */
@Component({
  selector: 'app-admin-analytics',
  imports: [FormsModule, IconComponent, AdmTrend, AdmBars, AdmCols],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './analytics.html',
})
export class AdminAnalytics {
  private readonly api = inject(ApiService);
  readonly lang = inject(LanguageService).lang;
  readonly vi = computed(() => this.lang() === 'vi');

  readonly days = signal(30);
  readonly data = signal<Analytics | null>(null);
  readonly ga = signal<Ga4 | null>(null);
  readonly loading = signal(false);
  readonly gaLoading = signal(false);
  readonly showPeople = signal(false);

  constructor() {
    void this.load();
  }

  fmt = compact;
  when = when;
  ago = ago;

  async load(): Promise<void> {
    this.loading.set(true);
    this.gaLoading.set(true);
    const d = this.days();
    // Hai lo goi song song: GA4 di ra internet nen cham hon nhieu, khong de no
    // chan phan tu host hien ra.
    const selfHosted = this.api.json<Analytics>(`/api/admin/analytics?days=${d}`);
    const google = this.api.json<Ga4>(`/api/admin/ga4?days=${d}`);
    this.data.set(await selfHosted);
    this.loading.set(false);
    this.ga.set(await google);
    this.gaLoading.set(false);
  }

  setDays(d: number): void {
    this.days.set(d);
    void this.load();
  }

  // ---- du lieu cho bieu do -------------------------------------------------
  readonly viewSeries = computed<Point[]>(() =>
    (this.data()?.series ?? []).map((d) => ({ label: dayLabel(d.date), value: d.views })),
  );
  readonly userSeries = computed<Point[]>(() =>
    (this.data()?.series ?? []).map((d) => ({ label: dayLabel(d.date), value: d.users })),
  );
  readonly routeBars = computed<Point[]>(() =>
    (this.data()?.routes ?? []).slice(0, 12).map((r) => ({ label: r.route, value: r.views })),
  );
  readonly deptBars = computed<Point[]>(() =>
    (this.data()?.departments ?? []).slice(0, 12).map((d) => ({ label: d.department, value: d.users })),
  );
  /** 24 cot, gio nao khong co luot xem van phai co cho dung — bo di thi truc
   *  ngang co dan theo du lieu va "8h" nhay lung tung moi lan tai lai. */
  readonly hourCols = computed<Point[]>(() => {
    const m = new Map((this.data()?.hours ?? []).map((h) => [h.h, h.views]));
    return Array.from({ length: 24 }, (_, h) => ({
      label: h % 3 === 0 ? String(h) : '',
      value: m.get(h) ?? 0,
    }));
  });
  readonly gaSeries = computed<Point[]>(() =>
    (this.ga()?.series ?? []).map((d) => ({ label: dayLabel(d.date), value: d.views })),
  );
  readonly deviceBars = computed<Point[]>(() =>
    (this.ga()?.devices ?? []).map((d) => ({ label: d.device, value: d.users })),
  );

  readonly gaLink = computed(
    () =>
      `https://analytics.google.com/analytics/web/#/a404970462p${this.ga()?.property ?? '550323823'}/realtime/overview`,
  );

  /** '4 phut 12 giay' — thoi luong tuong tac trung binh moi nguoi. */
  engaged(): string {
    const g = this.ga();
    if (!g?.totals?.users) return '—';
    const s = Math.round(g.totals.engagedSec / g.totals.users);
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  }
}
