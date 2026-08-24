import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ApiService } from '../../../core/services/api';
import { LanguageService } from '../../../core/services/language.service';
import { IconComponent } from '../../../shared/components/icon/icon';
import { AdmBars, Point } from '../charts';
import { ago } from '../admin.store';

interface Admin {
  username: string;
  fullName: string;
  department: string;
  title: string;
  mail: string;
  moderator: boolean;
}

interface Users {
  admins: Admin[];
  online: string[];
  active: { username: string; views: number; days: number; last: string }[];
  contributors: { username: string; name: string; posts: number }[];
  days: number;
  pushUsers: number;
  profilesWithAvatar: number;
}

/**
 * Tab "Nguoi dung" — ai co quyen gi, va ai dang thuc su dung portal.
 *
 * BA loai quyen o portal nay la BA nguon khac nhau, va trang co y noi ro dieu
 * do vi da tung nham:
 *   - vao trang quan tri  : allowlist env CONTENT_ADMIN_USERS tren .136
 *   - kiem duyet tin tuc  : group AD "Information System"
 *   - dang tin            : group AD HR / Marketing / IS
 * Khong the cap quyen tu trang web — sua allowlist la sua file env roi khoi
 * dong lai dich vu. Trang chi HIEN trang thai, va noi ro cach doi.
 */
@Component({
  selector: 'app-admin-users',
  imports: [RouterLink, IconComponent, AdmBars],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './users.html',
})
export class AdminUsers {
  private readonly api = inject(ApiService);
  readonly lang = inject(LanguageService).lang;
  readonly vi = computed(() => this.lang() === 'vi');

  readonly data = signal<Users | null>(null);
  readonly loading = signal(false);

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.data.set(await this.api.json<Users>('/api/admin/users?days=30'));
    this.loading.set(false);
  }

  ago = ago;

  readonly contributorBars = computed<Point[]>(() =>
    (this.data()?.contributors ?? []).map((c) => ({ label: c.name || c.username, value: c.posts })),
  );
}
