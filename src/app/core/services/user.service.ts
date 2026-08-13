import { computed, Injectable, signal } from '@angular/core';

/** Danh tinh nguoi dang dang nhap, lay tu /api/me (Apache + Kerberos + AD). */
export interface Me {
  username: string;
  fullName?: string;
  displayName?: string;
  givenName?: string;
  sn?: string;
  mail?: string;
  title?: string;
  department?: string;
  /** True neu user thuoc nhom duoc sua noi dung (Information System). */
  canEdit?: boolean;
  /** True neu duoc dang tin tuc (HR/Marketing/IS). */
  canPostNews?: boolean;
  /** True neu duoc kiem duyet tin tuc (IS). */
  canModerateNews?: boolean;
  /** Anh dai dien tren ho so ca nhan, '' neu chua tai len. */
  avatar?: string;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly _me = signal<Me | null>(null);

  /** Thong tin day du, null khi chua tai xong hoac khong lay duoc. */
  readonly me = this._me.asReadonly();
  /** Ho ten day du tu AD (displayName), null neu khong co. */
  readonly fullName = computed(() => this._me()?.fullName ?? null);
  readonly username = computed(() => this._me()?.username ?? '');
  readonly avatar = computed(() => this._me()?.avatar ?? '');

  /** Doi anh dai dien xong thi navbar doi theo ngay, khong phai tai lai trang. */
  setAvatar(url: string): void {
    this._me.update((m) => (m ? { ...m, avatar: url } : m));
  }

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const res = await fetch('/api/me', { credentials: 'same-origin' });
      if (!res.ok) return;
      this._me.set((await res.json()) as Me);
    } catch {
      // Khong lay duoc danh tinh thi trang van chay binh thuong voi loi chao chung.
    }
  }
}
