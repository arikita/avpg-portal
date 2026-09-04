import { inject, Injectable } from '@angular/core';
import { ApiService } from './api';
import { L } from '../models/content.models';

/** Mot album anh su kien. */
export interface Album {
  slug: string;
  title: L;
  desc: L;
  date: string;
  /** Nhan de loc: su-kien / the-thao / dao-tao / nha-may / khac. */
  label: string;
  /** Co the tren trang danh sach: noibat (ca hang) / thuong / gon.
   *  Marketing tu chon cho TUNG album — xem ghi chu SIZES trong gallery.py. */
  size: string;
  /** public | draft | hidden — nhap/an chi nguoi quan ly thay. */
  status: string;
  order: number;
  count: number;
  cover: string;
  /** Toi 4 anh de ghep mosaic bia. Mot album 1687 anh ma dai dien bang dung
   *  mot tam thi phi. */
  covers: string[];
  featured: string[];
}

export interface Photo {
  id: string;
  thumb: string;
  full: string;
  /** Duong tai anh GOC tu file server; rong = share dang khong doc duoc. */
  orig: string;
  w: number;
  h: number;
  /** Ngay chup YYYY-MM-DD, '' neu anh khong ghi EXIF. */
  day: string;
  star: boolean;
}

export interface AlbumDetail extends Album {
  photos: Photo[];
}

export interface AlbumList {
  albums: Album[];
  canManage: boolean;
  labels: string[];
  sizes: string[];
}

/** Tien do sinh thumb cua mot album. */
export interface Job {
  state: 'idle' | 'running' | 'done' | 'error';
  done?: number;
  total?: number;
  detail?: string;
}

export interface ManageAlbum extends Album {
  src: string;
  job: Job;
  thumbs: number;
}

export interface SourceDir {
  name: string;
  path: string;
  /** So anh trong thu muc; -1 = khong doc duoc. */
  images: number;
  /** Slug cua album da tao tu thu muc nay, '' neu chua. */
  album: string;
}

/** Goi API thu vien anh (/api/gallery). Xac thuc do Apache+Kerberos lo. */
@Injectable({ providedIn: 'root' })
export class GalleryService {
  /** Moi loi goi API di qua day de duoc do thoi gian va ghi nhan khi hong.
   *  Hanh vi lui ve giu NGUYEN nhu truoc — chi them viec bao cao. */
  private readonly api = inject(ApiService);

  private async req<T>(url: string, init: RequestInit = {}): Promise<T> {
    const res = await this.api.fetch(url, { credentials: 'same-origin', ...init });
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

  private send<T>(url: string, method: string, body?: unknown): Promise<T> {
    return this.req<T>(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  albums(): Promise<AlbumList> {
    return this.req<AlbumList>('/api/gallery');
  }

  album(slug: string): Promise<AlbumDetail> {
    return this.req<AlbumDetail>(`/api/gallery/${encodeURIComponent(slug)}`);
  }

  // ------------------------------------------------------------ quan ly --
  manageList(): Promise<{ albums: ManageAlbum[]; labels: string[]; sizes: string[] }> {
    return this.req('/api/gallery/manage/albums');
  }

  sources(path: string): Promise<{ path: string; images: number; album: string; dirs: SourceDir[] }> {
    return this.req(`/api/gallery/manage/sources?path=${encodeURIComponent(path)}`);
  }

  create(body: Record<string, unknown>): Promise<{ ok: boolean; slug: string }> {
    return this.send('/api/gallery/manage/albums', 'POST', body);
  }

  update(slug: string, body: Record<string, unknown>): Promise<{ ok: boolean }> {
    return this.send(`/api/gallery/manage/albums/${encodeURIComponent(slug)}`, 'PUT', body);
  }

  remove(slug: string): Promise<{ ok: boolean }> {
    return this.send(`/api/gallery/manage/albums/${encodeURIComponent(slug)}`, 'DELETE');
  }

  reindex(slug: string): Promise<{ ok: boolean }> {
    return this.send(`/api/gallery/manage/albums/${encodeURIComponent(slug)}/reindex`, 'POST');
  }

  job(slug: string): Promise<Job> {
    return this.req(`/api/gallery/manage/albums/${encodeURIComponent(slug)}/job`);
  }
}
