import { inject, Injectable } from '@angular/core';
import { ApiService } from './api';
import { WallComment, WallPage, WallPost } from '../models/wall.models';

/** Tuong ca nhan: doc/ghi qua /api/wall (cung goc, Kerberos lo o Apache). */
@Injectable({ providedIn: 'root' })
export class WallService {
  /** Moi loi goi API di qua day de duoc do thoi gian va ghi nhan khi hong.
   *  Hanh vi lui ve giu NGUYEN nhu truoc — chi them viec bao cao. */
  private readonly api = inject(ApiService);
  page(owner: string, offset = 0): Promise<WallPage | null> {
    return this.json<WallPage>(`/api/wall/${encodeURIComponent(owner)}?offset=${offset}`);
  }

  /** Bang tin chung: bai tuong cua moi nguoi. scope 'dept' = cung phong ban. */
  feed(scope: 'all' | 'dept' = 'all', offset = 0): Promise<WallPage | null> {
    return this.json<WallPage>(`/api/feed?scope=${scope}&offset=${offset}`);
  }

  create(body: string, image: string): Promise<WallPost | null> {
    return this.json<WallPost>('/api/wall', { method: 'POST', body: { body, image } });
  }

  update(id: number, body: string, image: string): Promise<WallPost | null> {
    return this.json<WallPost>(`/api/wall/${id}`, { method: 'PUT', body: { body, image } });
  }

  remove(id: number): Promise<{ ok: boolean } | null> {
    return this.json(`/api/wall/${id}`, { method: 'DELETE' });
  }

  react(id: number, emoji: string | null): Promise<WallPost | null> {
    return this.json<WallPost>(`/api/wall/${id}/react`, { method: 'POST', body: { emoji } });
  }

  /** Toan bo binh luan cua mot bai — trang chi kem 3 cai moi nhat. */
  async comments(id: number): Promise<WallComment[] | null> {
    const r = await this.json<{ comments: WallComment[] }>(`/api/wall/${id}/comments`);
    return r?.comments ?? null;
  }

  comment(id: number, body: string): Promise<WallPost | null> {
    return this.json<WallPost>(`/api/wall/${id}/comment`, { method: 'POST', body: { body } });
  }

  deleteComment(cid: number): Promise<WallPost | null> {
    return this.json<WallPost>(`/api/wall/comment/${cid}`, { method: 'DELETE' });
  }

  /** Tai anh len truoc, bai viet chi mang duong dan tra ve. */
  async uploadImage(file: File): Promise<{ url: string } | { error: string }> {
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await this.api.fetch('/api/wall/image', {
        method: 'POST',
        credentials: 'same-origin',
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { error: (data as { detail?: string }).detail || 'không tải được ảnh' };
      return { url: (data as { url: string }).url };
    } catch {
      return { error: 'không kết nối được máy chủ' };
    }
  }

  private async json<T>(url: string, init: { method?: string; body?: unknown } = {}): Promise<T | null> {
    try {
      const res = await this.api.fetch(url, {
        credentials: 'same-origin',
        method: init.method ?? 'GET',
        headers: init.body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      });
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch {
      return null;
    }
  }
}
