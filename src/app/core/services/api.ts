import { inject, Injectable } from '@angular/core';
import { safePath } from '../../shared/util/safe-path';
import { TelemetryService } from './telemetry.service';

/**
 * Boc `fetch` cho toan bo loi goi API cua portal.
 *
 * Truoc day 11 service goi `fetch` truc tiep, moi cho mot kieu `catch {}`, nen
 * API chet la nguoi dung thay trang thieu du lieu con IT khong hay biet gi.
 *
 * QUAN TRONG — GIU NGUYEN HANH VI LUI VE. Ham nay chi THEM viec ghi nhan.
 * Nhung cho dang co tinh im lang (vi du ContentService lui ve ban trong bundle)
 * phai tiep tuc im lang voi nguoi dung; loi chi di vao telemetry.
 */

/** Cham hon nguong nay thi ghi nhan mot su kien warning. */
const SLOW_MS = 3000;

/**
 * Loi mang nay co dang bao khong?
 *
 * BAI HOC 24/08/2026 — `lienttk` sinh hai NetworkError luc 10:20:22, nhung log
 * Apache cho thay CA HAI request do tra 200 trong 40ms luc 10:20:23. Doc them
 * log: may nguoi do thoi goi API tu 08:59 den 10:20 (81 phut im lang) roi ba
 * request bat lai cung mot luc. Do la may NGU DAY (hoac Edge dong bang tab nen
 * — tinh nang Sleeping tabs bat san). Fetch dang do bi trinh duyet huy, ung
 * dung tu thu lai va thanh cong ngay sau do.
 *
 * Bao nhung lan nhu vay la lam ban bang loi bang thu khong ai sua duoc. Chi bao
 * khi nguoi dung DANG NHIN va may DANG CO MANG — luc do "Failed to fetch" moi
 * thuc su nghia la API hong.
 */
function worthReporting(): boolean {
  try {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return false;
  } catch {
    /* khong doc duoc thi cu bao — tha bao thua con hon mu tit */
  }
  return true;
}
/** Qua han thi huy — khong de nguoi dung ngoi nhin vong quay vo tan. */
const TIMEOUT_MS = 15000;

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly telemetry = inject(TelemetryService);

  /** Nhu `fetch`, nhung do thoi gian, gan timeout va bao cao khi hong. */
  async fetch(path: string, init: RequestInit = {}): Promise<Response> {
    const method = (init.method || 'GET').toUpperCase();
    const started = Date.now();

    // Ton trong signal do noi goi truyen vao, dong thoi van co timeout cua minh.
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    if (init.signal) {
      if (init.signal.aborted) ctrl.abort();
      else init.signal.addEventListener('abort', () => ctrl.abort(), { once: true });
    }

    try {
      const res = await fetch(path, { credentials: 'same-origin', ...init, signal: ctrl.signal });
      const ms = Date.now() - started;

      const rid = res.headers.get('X-Request-Id') || '';
      if (rid) this.telemetry.noteRequestId(rid);
      this.telemetry.noteApiCall(method, path, res.status, ms);

      if (res.status >= 500) {
        this.telemetry.report({
          kind: `HTTP${res.status}`,
          message: `${method} ${safePath(path)} tra ${res.status}`,
          status: res.status,
          requestId: rid,
        });
      } else if (ms > SLOW_MS) {
        this.telemetry.report({
          kind: 'SlowApi',
          message: `${method} ${safePath(path)} mat ${ms}ms`,
          status: res.status,
          requestId: rid,
        });
      }
      return res;
    } catch (err) {
      const ms = Date.now() - started;
      const aborted = (err as Error)?.name === 'AbortError';
      // Noi goi tu huy (vi du doi trang) thi khong phai loi — dung bao.
      const mine = aborted && ms >= TIMEOUT_MS - 50;
      // Qua han 15s thi VAN bao du tab dang an: do la API that su khong tra loi,
      // khac han chuyen trinh duyet huy request khi may ngu.
      if ((!aborted && worthReporting()) || mine) {
        this.telemetry.report({
          kind: mine ? 'ApiTimeout' : 'NetworkError',
          message: `${method} ${safePath(path)}: ${mine ? `qua han ${TIMEOUT_MS}ms` : (err as Error)?.message || 'loi mang'}`,
        });
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Tien ich: GET roi doc JSON, tra `null` neu khong lay duoc. */
  async json<T>(path: string, init: RequestInit = {}): Promise<T | null> {
    try {
      const res = await this.fetch(path, init);
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch {
      return null;
    }
  }
}
