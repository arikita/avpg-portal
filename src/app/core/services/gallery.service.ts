import { inject, Injectable } from '@angular/core';
import { ApiService } from './api';
import { L } from '../models/content.models';

/** Mot album anh su kien. */
export interface Album {
  slug: string;
  title: L;
  desc: L;
  date: string;
  count: number;
  cover: string;
}

export interface Photo {
  thumb: string;
  full: string;
  w: number;
  h: number;
}

export interface AlbumDetail extends Album {
  photos: Photo[];
}

/** Goi API thu vien anh (/api/gallery). Xac thuc do Apache+Kerberos lo. */
@Injectable({ providedIn: 'root' })
export class GalleryService {
  /** Moi loi goi API di qua day de duoc do thoi gian va ghi nhan khi hong.
   *  Hanh vi lui ve giu NGUYEN nhu truoc — chi them viec bao cao. */
  private readonly api = inject(ApiService);
  private async req<T>(url: string): Promise<T> {
    const res = await this.api.fetch(url, { credentials: 'same-origin' });
    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        detail = (await res.json())?.detail ?? detail;
      } catch {
        /* body khong phai JSON */
      }
      throw new Error(detail);
    }
    return (await res.json()) as T;
  }

  albums(): Promise<{ albums: Album[] }> {
    return this.req<{ albums: Album[] }>('/api/gallery');
  }

  album(slug: string): Promise<AlbumDetail> {
    return this.req<AlbumDetail>(`/api/gallery/${encodeURIComponent(slug)}`);
  }
}
