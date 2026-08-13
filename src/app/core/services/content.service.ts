import { Injectable, signal } from '@angular/core';

type Modules = Record<string, Record<string, unknown>>;

/**
 * Noi dung lay tu /api/content (PostgreSQL).
 *
 * Ban trong bundle van duoc giu lam DU PHONG: trang luon co chu ngay tu dau,
 * khong chop trang, va van chay duoc neu API chet.
 */
@Injectable({ providedIn: 'root' })
export class ContentService {
  private readonly _data = signal<Modules | null>(null);
  readonly loaded = signal(false);

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const res = await fetch('/api/content', { credentials: 'same-origin' });
      if (res.ok) this._data.set((await res.json()) as Modules);
    } catch {
      // Giu nguyen ban du phong trong bundle.
    } finally {
      this.loaded.set(true);
    }
  }

  /** Lay mot muc noi dung; chua co tu API thi tra ban du phong. */
  pick<T>(module: string, key: string, fallback: T): T {
    const value = this._data()?.[module]?.[key];
    return value === undefined ? fallback : (value as T);
  }
}
