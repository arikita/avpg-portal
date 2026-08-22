import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api';
import { LanguageService } from '../../../core/services/language.service';
import { UserService } from '../../../core/services/user.service';
import { IconComponent } from '../../../shared/components/icon/icon';

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
  imports: [FormsModule, IconComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './errors.html',
})
export class AdminErrors {
  private readonly api = inject(ApiService);
  private readonly user = inject(UserService);
  readonly lang = inject(LanguageService).lang;

  readonly canEdit = computed(() => this.user.me()?.canEdit === true);
  readonly ready = computed(() => this.user.me() !== null);

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

  constructor() {
    void this.load();
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
        this.lang() === 'vi'
          ? 'Không tải được danh sách lỗi (bạn có quyền xem không?).'
          : 'Could not load errors (do you have permission?).',
      );
      return;
    }
    this.rows.set(data.items ?? []);
    this.newBySeverity.set(data.newBySeverity ?? {});
  }

  async open(row: ErrorRow): Promise<void> {
    this.selected.set(row);
    this.samples.set([]);
    const data = await this.api.json<{ error: ErrorRow; samples: ErrorSample[] }>(
      `/api/telemetry/errors/${row.id}`,
    );
    if (data) {
      this.selected.set(data.error);
      this.samples.set(data.samples ?? []);
    }
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
  }

  /**
   * Gio +07 tuong minh. Zabbix, Graylog va trang nay phai cung mot moc thi moi
   * doi chieu duoc — da tung vap chuyen Forti ghi tz="+0700" con eventtime la UTC.
   */
  when(iso: string): string {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  }

  crumbsOf(s: ErrorSample): { t: number; type: string; text: string }[] {
    return s.context?.breadcrumbs ?? [];
  }
}
