import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LanguageService } from '../../core/services/language.service';
import { UserService } from '../../core/services/user.service';
import { IconComponent } from '../../shared/components/icon/icon';

interface Entry {
  module: string;
  key: string;
  value: unknown;
}

/** Chuoi song ngu { vi, en } - dang pho bien nhat, cho sua bang 2 o rieng. */
function isBilingual(v: unknown): v is { vi: string; en: string } {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const k = Object.keys(v as object).sort();
  return k.length === 2 && k[0] === 'en' && k[1] === 'vi';
}

@Component({
  selector: 'app-admin',
  imports: [FormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin.html',
})
export class Admin {
  private readonly user = inject(UserService);
  readonly lang = inject(LanguageService).lang;

  readonly canEdit = computed(() => this.user.me()?.canEdit === true);
  readonly ready = computed(() => this.user.me() !== null);

  readonly entries = signal<Entry[]>([]);
  readonly selected = signal<Entry | null>(null);
  readonly draftVi = signal('');
  readonly draftEn = signal('');
  readonly draftJson = signal('');
  readonly status = signal('');
  readonly saving = signal(false);

  readonly bilingual = computed(() => isBilingual(this.selected()?.value));
  readonly modules = computed(() => [...new Set(this.entries().map((e) => e.module))].sort());

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const res = await fetch('/api/content', { credentials: 'same-origin' });
      if (!res.ok) return;
      const data = (await res.json()) as Record<string, Record<string, unknown>>;
      const list: Entry[] = [];
      for (const [module, keys] of Object.entries(data))
        for (const [key, value] of Object.entries(keys)) list.push({ module, key, value });
      list.sort((a, b) => a.module.localeCompare(b.module) || a.key.localeCompare(b.key));
      this.entries.set(list);
    } catch {
      this.status.set('Không tải được nội dung.');
    }
  }

  entriesOf(module: string): Entry[] {
    return this.entries().filter((e) => e.module === module);
  }

  select(e: Entry): void {
    this.selected.set(e);
    this.status.set('');
    if (isBilingual(e.value)) {
      this.draftVi.set(e.value.vi);
      this.draftEn.set(e.value.en);
    } else {
      this.draftJson.set(JSON.stringify(e.value, null, 2));
    }
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
        this.status.set('JSON không hợp lệ: ' + (err as Error).message);
        return;
      }
    }
    this.saving.set(true);
    this.status.set('Đang lưu…');
    try {
      const res = await fetch(`/api/content/${e.module}/${e.key}`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        this.status.set('Đã lưu. Tải lại trang để thấy thay đổi.');
        this.entries.update((list) =>
          list.map((x) => (x.module === e.module && x.key === e.key ? { ...x, value: payload } : x)),
        );
        this.selected.set({ ...e, value: payload });
      } else if (res.status === 403) {
        this.status.set('Bạn không có quyền sửa nội dung.');
      } else {
        this.status.set('Lưu thất bại: HTTP ' + res.status);
      }
    } catch (err) {
      this.status.set('Lỗi mạng: ' + (err as Error).message);
    } finally {
      this.saving.set(false);
    }
  }
}
