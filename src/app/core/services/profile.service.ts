import { Injectable, inject } from '@angular/core';
import { ApiService } from './api';
import { Activity, Profile } from '../models/profile.models';
import { AvatarService } from './avatar.service';

/** Ho so ca nhan: doc /api/profile, ghi chi duoc ho so cua chinh minh. */
@Injectable({ providedIn: 'root' })
export class ProfileService {
  /** Moi loi goi API di qua day de duoc do thoi gian va ghi nhan khi hong.
   *  Hanh vi lui ve giu NGUYEN nhu truoc — chi them viec bao cao. */
  private readonly api = inject(ApiService);
  private readonly avatars = inject(AvatarService);

  /** 'me' = chinh minh. */
  async get(username: string): Promise<Profile | null> {
    return this.json<Profile>(`/api/profile/${encodeURIComponent(username)}`);
  }

  async activity(username: string, offset: number): Promise<{ activity: Activity[]; activityMore: boolean } | null> {
    return this.json(`/api/profile/${encodeURIComponent(username)}/activity?offset=${offset}`);
  }

  /** Luu ho so cua chinh minh; server tra ve ho so da luu. */
  async save(patch: Partial<Pick<Profile, 'headline' | 'bio' | 'accent' | 'interests'>>): Promise<Profile | null> {
    return this.json<Profile>('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
  }

  /** Doi anh dai dien / anh bia. Tra ve duong dan moi, null neu that bai. */
  async uploadPhoto(kind: 'avatar' | 'cover', file: File): Promise<{ url: string } | { error: string }> {
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await this.api.fetch(`/api/profile/photo/${kind}`, {
        method: 'POST',
        credentials: 'same-origin',
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { error: (data as { detail?: string }).detail || 'không tải được ảnh' };
      if (kind === 'avatar') await this.avatars.refresh();
      return { url: (data as { url: string }).url };
    } catch {
      return { error: 'không kết nối được máy chủ' };
    }
  }

  async removePhoto(kind: 'avatar' | 'cover'): Promise<boolean> {
    const ok = (await this.json(`/api/profile/photo/${kind}`, { method: 'DELETE' })) !== null;
    if (ok && kind === 'avatar') await this.avatars.refresh();
    return ok;
  }

  private async json<T>(url: string, init: RequestInit = {}): Promise<T | null> {
    try {
      const res = await this.api.fetch(url, { credentials: 'same-origin', ...init });
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch {
      return null;
    }
  }
}
