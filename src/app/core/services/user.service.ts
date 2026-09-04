import { computed, inject, signal, Injectable } from '@angular/core';
import { ApiService } from './api';
import { TelemetryService } from './telemetry.service';

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
  /** Server con thu thap loi khong (TELEMETRY_ENABLED). Thieu = coi nhu co. */
  telemetry?: boolean;
  /** true = vao bang SSO Kerberos (khong "dang xuat" khoi portal duoc),
   *  false = vao bang form dang nhap. Thieu = coi nhu SSO (canh bao thua con
   *  hon hua sai). Xem ghi chu trong account-menu.ts va server/app/main.py. */
  sso?: boolean;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  /** Moi loi goi API di qua day de duoc do thoi gian va ghi nhan khi hong.
   *  Hanh vi lui ve giu NGUYEN nhu truoc — chi them viec bao cao. */
  private readonly api = inject(ApiService);
  private readonly telemetry = inject(TelemetryService);
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
      const res = await this.api.fetch('/api/me', { credentials: 'same-origin' });
      if (!res.ok) return;
      const me = (await res.json()) as Me;
      this._me.set(me);
      // Server tat telemetry thi client ngung gui luon, khong doi build lai.
      if (me.telemetry === false) this.telemetry.setEnabled(false);
    } catch {
      // Khong lay duoc danh tinh thi trang van chay binh thuong voi loi chao chung.
    }
  }
}
