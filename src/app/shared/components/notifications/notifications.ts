import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { Notification } from '../../../core/models/news.models';
import { LanguageService } from '../../../core/services/language.service';
import { NotificationService } from '../../../core/services/notification.service';
import { relTime } from '../../../features/news/news.util';
import { IconComponent } from '../icon/icon';

/** Chuong thong bao tren navbar: so chua doc + danh sach + dan toi bai. */
@Component({
  selector: 'app-notifications',
  imports: [IconComponent],
  template: `
    <div class="notif">
      <button class="icon-btn" (click)="toggle()" [attr.aria-label]="lang() === 'vi' ? 'Thông báo' : 'Notifications'">
        <app-icon name="bell" />
        @if (unread()) { <span class="notif-dot">{{ unread() > 9 ? '9+' : unread() }}</span> }
      </button>

      @if (open()) {
        <div class="notif-backdrop" (click)="close()"></div>
        <div class="notif-panel" role="menu">
          <div class="notif-head">
            <strong>{{ lang() === 'vi' ? 'Thông báo' : 'Notifications' }}</strong>
            @if (unread()) { <button class="link" (click)="markAll()">{{ lang() === 'vi' ? 'Đánh dấu đã đọc' : 'Mark all read' }}</button> }
          </div>
          @if (desktopState() === 'default') {
            <button class="notif-enable" (click)="enableDesktop()">
              <app-icon name="bell" /> {{ lang() === 'vi' ? 'Bật thông báo trên máy tính' : 'Enable desktop notifications' }}
            </button>
          }
          @if (!items().length) {
            <p class="notif-empty">{{ lang() === 'vi' ? 'Chưa có thông báo.' : 'No notifications yet.' }}</p>
          } @else {
            @for (n of items(); track n.id) {
              <button class="notif-item" [class.unread]="!n.read" (click)="go(n)">
                <span class="ni-icon" [attr.data-type]="n.type"><app-icon [name]="iconOf(n)" /></span>
                <span class="ni-body">
                  <span class="ni-text"><b>{{ n.actorName }}</b> {{ text(n) }}</span>
                  @if (n.snippet) { <span class="ni-snip">“{{ n.snippet }}”</span> }
                  <time>{{ rel(n.createdAt) }}</time>
                </span>
              </button>
            }
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .notif { position: relative; display: inline-flex; }
    .notif-dot {
      position: absolute; top: -3px; right: -3px; min-width: 17px; height: 17px; padding: 0 4px;
      border-radius: 999px; background: #e0563c; color: #fff; font-size: .66rem; font-weight: 800;
      display: grid; place-items: center; box-shadow: 0 0 0 2px var(--surface);
    }
    .notif-backdrop { position: fixed; inset: 0; z-index: 90; }
    .notif-panel {
      position: absolute; top: calc(100% + 10px); right: 0; z-index: 100; width: 340px; max-width: 88vw;
      max-height: 70vh; overflow-y: auto; background: var(--surface); border: 1px solid var(--border);
      border-radius: var(--r); box-shadow: var(--shadow-lg); padding: 6px;
    }
    .notif-head { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px 6px; }
    .notif-head .link { background: none; border: none; color: var(--brand); font-weight: 700; font-size: .82rem; cursor: pointer; }
    .notif-enable {
      display: flex; align-items: center; gap: 8px; width: calc(100% - 12px); margin: 0 6px 6px;
      padding: 9px 12px; border-radius: var(--r-sm); cursor: pointer;
      border: 1px dashed var(--brand); background: color-mix(in srgb, var(--brand) 8%, transparent);
      color: var(--brand); font-weight: 700; font-size: .82rem;
    }
    .notif-enable app-icon { width: 15px; height: 15px; }
    .notif-enable:hover { background: color-mix(in srgb, var(--brand) 15%, transparent); }
    .notif-empty { color: var(--text-3); text-align: center; padding: 22px 10px; font-style: italic; }
    .notif-item {
      display: flex; gap: 10px; width: 100%; text-align: left; padding: 10px; border: none; cursor: pointer;
      background: transparent; border-radius: var(--r-sm); transition: background .14s;
    }
    .notif-item:hover { background: var(--surface-2); }
    .notif-item.unread { background: color-mix(in srgb, var(--brand) 8%, transparent); }
    .ni-icon { width: 30px; height: 30px; flex-shrink: 0; border-radius: 50%; display: grid; place-items: center; color: #fff; background: var(--brand); }
    .ni-icon app-icon { width: 15px; height: 15px; }
    .ni-icon[data-type='reaction'], .ni-icon[data-type='wall_reaction'] { background: #e0563c; }
    .ni-icon[data-type='wall_comment'] { background: #7a5af0; }
    .ni-icon[data-type='reply'] { background: #2fa36b; }
    .ni-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .ni-text { color: var(--text); font-size: .88rem; line-height: 1.4; }
    .ni-snip { color: var(--text-2); font-size: .82rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ni-body time { color: var(--text-3); font-size: .74rem; }
  `],
})
export class NotificationsBell {
  private readonly notif = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly langSvc = inject(LanguageService);
  readonly lang = this.langSvc.lang;

  readonly items = this.notif.items;
  readonly unread = this.notif.unread;
  readonly desktopState = this.notif.desktopState;
  readonly open = signal(false);

  toggle(): void {
    this.open.update((v) => !v);
    if (this.open()) void this.notif.refresh();
  }
  close(): void {
    this.open.set(false);
  }

  iconOf(n: Notification): string {
    return n.type === 'reaction' || n.type === 'wall_reaction' ? 'heart' : 'message';
  }

  text(n: Notification): string {
    return this.notif.text(n);
  }

  enableDesktop(): void {
    void this.notif.enableDesktop();
  }

  rel(iso: string): string {
    return relTime(iso, this.lang());
  }

  go(n: Notification): void {
    this.close();
    void this.notif.markAllRead();
    // Bai tuong ca nhan khong nam o /news/<id> nen mang duong dan rieng.
    if (n.url) void this.router.navigateByUrl(n.url);
    else if (n.postId) void this.router.navigate(['/news', n.postId]);
  }

  markAll(): void {
    void this.notif.markAllRead();
  }
}
