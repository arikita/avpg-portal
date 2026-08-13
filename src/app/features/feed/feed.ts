import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { LanguageService } from '../../core/services/language.service';
import { UserService } from '../../core/services/user.service';
import { IconComponent } from '../../shared/components/icon/icon';
import { RevealDirective } from '../../shared/directives/reveal.directive';
import { Wall } from '../profile/wall';

/**
 * Bang tin — bai tuong ca nhan cua moi nguoi trong cong ty, moi nhat truoc.
 *
 * The bai / cam xuc / binh luan dung LAI y nguyen component `app-wall` o che do
 * 'feed' (xem features/profile/wall.ts) — khong chep giao dien lan thu hai.
 * Dang bai o day = dang len tuong CUA CHINH MINH, roi no hien tren bang tin
 * cua ca cong ty; khong ai viet duoc len tuong nguoi khac.
 */
@Component({
  selector: 'app-feed',
  imports: [IconComponent, RevealDirective, Wall],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="hero" style="padding-block: clamp(34px, 5vw, 52px)">
      <div class="hero-blobs"><span class="blob b1"></span><span class="blob b3"></span></div>
      <div class="container">
        <span class="eyebrow" appReveal><app-icon name="message" /> {{ vi() ? 'Bảng tin' : 'Feed' }}</span>
        <h1 class="mt-3" appReveal>{{ greeting() }}</h1>
        <p class="lead mt-2" appReveal>
          {{ vi()
            ? 'Bài đăng mới nhất từ đồng nghiệp trong công ty. Bạn viết gì ở đây sẽ lên tường cá nhân của bạn.'
            : 'The latest from your colleagues. What you post here goes to your own wall.' }}
        </p>
      </div>
    </section>

    <section class="section" style="padding-top: 6px">
      <div class="container narrow">
        <app-wall [mode]="'feed'" />
      </div>
    </section>
  `,
  styles: [
    `
      /* Bang tin doc de chiu nhat o mot cot hep, khong tran het be ngang. */
      .narrow { max-width: 720px; }
    `,
  ],
})
export class Feed {
  private readonly userSvc = inject(UserService);
  readonly lang = inject(LanguageService).lang;
  readonly vi = computed(() => this.lang() === 'vi');

  readonly greeting = computed(() => {
    const name = this.userSvc.fullName();
    if (!name) return this.vi() ? 'Có gì mới ở AVP?' : 'What is new at AVP?';
    // Chi lay ten goi (tu cuoi) cho than mat, dung ca ho ten day du.
    const short = name.trim().split(/\s+/).slice(-1)[0];
    return this.vi() ? `Chào ${short}, có gì mới?` : `Hi ${short}, what is new?`;
  });
}
