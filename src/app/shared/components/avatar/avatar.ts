import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AvatarService } from '../../../core/services/avatar.service';
import { avatarHue, initials } from '../../util/avatar.util';

/**
 * Anh dai dien dung chung cho ca trang.
 *
 * Co anh that (nguoi do da tai len ho so) thi hien anh; chua co thi lui ve chu
 * cai dau tren nen mau on dinh theo ten — dung cach trang tin van lam tu truoc.
 * `link` bat len thi bam vao mo ho so nguoi do; day la thu noi cac trang roi
 * rac lai voi nhau.
 *
 * Tu style lay o `:host` nen dat o dau cung dung, khong phu thuoc CSS trang cha.
 */
@Component({
  selector: 'app-avatar',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (link() && username()) {
      <a
        class="av"
        [routerLink]="['/profile', username()]"
        [style.--hue]="hue()"
        [attr.title]="name()"
        [attr.aria-label]="name()"
      >
        @if (src()) {
          <img [src]="src()" [alt]="name()" loading="lazy" />
        } @else {
          <span>{{ text() }}</span>
        }
      </a>
    } @else {
      <span class="av" [style.--hue]="hue()" [attr.title]="name()" aria-hidden="true">
        @if (src()) {
          <img [src]="src()" [alt]="name()" loading="lazy" />
        } @else {
          <span>{{ text() }}</span>
        }
      </span>
    }
  `,
  styles: [
    `
      /* Kich thuoc / vien nam o :host chu khong o ben trong, de trang cha van
         chinh duoc bang CSS cua no (vd chong avatar trong facepile). */
      :host {
        display: inline-flex;
        --size: 34px;
        width: var(--size);
        height: var(--size);
        border-radius: 50%;
        overflow: hidden;
        flex-shrink: 0;
      }
      .av {
        width: 100%;
        height: 100%;
        border-radius: 50%;
        overflow: hidden;
        display: grid;
        place-items: center;
        font-size: calc(var(--size) * 0.4);
        font-weight: 800;
        color: #fff;
        text-decoration: none;
        background: hsl(var(--hue, 240), 60%, 55%);
        transition: transform 0.14s ease, box-shadow 0.14s ease;
      }
      a.av:hover {
        transform: translateY(-1px) scale(1.05);
        box-shadow: 0 4px 12px -4px rgba(20, 26, 46, 0.45);
      }
      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
    `,
  ],
  host: { '[style.--size.px]': 'size()' },
})
export class AvatarComponent {
  private readonly avatars = inject(AvatarService);

  readonly name = input('');
  readonly username = input('');
  readonly size = input(34);
  /** Bam vao mo /profile/<username>. */
  readonly link = input(false);

  readonly src = computed(() => this.avatars.urlOf(this.username()));
  readonly text = computed(() => initials(this.name() || this.username()));
  readonly hue = computed(() => avatarHue(this.name() || this.username()));
}
