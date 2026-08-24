import { Injectable, computed, inject, signal } from '@angular/core';
import { ApiService } from '../../core/services/api';

export interface DayPoint {
  date: string;
  views: number;
  users: number;
}

export interface TodoItem {
  level: 'critical' | 'warning' | 'info';
  key: string;
  n: number;
  tab: string;
}

export interface Overview {
  buildId: string;
  telemetry: boolean;
  dbOk: boolean;
  today: { views: number; users: number };
  yesterday: { views: number; users: number };
  series: DayPoint[];
  errors: Record<string, number>;
  errors24h: number;
  req5m: { n: number; err5xx: number; slow: number; msAvg: number };
  counts: Record<string, number>;
  todo: TodoItem[];
  recentContent: { module: string; key: string; at: string; by: string }[];
}

/**
 * Kho chung cua bang dieu khien — CHI cho phan /overview.
 *
 * Vi sao rieng mot service thay vi de trong component: thanh tab ben trai phai
 * hien so loi moi NGAY KHI mo bat ky tab nao, con tab "Tong quan" cung can dung
 * bo so lieu do. Neu moi ben tu goi thi mo trang la hai request giong het nhau.
 *
 * Cac tab con lai tu goi API cua no: du lieu cua chung nang va chi can khi mo.
 */
@Injectable({ providedIn: 'root' })
export class AdminStore {
  private readonly api = inject(ApiService);

  readonly overview = signal<Overview | null>(null);
  readonly loading = signal(false);
  readonly failed = signal(false);

  /** So loi 'new' — dung cho huy hieu do tren thanh tab. */
  readonly newErrors = computed(() =>
    Object.values(this.overview()?.errors ?? {}).reduce((a, b) => a + b, 0),
  );

  /** Bao nhieu viec dang cho — huy hieu tren tab Tong quan. */
  readonly todoCount = computed(() => this.overview()?.todo.length ?? 0);

  async load(force = false): Promise<void> {
    if (this.loading()) return;
    if (this.overview() && !force) return;
    this.loading.set(true);
    const data = await this.api.json<Overview>('/api/admin/overview');
    this.loading.set(false);
    this.failed.set(!data);
    if (data) this.overview.set(data);
  }
}

// ---------------------------------------------------------------------------
// Tien ich dung chung cho moi tab
// ---------------------------------------------------------------------------

/** Gio +07 tuong minh. Zabbix, Graylog va trang nay phai cung mot moc thi moi
 *  doi chieu duoc — da tung vap chuyen Forti ghi tz="+0700" con eventtime la UTC. */
export function when(iso: string, withTime = true): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      ...(withTime ? { hour: '2-digit' as const, minute: '2-digit' as const } : {}),
    });
  } catch {
    return iso;
  }
}

/** '2026-08-24' -> '24/08' cho truc ngang cua bieu do. */
export function dayLabel(iso: string): string {
  return iso.length >= 10 ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : iso;
}

/** '5 phút trước' — du chinh xac cho danh sach hoat dong. */
export function ago(iso: string, vi: boolean): string {
  if (!iso) return '';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 90) return vi ? 'vừa xong' : 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return vi ? `${m} phút trước` : `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 36) return vi ? `${h} giờ trước` : `${h} h ago`;
  return vi ? `${Math.round(h / 24)} ngày trước` : `${Math.round(h / 24)} d ago`;
}
