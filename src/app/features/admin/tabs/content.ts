import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiService } from '../../../core/services/api';
import { LanguageService } from '../../../core/services/language.service';
import { IconComponent } from '../../../shared/components/icon/icon';
import { when } from '../admin.store';

interface Entry {
  module: string;
  key: string;
  value: unknown;
}

interface HistoryRow {
  changedAt: string;
  changedBy: string;
  value: unknown;
}

/** Chuoi song ngu { vi, en } — dang pho bien nhat, cho sua bang 2 o rieng. */
function isBilingual(v: unknown): v is { vi: string; en: string } {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const k = Object.keys(v as object).sort();
  return k.length === 2 && k[0] === 'en' && k[1] === 'vi';
}

/** Bo dau de go "chinh sach" tim duoc "Chính sách". */
function fold(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase();
}

/**
 * Tab "Noi dung" — chuyen nguyen tu trang /admin cu, them tim kiem va LICH SU.
 *
 * NHAC LAI LUAT CUNG cua du an: sua o day la sua DB (nguon dang chay). Ban du
 * phong trong bundle nam o src/app/content/*.ts va KHONG tu dong doi theo —
 * sua mot chi mot noi la hai ban lech nhau, den luc API chet moi lo ra.
 */
@Component({
  selector: 'app-admin-content',
  imports: [FormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './content.html',
})
export class AdminContent {
  private readonly api = inject(ApiService);
  readonly lang = inject(LanguageService).lang;
  readonly vi = computed(() => this.lang() === 'vi');

  readonly entries = signal<Entry[]>([]);
  readonly selected = signal<Entry | null>(null);
  readonly draftVi = signal('');
  readonly draftEn = signal('');
  readonly draftJson = signal('');
  readonly status = signal('');
  readonly saving = signal(false);
  readonly q = signal('');

  readonly history = signal<HistoryRow[]>([]);
  readonly showHistory = signal(false);

  readonly bilingual = computed(() => isBilingual(this.selected()?.value));

  readonly filtered = computed(() => {
    const term = fold(this.q().trim());
    if (!term) return this.entries();
    return this.entries().filter(
      (e) =>
        fold(e.key).includes(term) ||
        fold(e.module).includes(term) ||
        fold(JSON.stringify(e.value ?? '')).includes(term),
    );
  });

  readonly modules = computed(() => [...new Set(this.filtered().map((e) => e.module))].sort());

  constructor() {
    void this.load();
  }

  when = when;

  private async load(): Promise<void> {
    const data = await this.api.json<Record<string, Record<string, unknown>>>('/api/content');
    if (!data) {
      this.status.set(this.vi() ? 'Không tải được nội dung.' : 'Could not load content.');
      return;
    }
    const list: Entry[] = [];
    for (const [module, keys] of Object.entries(data))
      for (const [key, value] of Object.entries(keys)) list.push({ module, key, value });
    list.sort((a, b) => a.module.localeCompare(b.module) || a.key.localeCompare(b.key));
    this.entries.set(list);
  }

  entriesOf(module: string): Entry[] {
    return this.filtered().filter((e) => e.module === module);
  }

  select(e: Entry): void {
    this.selected.set(e);
    this.status.set('');
    this.showHistory.set(false);
    this.history.set([]);
    if (isBilingual(e.value)) {
      this.draftVi.set(e.value.vi);
      this.draftEn.set(e.value.en);
    } else {
      this.draftJson.set(JSON.stringify(e.value, null, 2));
    }
  }

  isOn(e: Entry): boolean {
    const s = this.selected();
    return !!s && s.module === e.module && s.key === e.key;
  }

  async toggleHistory(): Promise<void> {
    const e = this.selected();
    if (!e) return;
    const open = !this.showHistory();
    this.showHistory.set(open);
    if (!open || this.history().length) return;
    const rows = await this.api.json<HistoryRow[]>(
      `/api/content/${e.module}/${e.key}/history`,
    );
    this.history.set(rows ?? []);
  }

  /** Do lai ban cu vao o soan thao. KHONG tu luu — nguoi dung phai bam Lưu,
   *  vi lan luu do lai sinh them mot dong lich su nua (co chu dich: khoi phuc
   *  cung la mot lan thay doi, phai truy nguoc duoc). */
  useVersion(h: HistoryRow): void {
    const e = this.selected();
    if (!e) return;
    if (isBilingual(h.value)) {
      this.draftVi.set(h.value.vi);
      this.draftEn.set(h.value.en);
    } else {
      this.draftJson.set(JSON.stringify(h.value, null, 2));
    }
    this.status.set(
      this.vi()
        ? 'Đã nạp bản cũ vào ô soạn thảo — bấm Lưu để áp dụng.'
        : 'Old version loaded into the editor — press Save to apply.',
    );
  }

  preview(v: unknown): string {
    const s = typeof v === 'string' ? v : JSON.stringify(v);
    return s.length > 120 ? s.slice(0, 120) + '…' : s;
  }

  async save(): Promise<void> {
    const e = this.selected();
    if (!e) return;
    let payload: unknown;
    if (this.bilingual()) {
      payload = { vi: this.draftVi(), en: this.draftEn() };
    } else {
      try {
        payload = JSON.parse(this.draftJson());
      } catch (err) {
        this.status.set(
          (this.vi() ? 'JSON không hợp lệ: ' : 'Invalid JSON: ') + (err as Error).message,
        );
        return;
      }
    }
    this.saving.set(true);
    this.status.set(this.vi() ? 'Đang lưu…' : 'Saving…');
    try {
      const res = await this.api.fetch(`/api/content/${e.module}/${e.key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        this.status.set(
          this.vi()
            ? 'Đã lưu. Tải lại trang để thấy thay đổi.'
            : 'Saved. Reload the page to see it.',
        );
        this.entries.update((list) =>
          list.map((x) => (x.module === e.module && x.key === e.key ? { ...x, value: payload } : x)),
        );
        this.selected.set({ ...e, value: payload });
        this.history.set([]); // lich su da co them mot dong, doc lai khi can
      } else if (res.status === 403) {
        this.status.set(
          this.vi() ? 'Bạn không có quyền sửa nội dung.' : 'You cannot edit content.',
        );
      } else {
        this.status.set((this.vi() ? 'Lưu thất bại: HTTP ' : 'Save failed: HTTP ') + res.status);
      }
    } catch (err) {
      this.status.set((this.vi() ? 'Lỗi mạng: ' : 'Network error: ') + (err as Error).message);
    } finally {
      this.saving.set(false);
    }
  }
}
