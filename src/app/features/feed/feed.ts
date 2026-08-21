import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { LanguageService } from '../../core/services/language.service';
import { RailService } from '../../core/services/rail.service';
import { UserService } from '../../core/services/user.service';
import { RailData } from '../../core/models/rail.models';
import { IconComponent } from '../../shared/components/icon/icon';
import { RevealDirective } from '../../shared/directives/reveal.directive';
import { Wall } from '../profile/wall';
import { RailLive } from './rail-live';
import { RailMeCard } from './rail-me';

/**
 * Bang tin — bai tuong ca nhan cua moi nguoi trong cong ty, moi nhat truoc.
 *
 * The bai / cam xuc / binh luan dung LAI y nguyen component `app-wall` o che do
 * 'feed' (xem features/profile/wall.ts) — khong chep giao dien lan thu hai.
 * Dang bai o day = dang len tuong CUA CHINH MINH, roi no hien tren bang tin
 * cua ca cong ty; khong ai viet duoc len tuong nguoi khac.
 *
 * Hai cot ben lay tu MOT lan goi /api/rail (xem server/app/rail.py). Lam moi
 * moi 90 giay va moi lan quay lai tab, chu yeu de o "dang truc tuyen" khong
 * noi doi (presence het han sau 75 giay).
 */
@Component({
  selector: 'app-feed',
  imports: [IconComponent, RevealDirective, Wall, RailLive, RailMeCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="hero" style="padding-block: clamp(34px, 5vw, 52px)">
      <div class="hero-blobs"><span class="blob b1"></span><span class="blob b3"></span></div>
      <div class="container">
        <span class="eyebrow" appReveal><app-icon name="message" /> {{ vi() ? 'Đời sống' : 'Life' }}</span>
        <h1 class="mt-3" appReveal>{{ greeting() }}</h1>
        <p class="lead mt-2" appReveal>
          {{ vi()
            ? 'Bài đăng mới nhất từ đồng nghiệp trong công ty. Bạn viết gì ở đây sẽ lên tường cá nhân của bạn.'
            : 'The latest from your colleagues. What you post here goes to your own wall.' }}
        </p>
      </div>
    </section>

    <section class="section" style="padding-top: 6px">
      <div class="feed-wrap">
        <div class="feed-grid">
          <aside class="col col-left"><app-rail-me [me]="rail()?.me ?? null" /></aside>
          <div class="col col-main"><app-wall [mode]="'feed'" /></div>
          <aside class="col col-right"><app-rail-live [data]="rail()" /></aside>
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      /* Rong hon .container (1180px) vi con hai cot ben; cot giua van giu do
         rong de doc nhu cu. */
      .feed-wrap {
        width: 100%;
        max-width: 1320px;
        margin-inline: auto;
        padding-inline: 22px;
      }
      .feed-grid {
        display: grid;
        gap: 24px;
        justify-content: center;
        align-items: start;
        grid-template-columns: 250px minmax(0, 640px) 320px;
      }
      .col-left {
        order: 1;
        /* Cot trai ngan nen dinh duoc; cot phai dai hon man hinh, dinh vao la
           phan duoi khong keo toi duoc. */
        position: sticky;
        top: calc(var(--nav-h) + 18px);
      }
      .col-main {
        order: 2;
      }
      .col-right {
        order: 3;
      }
      /* Man hinh vua: bo cot trai, giu cot phai (thu dang dien ra dang gia hon). */
      @media (max-width: 1279px) {
        .feed-grid {
          grid-template-columns: minmax(0, 640px) 320px;
        }
        .col-left {
          display: none;
        }
      }
      /* Man hinh hep: mot cot — bang tin truoc, roi cac o ben duoi. */
      @media (max-width: 1023px) {
        .feed-grid {
          grid-template-columns: minmax(0, 680px);
        }
        .col-main {
          order: 1;
        }
        .col-right {
          order: 2;
        }
        .col-left {
          display: block;
          order: 3;
          position: static;
        }
      }
    `,
  ],
})
export class Feed {
  private readonly userSvc = inject(UserService);
  private readonly railSvc = inject(RailService);
  readonly lang = inject(LanguageService).lang;
  readonly vi = computed(() => this.lang() === 'vi');

  readonly rail = signal<RailData | null>(null);

  readonly greeting = computed(() => {
    const name = this.userSvc.fullName();
    if (!name) return this.vi() ? 'Có gì mới ở AVP?' : 'What is new at AVP?';
    // Chi lay ten goi (tu cuoi) cho than mat, dung ca ho ten day du.
    const short = name.trim().split(/\s+/).slice(-1)[0];
    return this.vi() ? `Chào ${short}, có gì mới?` : `Hi ${short}, what is new?`;
  });

  constructor() {
    void this.load();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void this.load();
    }, 90_000);
    const onShow = () => {
      if (document.visibilityState === 'visible') void this.load();
    };
    document.addEventListener('visibilitychange', onShow);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onShow);
    });
  }

  private async load(): Promise<void> {
    const data = await this.railSvc.load();
    // Loi mang thi giu nguyen noi dung dang hien, dung xoa trang cot ben.
    if (data) this.rail.set(data);
  }
}
