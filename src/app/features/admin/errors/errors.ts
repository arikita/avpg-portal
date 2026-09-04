import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

import { ApiService } from '../../../core/services/api';
import { LanguageService } from '../../../core/services/language.service';
import { IconComponent } from '../../../shared/components/icon/icon';
import { AdminStore, when } from '../admin.store';

/** Mot dong trong bang loi (da gop theo fingerprint). */
export interface ErrorRow {
  id: number;
  fingerprint: string;
  source: string;
  severity: string;
  kind: string;
  message: string;
  route: string;
  endpoint: string;
  httpStatus: number | null;
  count: number;
  usersHit: number;
  firstSeen: string;
  lastSeen: string;
  status: string;
  buildId: string;
}

export interface ErrorSample {
  username: string;
  userAgent: string;
  url: string;
  stack: string;
  requestId: string;
  context: { breadcrumbs?: { t: number; type: string; text: string }[]; build?: string } | null;
  createdAt: string;
}

@Component({
  selector: 'app-admin-errors',
  imports: [FormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './errors.html',
})
export class AdminErrors {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(AdminStore);
  readonly lang = inject(LanguageService).lang;
  readonly vi = computed(() => this.lang() === 'vi');

  readonly rows = signal<ErrorRow[]>([]);
  readonly newBySeverity = signal<Record<string, number>>({});
  readonly loading = signal(false);
  readonly status = signal('');

  readonly fSeverity = signal('');
  readonly fStatus = signal('');
  readonly fHours = signal(168);

  readonly selected = signal<ErrorRow | null>(null);
  readonly samples = signal<ErrorSample[]>([]);

  readonly newTotal = computed(() =>
    Object.values(this.newBySeverity()).reduce((a, b) => a + b, 0),
  );

  /** Thong bao loi tu server tro toi /admin/errors?id=123 (xem telemetry.py) —
   *  mo dung loi do ngay, dung bat nguoi ta tu do trong bang. */
  private readonly deepLink = toSignal(this.route.queryParamMap);

  constructor() {
    void this.load();
    effect(() => {
      const id = Number(this.deepLink()?.get('id') ?? 0);
      if (id && untracked(() => this.selected()?.id) !== id) void this.openById(id);
    });
  }

  when = when;

  /** newBySeverity() la Record<string, number>: TypeScript coi moi khoa la co
   *  san, con server chi tra ve muc do NAO DANG CO loi. Doc qua ham nay de o
   *  khong co loi hien 0 chu khong hien trong. */
  /**
   * Lop huy hieu cho mot muc do. Mau KHONG di mot minh — chu ("critical",
   * "error"...) luon nam trong huy hieu, vi hai trong bon mau khong dat 3:1 va
   * nguoi mu mau do-luc khong tach duoc do voi cam.
   *
   * Nen dac = nang hon nen nhat: critical do dac, error do nhat. Do la thang
   * bac doc duoc ma khong can tra bang mau.
   */
  sevBadge(k: string): string {
    if (k === 'critical') return 'text-bg-danger';
    if (k === 'error') return 'text-danger-emphasis bg-danger-subtle border border-danger-subtle';
    if (k === 'warning') return 'text-warning-emphasis bg-warning-subtle border border-warning-subtle';
    return 'text-info-emphasis bg-info-subtle border border-info-subtle';
  }

  sev(k: string): number {
    return this.newBySeverity()[k] ?? 0;
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.status.set('');
    const qs = new URLSearchParams({
      severity: this.fSeverity(),
      status: this.fStatus(),
      since_hours: String(this.fHours()),
      limit: '200',
    });
    const data = await this.api.json<{ items: ErrorRow[]; newBySeverity: Record<string, number> }>(
      `/api/telemetry/errors?${qs}`,
    );
    this.loading.set(false);
    if (!data) {
      this.status.set(
        this.vi()
          ? 'Không tải được danh sách lỗi (bạn có quyền xem không?).'
          : 'Could not load errors (do you have permission?).',
      );
      return;
    }
    this.rows.set(data.items ?? []);
    this.newBySeverity.set(data.newBySeverity ?? {});
  }

  private async openById(id: number): Promise<void> {
    const data = await this.api.json<{ error: ErrorRow; samples: ErrorSample[] }>(
      `/api/telemetry/errors/${id}`,
    );
    if (!data) return;
    this.selected.set(data.error);
    this.samples.set(data.samples ?? []);
  }

  async open(row: ErrorRow): Promise<void> {
    this.selected.set(row);
    this.samples.set([]);
    await this.openById(row.id);
  }

  close(): void {
    this.selected.set(null);
    this.samples.set([]);
  }

  async mark(st: 'ack' | 'resolved' | 'new'): Promise<void> {
    const row = this.selected();
    if (!row) return;
    const res = await this.api.json<{ ok: boolean; status: string }>(
      `/api/telemetry/errors/${row.id}/status`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: st }),
      },
    );
    if (!res?.ok) return;
    this.selected.set({ ...row, status: st });
    this.rows.update((rs) => rs.map((r) => (r.id === row.id ? { ...r, status: st } : r)));
    void this.load();
    // Huy hieu do tren thanh tab lay so tu /overview — doi trang thai xong phai
    // doc lai, khong thi con so cu treo do den luc tai lai trang.
    void this.store.load(true);
  }

  crumbsOf(s: ErrorSample): { t: number; type: string; text: string }[] {
    return s.context?.breadcrumbs ?? [];
  }
}
