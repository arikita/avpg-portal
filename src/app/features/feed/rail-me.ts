import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LanguageService } from '../../core/services/language.service';
import { RailMe } from '../../core/models/rail.models';
import { AvatarComponent } from '../../shared/components/avatar/avatar';
import { IconComponent } from '../../shared/components/icon/icon';

/**
 * Cot TRAI trang Doi song: "toi la ai" + loi tat.
 *
 * Chi hien lai thu da co tren ho so (ten, chuc danh, huy hieu, so bai) — cot
 * ben khong tinh toan gi rieng, de hai noi khong bao gio noi hai so khac nhau.
 */
@Component({
  selector: 'app-rail-me',
  imports: [RouterLink, IconComponent, AvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (me(); as m) {
      <section class="card me">
        <div class="cover" [style.background-image]="coverUrl(m.cover)"></div>
        <a class="ava" [routerLink]="['/profile', m.username]" [attr.aria-label]="m.fullName">
          <app-avatar [username]="m.username" [name]="m.fullName" [size]="66" />
        </a>
        <a class="nm" [routerLink]="['/profile', m.username]">{{ m.fullName }}</a>
        @if (m.title) {
          <p class="role">{{ m.title }}</p>
        }
        @if (m.department) {
          <p class="dept"><app-icon name="briefcase" /> {{ m.department }}</p>
        }

        @if (m.badges.length) {
          <div class="badges">
            @for (b of m.badges; track b.id) {
              <span class="bdg" [class]="'bdg ' + b.tone">
                <app-icon [name]="b.icon" /> {{ b.label[lang()] }}
              </span>
            }
          </div>
        }

        <div class="stats">
          <div>
            <b>{{ m.posts }}</b><span>{{ vi() ? 'bài viết' : 'posts' }}</span>
          </div>
          <div>
            <b>{{ m.reactions }}</b><span>{{ vi() ? 'cảm xúc' : 'reactions' }}</span>
          </div>
        </div>

        <a class="btn btn-soft btn-sm btn-block" [routerLink]="['/profile', m.username]">
          <app-icon name="user" /> {{ vi() ? 'Tường của tôi' : 'My wall' }}
        </a>
      </section>
    }

    <nav class="card links" [attr.aria-label]="vi() ? 'Lối tắt' : 'Shortcuts'">
      @for (l of links(); track l.path) {
        <a [routerLink]="l.path"><app-icon [name]="l.icon" /> {{ l.label }}</a>
      }
    </nav>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .card + .card {
        margin-top: 16px;
      }
      .me {
        padding: 0 18px 18px;
        text-align: center;
        overflow: hidden;
      }
      /* Anh bia ho so; chua dat anh thi dung gradient thuong hieu. */
      .cover {
        margin: 0 -18px 0;
        height: 76px;
        background: var(--grad-brand);
        background-size: cover;
        background-position: center;
      }
      .ava {
        display: inline-block;
        margin-top: -34px;
        border-radius: 50%;
        padding: 3px;
        background: var(--surface);
        line-height: 0;
      }
      .nm {
        display: block;
        margin-top: 8px;
        font-weight: 800;
        color: var(--text);
        text-decoration: none;
      }
      .nm:hover {
        color: var(--brand);
      }
      .role {
        margin-top: 2px;
        font-size: 0.85rem;
        color: var(--text-2);
      }
      .dept {
        margin-top: 4px;
        font-size: 0.8rem;
        color: var(--text-3);
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
      }
      .dept svg,
      .bdg svg {
        width: 13px;
        height: 13px;
      }
      .badges {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 6px;
        margin-top: 12px;
      }
      .bdg {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 9px;
        border-radius: var(--pill);
        font-size: 0.72rem;
        font-weight: 700;
        background: color-mix(in srgb, var(--brand) 12%, transparent);
        color: var(--brand);
      }
      .bdg.amber {
        background: color-mix(in srgb, var(--warning) 16%, transparent);
        color: color-mix(in srgb, var(--warning) 85%, var(--text));
      }
      .bdg.teal {
        background: color-mix(in srgb, var(--accent) 16%, transparent);
        color: color-mix(in srgb, var(--accent) 85%, var(--text));
      }
      .bdg.violet {
        background: color-mix(in srgb, var(--violet) 16%, transparent);
        color: var(--violet);
      }
      .bdg.rose {
        background: color-mix(in srgb, var(--danger) 14%, transparent);
        color: var(--danger);
      }
      .bdg.cyan {
        background: color-mix(in srgb, var(--cyan) 18%, transparent);
        color: color-mix(in srgb, var(--cyan) 80%, var(--text));
      }
      .bdg.green {
        background: color-mix(in srgb, var(--success) 16%, transparent);
        color: color-mix(in srgb, var(--success) 85%, var(--text));
      }
      .stats {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin: 14px 0 12px;
        padding: 10px 0;
        border-block: 1px solid var(--border);
      }
      .stats b {
        display: block;
        font-size: 1.1rem;
        color: var(--text);
      }
      .stats span {
        font-size: 0.74rem;
        color: var(--text-3);
      }
      .links {
        padding: 8px;
      }
      .links a {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 9px 12px;
        border-radius: var(--r-sm);
        color: var(--text-2);
        font-size: 0.9rem;
        font-weight: 600;
        text-decoration: none;
        transition: background 0.14s ease, color 0.14s ease;
      }
      .links a:hover {
        background: var(--surface-2);
        color: var(--brand);
      }
      .links svg {
        width: 17px;
        height: 17px;
      }
    `,
  ],
})
export class RailMeCard {
  readonly me = input<RailMe | null>(null);
  readonly lang = inject(LanguageService).lang;
  readonly vi = computed(() => this.lang() === 'vi');

  readonly links = computed(() =>
    this.vi()
      ? [
          { path: '/news', icon: 'newspaper', label: 'Tin tức' },
          { path: '/directory', icon: 'users', label: 'Danh bạ' },
          { path: '/gallery', icon: 'images', label: 'Hình ảnh' },
          { path: '/chat', icon: 'message', label: 'Trò chuyện' },
        ]
      : [
          { path: '/news', icon: 'newspaper', label: 'News' },
          { path: '/directory', icon: 'users', label: 'Directory' },
          { path: '/gallery', icon: 'images', label: 'Photos' },
          { path: '/chat', icon: 'message', label: 'Chat' },
        ],
  );

  coverUrl(cover: string): string | null {
    return cover ? `url(${cover})` : null;
  }
}
