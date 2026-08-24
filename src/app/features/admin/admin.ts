import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

import { LanguageService } from '../../core/services/language.service';
import { UserService } from '../../core/services/user.service';
import { IconComponent } from '../../shared/components/icon/icon';
import { AdminStore } from './admin.store';
import { AdminOverview } from './tabs/overview';
import { AdminContent } from './tabs/content';
import { AdminAnalytics } from './tabs/analytics';
import { AdminErrors } from './errors/errors';
import { AdminNews } from './tabs/news';
import { AdminUsers } from './tabs/users';
import { AdminSystem } from './tabs/system';

/** Mot tab tren thanh ben trai. `id` la doan duong dan: /admin/<id>. */
interface Tab {
  id: string;
  icon: string;
  vi: string;
  en: string;
  group?: 'run' | 'watch';
}

const TABS: Tab[] = [
  { id: 'overview', icon: 'grid', vi: 'Tổng quan', en: 'Overview' },
  { id: 'content', icon: 'edit', vi: 'Nội dung', en: 'Content', group: 'run' },
  { id: 'news', icon: 'newspaper', vi: 'Tin tức', en: 'News' },
  { id: 'users', icon: 'users', vi: 'Người dùng', en: 'People' },
  { id: 'analytics', icon: 'zap', vi: 'Lượt truy cập', en: 'Traffic', group: 'watch' },
  { id: 'errors', icon: 'alert-triangle', vi: 'Lỗi ứng dụng', en: 'Errors' },
  { id: 'system', icon: 'settings', vi: 'Hệ thống', en: 'System' },
];

/**
 * Bang dieu khien quan tri — MOT trang, 7 tab.
 *
 * Duong dan la /admin/<tab> chu khong phai trang thai trong bo nho: nguoi quan
 * tri phai gui duoc link "xem cai loi nay" cho nhau, va thong bao loi tu server
 * van tro toi /admin/errors?id=123 nhu cu (xem telemetry.py). /admin tran =
 * tab Tong quan.
 *
 * ViewEncapsulation.None: 7 component tab dung chung admin.scss. Moi selector
 * trong file scss do BAT BUOC bat dau bang `.adm` — xem ghi chu dau file.
 */
@Component({
  selector: 'app-admin',
  imports: [
    RouterLink,
    IconComponent,
    AdminOverview,
    AdminContent,
    AdminAnalytics,
    AdminErrors,
    AdminNews,
    AdminUsers,
    AdminSystem,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  templateUrl: './admin.html',
  styleUrl: './admin.scss',
})
export class Admin {
  private readonly route = inject(ActivatedRoute);
  private readonly user = inject(UserService);
  readonly store = inject(AdminStore);
  readonly lang = inject(LanguageService).lang;

  readonly tabs = TABS;
  readonly canEdit = computed(() => this.user.me()?.canEdit === true);
  readonly ready = computed(() => this.user.me() !== null);

  private readonly params = toSignal(this.route.paramMap);
  readonly tab = computed(() => {
    const t = this.params()?.get('tab') ?? 'overview';
    return TABS.some((x) => x.id === t) ? t : 'overview';
  });

  constructor() {
    void this.store.load();
  }

  label(t: Tab): string {
    return this.lang() === 'vi' ? t.vi : t.en;
  }

  /** Huy hieu ben phai ten tab. 0 = khong ve gi (im lang la trang thai binh thuong). */
  badge(id: string): number {
    if (id === 'errors') return this.store.newErrors();
    if (id === 'overview') return this.store.todoCount();
    return 0;
  }
}
