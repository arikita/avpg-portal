import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { ApiService } from '../../../core/services/api';
import { LanguageService } from '../../../core/services/language.service';
import { UserService } from '../../../core/services/user.service';
import { IconComponent } from '../../../shared/components/icon/icon';
import { when } from '../admin.store';

interface Row {
  id: number;
  title: string;
  category: string;
  status: string;
  pinned: boolean;
  author: string;
  authorName: string;
  createdAt: string;
  publishedAt: string;
  scheduledAt: string;
  hasCover: boolean;
  views: number;
  comments: number;
  reactions: number;
  polls: number;
}

/**
 * Tab "Tin tuc" — danh sach quan tri, thay CA bai nhap/an/hen gio cua nguoi khac
 * (khac /api/news thuong, cho nay chi tra bai nhap cua chinh nguoi goi).
 *
 * Ghim va xoa van goi dung endpoint cu cua news.py, tuc van theo luat cu: chi
 * nhom Information System duoc ghim/xoa. Vao duoc trang quan tri KHONG tu dong
 * cho quyen do — nut se an di neu tai khoan khong kiem duyet duoc, thay vi hien
 * ra roi de nguoi dung an phai 403.
 */
@Component({
  selector: 'app-admin-news',
  imports: [FormsModule, RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './news.html',
})
export class AdminNews {
  private readonly api = inject(ApiService);
  private readonly user = inject(UserService);
  readonly lang = inject(LanguageService).lang;
  readonly vi = computed(() => this.lang() === 'vi');

  readonly rows = signal<Row[]>([]);
  readonly counts = signal<Record<string, number>>({});
  readonly loading = signal(false);
  readonly status = signal('');
  readonly fStatus = signal('');
  readonly q = signal('');
  readonly busy = signal(0);

  /** Ghim/xoa van la quyen cua nhom IS, khong phai quyen vao trang nay. */
  readonly canModerate = computed(() => this.user.me()?.canModerateNews === true);
  readonly canPost = computed(() => this.user.me()?.canPostNews === true);

  /** counts() la Record<string, number> nen TypeScript coi moi khoa la co san;
   *  thuc te server chi tra ve trang thai NAO DANG CO bai. Doc qua ham nay de
   *  trang thai chua co bai nao hien 0 chu khong hien o trong. */
  count(k: string): number {
    return this.counts()[k] ?? 0;
  }

  readonly total = computed(() =>
    Object.values(this.counts()).reduce((a, b) => a + b, 0),
  );

  constructor() {
    void this.load();
  }

  when = when;

  async load(): Promise<void> {
    this.loading.set(true);
    const qs = new URLSearchParams({ status: this.fStatus(), q: this.q(), limit: '200' });
    const data = await this.api.json<{ items: Row[]; counts: Record<string, number> }>(
      `/api/admin/news?${qs}`,
    );
    this.loading.set(false);
    if (!data) {
      this.status.set(this.vi() ? 'Không tải được danh sách bài.' : 'Could not load posts.');
      return;
    }
    this.rows.set(data.items ?? []);
    this.counts.set(data.counts ?? {});
  }

  statusLabel(s: string): string {
    const vi: Record<string, string> = {
      published: 'Đã đăng', draft: 'Nháp', scheduled: 'Hẹn giờ', hidden: 'Đang ẩn',
    };
    const en: Record<string, string> = {
      published: 'Published', draft: 'Draft', scheduled: 'Scheduled', hidden: 'Hidden',
    };
    return (this.vi() ? vi[s] : en[s]) ?? s;
  }

  /** Bai hen gio da qua gio ma van 'scheduled' = timer phat hanh co van de. */
  overdue(r: Row): boolean {
    return r.status === 'scheduled' && !!r.scheduledAt && new Date(r.scheduledAt) < new Date();
  }

  async pin(r: Row): Promise<void> {
    this.busy.set(r.id);
    const res = await this.api.json<{ pinned: boolean }>(`/api/news/${r.id}/pin`, { method: 'POST' });
    this.busy.set(0);
    if (!res) {
      this.status.set(this.vi() ? 'Không ghim được (cần quyền IS).' : 'Could not pin (IS only).');
      return;
    }
    this.rows.update((list) => list.map((x) => (x.id === r.id ? { ...x, pinned: res.pinned } : x)));
  }

  async remove(r: Row): Promise<void> {
    const msg = this.vi()
      ? `Xoá vĩnh viễn bài "${r.title}"?\n\nBình luận, cảm xúc và poll của bài cũng mất theo. Không khôi phục được.`
      : `Permanently delete "${r.title}"?\n\nIts comments, reactions and polls go too. This cannot be undone.`;
    if (!confirm(msg)) return;
    this.busy.set(r.id);
    const res = await this.api.json<{ ok: boolean }>(`/api/news/${r.id}`, { method: 'DELETE' });
    this.busy.set(0);
    if (!res?.ok) {
      this.status.set(this.vi() ? 'Xoá thất bại (cần quyền IS hoặc là tác giả).' : 'Delete failed.');
      return;
    }
    this.rows.update((list) => list.filter((x) => x.id !== r.id));
    this.status.set(this.vi() ? 'Đã xoá bài.' : 'Post deleted.');
  }
}
