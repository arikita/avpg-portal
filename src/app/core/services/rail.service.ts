import { inject, Injectable } from '@angular/core';
import { ApiService } from './api';
import { RailData } from '../models/rail.models';

/** Doc noi dung hai cot ben cua /feed (/api/rail). Loi thi tra null, trang van chay. */
@Injectable({ providedIn: 'root' })
export class RailService {
  /** Moi loi goi API di qua day de duoc do thoi gian va ghi nhan khi hong.
   *  Hanh vi lui ve giu NGUYEN nhu truoc — chi them viec bao cao. */
  private readonly api = inject(ApiService);
  async load(): Promise<RailData | null> {
    try {
      const res = await this.api.fetch('/api/rail', { credentials: 'same-origin' });
      if (!res.ok) return null;
      return (await res.json()) as RailData;
    } catch {
      return null;
    }
  }
}
