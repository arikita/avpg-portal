import { inject, signal, Injectable } from '@angular/core';
import { ApiService } from './api';

export interface AdContact {
  name: string;
  username: string;
  ext: string;
  email: string;
  title: string;
}
export interface AdDepartment {
  name: string;
  count: number;
  contacts: AdContact[];
}
export interface AdDirectory {
  departments: AdDepartment[];
  total: number;
  withExt: number;
  updatedAt: number;
}

/** Danh ba lay truc tiep tu Active Directory qua /api/directory. */
@Injectable({ providedIn: 'root' })
export class DirectoryService {
  /** Moi loi goi API di qua day de duoc do thoi gian va ghi nhan khi hong.
   *  Hanh vi lui ve giu NGUYEN nhu truoc — chi them viec bao cao. */
  private readonly api = inject(ApiService);
  private readonly _data = signal<AdDirectory | null>(null);
  private readonly _loading = signal(true);

  readonly data = this._data.asReadonly();
  readonly loading = this._loading.asReadonly();

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const res = await this.api.fetch('/api/directory', { credentials: 'same-origin' });
      if (res.ok) this._data.set(await res.json());
    } catch {
      // Khong tai duoc thi danh ba rong, phan con lai cua trang van chay.
    } finally {
      this._loading.set(false);
    }
  }
}
