import { Injectable } from '@angular/core';
import { NewsComment, NewsDraft, NewsFeed, NewsPost, NewsReactions, NotifFeed, Poll } from '../models/news.models';

/**
 * Goi API tin tuc (/api/news/*). Xac thuc do Apache+Kerberos lo, fetch chi can
 * credentials 'same-origin'. Moi ham nem loi khi HTTP != 2xx de component bat.
 */
@Injectable({ providedIn: 'root' })
export class NewsService {
  private async req<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, { credentials: 'same-origin', ...init });
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

  private json(method: string, body: unknown): RequestInit {
    return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
  }

  feed(category?: string, peek = false, query?: string): Promise<NewsFeed> {
    const p = new URLSearchParams();
    if (category) p.set('category', category);
    if (query?.trim()) p.set('q', query.trim());
    if (peek) p.set('peek', '1');
    const q = p.toString();
    return this.req<NewsFeed>(`/api/news${q ? '?' + q : ''}`);
  }

  get(id: number): Promise<NewsPost> {
    return this.req<NewsPost>(`/api/news/${id}`);
  }

  create(draft: NewsDraft): Promise<NewsPost> {
    return this.req<NewsPost>('/api/news', this.json('POST', draft));
  }

  update(id: number, draft: NewsDraft): Promise<NewsPost> {
    return this.req<NewsPost>(`/api/news/${id}`, this.json('PUT', draft));
  }

  remove(id: number): Promise<{ ok: boolean }> {
    return this.req(`/api/news/${id}`, { method: 'DELETE' });
  }

  pin(id: number): Promise<{ pinned: boolean }> {
    return this.req(`/api/news/${id}/pin`, { method: 'POST' });
  }

  react(id: number, emoji: string | null): Promise<NewsReactions> {
    return this.req<NewsReactions>(`/api/news/${id}/react`, this.json('POST', { emoji }));
  }

  addComment(id: number, body: string, parentId?: number | null): Promise<{ comments: NewsComment[] }> {
    return this.req(`/api/news/${id}/comment`, this.json('POST', { body, parentId: parentId ?? null }));
  }

  editComment(cid: number, body: string): Promise<{ comments: NewsComment[] }> {
    return this.req(`/api/news/comment/${cid}`, this.json('PUT', { body }));
  }

  deleteComment(cid: number): Promise<{ comments: NewsComment[] }> {
    return this.req(`/api/news/comment/${cid}`, { method: 'DELETE' });
  }

  /** Bo phieu cho mot cau hoi; tra ve toan bo cac cau hoi cua bai. */
  vote(postId: number, pollId: number, optionIds: number[]): Promise<{ polls: Poll[] }> {
    return this.req(`/api/news/${postId}/poll/${pollId}/vote`, this.json('POST', { optionIds }));
  }

  /** Nguoi binh chon tu them mot phuong an (chi khi tac gia cho phep). */
  addPollOption(postId: number, pollId: number, label: string): Promise<{ polls: Poll[] }> {
    return this.req(`/api/news/${postId}/poll/${pollId}/option`, this.json('POST', { label }));
  }

  /** Sua binh chon cua bai da dang (chi tac gia / IS). */
  updatePolls(postId: number, polls: unknown[]): Promise<{ polls: Poll[] }> {
    return this.req(`/api/news/${postId}/polls`, this.json('PUT', { polls }));
  }

  notifications(): Promise<NotifFeed> {
    return this.req<NotifFeed>('/api/notifications');
  }

  markNotifRead(ids?: number[]): Promise<{ ok: boolean }> {
    return this.req('/api/notifications/read', this.json('POST', ids ? { ids } : {}));
  }

  pushKey(): Promise<{ key: string; enabled: boolean }> {
    return this.req('/api/push/key');
  }

  pushSubscribe(sub: unknown): Promise<{ ok: boolean }> {
    return this.req('/api/push/subscribe', this.json('POST', sub));
  }

  pushUnsubscribe(endpoint: string): Promise<{ ok: boolean }> {
    return this.req('/api/push/unsubscribe', this.json('POST', { endpoint }));
  }

  async upload(file: File): Promise<string> {
    return (await this.uploadFile(file)).url;
  }

  /** Tai len anh hoac file dinh kem; tra ve dia chi + ten goc de hien thi. */
  async uploadFile(file: File): Promise<{ url: string; name: string }> {
    const fd = new FormData();
    fd.append('file', file);
    return this.req<{ url: string; name: string }>('/api/news/upload',
      { method: 'POST', body: fd });
  }
}
