import { Injectable, signal } from '@angular/core';

/**
 * Ban do {username -> duong dan anh dai dien} cho NHUNG AI DA TAI ANH LEN.
 *
 * Avatar xuat hien khap noi (tac gia bai viet, binh luan, facepile cam xuc,
 * dong nghiep cung phong). Hoi tung nguoi mot se thanh hang chuc request moi
 * lan mo trang tin, nen tai MOT ban do dung chung roi tra cuu tai cho. Ai chua
 * co anh thi khong nam trong ban do va giao dien lui ve chu cai dau.
 */
@Injectable({ providedIn: 'root' })
export class AvatarService {
  private readonly _map = signal<Record<string, string>>({});
  private loaded = false;

  readonly map = this._map.asReadonly();

  constructor() {
    void this.load();
  }

  /** Duong dan anh cua mot nguoi, '' neu ho chua tai anh. */
  urlOf(username: string | null | undefined): string {
    return (username && this._map()[username]) || '';
  }

  /** Goi lai sau khi chinh minh doi anh de moi cho tren trang cap nhat ngay. */
  async refresh(): Promise<void> {
    this.loaded = false;
    await this.load();
  }

  private async load(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const res = await fetch('/api/avatars', { credentials: 'same-origin' });
      if (!res.ok) return;
      const data = (await res.json()) as { avatars?: Record<string, string> };
      this._map.set(data.avatars ?? {});
    } catch {
      // Khong tai duoc thi moi noi hien chu cai dau — khong anh huong gi khac.
    }
  }
}
