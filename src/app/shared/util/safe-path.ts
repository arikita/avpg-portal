/**
 * Bo phan dinh danh ca nhan khoi duong dan truoc khi gui di.
 *
 * DUNG CHUNG cho analytics.service.ts (gui ra Google) va telemetry.service.ts
 * (gui ve DB noi bo). Hai ben BAT BUOC cung mot luat: neu lech nhau thi so
 * lieu hai noi khong doi chieu duoc, ma lech thi khong co gi bao loi ca.
 *
 * Luat nay con phai khop voi `_safe_path()` trong server/app/telemetry.py —
 * server lam sach lan nua truoc khi luu (khong tin client), nen hai ben lech
 * se lam mot so duong dan bi gom hai kieu khac nhau.
 */
export function safePath(url: string): string {
  const path = (url || '').split(/[?#]/)[0];
  return path
    .replace(/^\/profile\/[^/]+/, '/profile/*')
    .replace(/^\/wall\/[^/]+/, '/wall/*')
    .slice(0, 300);
}
