import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { Notification as NotifItem } from '../models/news.models';
import { LanguageService } from './language.service';
import { NewsService } from './news.service';

type DesktopState = 'default' | 'granted' | 'denied' | 'unsupported';

/** Chuyen applicationServerKey (base64url) sang Uint8Array cho pushManager. */
function urlB64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Trang thai thong bao + badge "NEW" cho navbar, poll dinh ky de keo nguoi
 * dung quay lai. Ho tro day toast len Windows (Notification API cua trinh
 * duyet) khi tab con chay — bam vao toast se nhay toi bai.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly svc = inject(NewsService);
  private readonly router = inject(Router);
  private readonly langSvc = inject(LanguageService);

  readonly items = signal<NotifItem[]>([]);
  readonly unread = signal(0);
  readonly unseenNews = signal(0);
  readonly desktopState = signal<DesktopState>('unsupported');
  /** True khi da subscribe Web Push => de push lo, khong toast trung trong tab. */
  readonly pushOn = signal(false);

  private lastMaxId = -1; // -1 = chua nap lan nao (khong toast dot dau)
  private pushReady = false;

  constructor() {
    if (typeof Notification !== 'undefined') {
      this.desktopState.set(Notification.permission as DesktopState);
      if (this.desktopState() === 'granted') void this.setupPush();
    }
    void this.refresh();
    setInterval(() => void this.refresh(), 60000);
  }

  /** Dang ky service worker + Web Push subscription (chay khi dong tab). */
  async setupPush(): Promise<void> {
    if (this.pushReady) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    try {
      const info = await this.svc.pushKey();
      if (!info.enabled || !info.key) return; // server chua bat push => dung in-tab
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlB64ToUint8Array(info.key) as BufferSource,
        });
      }
      await this.svc.pushSubscribe(sub.toJSON());
      this.pushOn.set(true);
      this.pushReady = true;
    } catch {
      /* that bai thi giu in-tab toast lam fallback */
    }
  }

  async refresh(): Promise<void> {
    try {
      const f = await this.svc.notifications();
      this.items.set(f.items);
      this.unread.set(f.unread);
      this.unseenNews.set(f.unseenNews);
      const maxId = f.items.length ? Math.max(...f.items.map((i) => i.id)) : 0;
      // Push lo viec bao khi da subscribe => chi toast in-tab khi CHUA co push.
      if (this.lastMaxId >= 0 && maxId > this.lastMaxId
          && this.desktopState() === 'granted' && !this.pushOn()) {
        // Toast cho cai moi (cu -> moi), gioi han 3 cho khoi spam.
        f.items
          .filter((i) => i.id > this.lastMaxId && !i.read)
          .slice(0, 3)
          .reverse()
          .forEach((n) => this.toast(n));
      }
      this.lastMaxId = Math.max(this.lastMaxId, maxId);
    } catch {
      /* bo qua */
    }
  }

  /** Xin quyen hien thong bao tren may (goi tu nut, la cu chi cua user). */
  async enableDesktop(): Promise<void> {
    if (typeof Notification === 'undefined') return;
    try {
      const p = await Notification.requestPermission();
      this.desktopState.set(p as DesktopState);
      if (p === 'granted') await this.setupPush();
    } catch {
      /* bo qua */
    }
  }

  private toast(n: NotifItem): void {
    try {
      const t = new Notification('AVP Portal', {
        body: `${n.actorName} ${this.text(n)}`,
        icon: '/img/brand/icon-192.png',
        tag: n.postId ? `avp-${n.type}-${n.postId}` : `avp-n-${n.id}`,
      });
      t.onclick = () => {
        window.focus();
        // Bai tuong mang duong dan rieng; con lai van la bai tin.
        if (n.url) void this.router.navigateByUrl(n.url);
        else if (n.postId) void this.router.navigate(['/news', n.postId]);
        t.close();
      };
    } catch {
      /* trinh duyet chan thi thoi */
    }
  }

  /** Cau hanh dong (KHONG kem ten actor — de cho cho <b>ten</b> o navbar). */
  text(n: NotifItem): string {
    const vi = this.langSvc.lang() === 'vi';
    if (n.type === 'wall_reaction') {
      const extra = (n.count ?? 1) - 1;
      const pre = extra > 0 ? (vi ? `và ${extra} người khác ` : `and ${extra} others `) : '';
      return vi ? `${pre}đã bày tỏ cảm xúc bài trên tường của bạn`
                : `${pre}reacted to your wall post`;
    }
    if (n.type === 'wall_comment') {
      return vi ? 'đã bình luận bài trên tường của bạn' : 'commented on your wall post';
    }
    if (n.type === 'reaction') {
      const extra = (n.count ?? 1) - 1;
      const pre = extra > 0 ? (vi ? `và ${extra} người khác ` : `and ${extra} others `) : '';
      return vi ? `${pre}đã bày tỏ cảm xúc bài của bạn` : `${pre}reacted to your post`;
    }
    if (n.type === 'post_published') {
      return vi ? 'đã đăng bài hẹn giờ của bạn' : 'published your scheduled post';
    }
    if (n.type === 'reply') {
      return vi ? 'đã trả lời bình luận của bạn' : 'replied to your comment';
    }
    return vi ? 'đã bình luận bài của bạn' : 'commented on your post';
  }

  async markAllRead(): Promise<void> {
    if (!this.unread()) return;
    this.unread.set(0);
    this.items.update((xs) => xs.map((x) => ({ ...x, read: true })));
    try {
      await this.svc.markNotifRead();
    } catch {
      void this.refresh();
    }
  }

  clearNewsBadge(): void {
    this.unseenNews.set(0);
  }
}
