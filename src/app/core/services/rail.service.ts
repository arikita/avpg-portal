import { Injectable } from '@angular/core';
import { RailData } from '../models/rail.models';

/** Doc noi dung hai cot ben cua /feed (/api/rail). Loi thi tra null, trang van chay. */
@Injectable({ providedIn: 'root' })
export class RailService {
  async load(): Promise<RailData | null> {
    try {
      const res = await fetch('/api/rail', { credentials: 'same-origin' });
      if (!res.ok) return null;
      return (await res.json()) as RailData;
    } catch {
      return null;
    }
  }
}
