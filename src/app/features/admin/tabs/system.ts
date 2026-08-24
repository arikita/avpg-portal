import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { ApiService } from '../../../core/services/api';
import { LanguageService } from '../../../core/services/language.service';
import { IconComponent } from '../../../shared/components/icon/icon';
import { AdmBars, Point, compact } from '../charts';
import { when } from '../admin.store';

interface Unit {
  unit: string;
  label: string;
  state: string;
  result: string;
  since: string;
  next: string;
}

interface System {
  buildId: string;
  telemetry: boolean;
  dbOk: boolean;
  dbSize: string;
  ga4: { measurementId: string; property: string; keyConfigured: boolean };
  units: Unit[];
  disk: { totalGb: number; freeGb: number; usedPct: number } | null;
  media: { path: string; exists: boolean } | null;
  tables: { name: string; size: string; rows: number }[];
  lastStat: string;
  lastPageView: string;
  retention: { table: string; keep: string; rows: number }[];
  metrics: { name: string; n: number }[];
}

/** Ten chi so nghiep vu -> tieng nguoi. */
const METRIC_VI: Record<string, string> = {
  wall_post: 'Bài đăng trên tường',
  wall_comment: 'Bình luận tường',
  chat_message: 'Tin nhắn chat',
  news_post: 'Bài tin tức mới',
  news_view: 'Lượt đọc tin',
};

/**
 * Tab "He thong" — CHI DOC.
 *
 * Khong co nut start/stop/restart nao, va se khong bao gio co: mot loi XSS hay
 * mot phien bi chiem ma bam duoc "restart postgresql" thi ca portal sap. Muon
 * tac dong vao dich vu thi SSH. Trang nay tra loi cau "co gi dang hong khong",
 * khong phai "sua giup toi".
 */
@Component({
  selector: 'app-admin-system',
  imports: [IconComponent, AdmBars],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './system.html',
})
export class AdminSystem {
  private readonly api = inject(ApiService);
  readonly lang = inject(LanguageService).lang;
  readonly vi = computed(() => this.lang() === 'vi');

  readonly data = signal<System | null>(null);
  readonly loading = signal(false);

  constructor() {
    void this.load();
  }

  fmt = compact;
  when = when;

  async load(): Promise<void> {
    this.loading.set(true);
    this.data.set(await this.api.json<System>('/api/admin/system'));
    this.loading.set(false);
  }

  ok(u: Unit): boolean {
    return u.state === 'active' || u.state === 'waiting';
  }

  metricLabel(n: string): string {
    return this.vi() ? (METRIC_VI[n] ?? n) : n;
  }

  readonly metricBars = computed<Point[]>(() =>
    (this.data()?.metrics ?? []).map((m) => ({ label: this.metricLabel(m.name), value: m.n })),
  );

  /** Bo dem con song khong: khong co dong nao trong 10 phut la dang ngo. */
  readonly statStale = computed(() => {
    const t = this.data()?.lastStat;
    return !!t && Date.now() - new Date(t).getTime() > 10 * 60 * 1000;
  });
}
