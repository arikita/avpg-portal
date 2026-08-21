import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SITE } from '../../content/site.config';
import { QUICK_LINKS, STATS, VALUES } from '../../content/home.content';
import { HELPDESK_PORTAL_URL } from '../../content/help.content';
import { SECTIONS } from '../../content/onboarding.content';
import { ContentService } from '../../core/services/content.service';
import { LanguageService } from '../../core/services/language.service';
import { UserService } from '../../core/services/user.service';
import { NewsService } from '../../core/services/news.service';
import { NewsPost } from '../../core/models/news.models';
import { relTime } from '../news/news.util';
import { TrPipe } from '../../shared/pipes/tr.pipe';
import { IconComponent } from '../../shared/components/icon/icon';
import { RevealDirective } from '../../shared/directives/reveal.directive';

@Component({
  selector: 'app-home',
  imports: [RouterLink, TrPipe, IconComponent, RevealDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.html',
})
export class Home {
  private readonly content = inject(ContentService);

  readonly site = SITE;
  readonly sections = SECTIONS;
  readonly helpdeskUrl = computed(() =>
    this.content.pick('help', 'HELPDESK_PORTAL_URL', HELPDESK_PORTAL_URL),
  );
  readonly stats = computed(() => this.content.pick('home', 'STATS', STATS));
  readonly values = computed(() => this.content.pick('home', 'VALUES', VALUES));
  readonly quickLinks = computed(() => this.content.pick('home', 'QUICK_LINKS', QUICK_LINKS));
  readonly lang = inject(LanguageService).lang;

  private readonly user = inject(UserService);
  private readonly newsSvc = inject(NewsService);
  readonly latestNews = signal<NewsPost[]>([]);
  readonly heroImages = signal<string[]>([]);
  readonly heroIndex = signal(0);

  constructor() {
    void this.loadNews();
    void this.loadHero();
  }

  private async loadNews(): Promise<void> {
    try {
      const f = await this.newsSvc.feed(undefined, true); // peek: khong reset badge NEW
      this.latestNews.set(f.posts.slice(0, 3));
    } catch {
      /* bo qua */
    }
  }

  /** Anh nen hero: lay tu media/hero, xao tron, chay slide crossfade. */
  private async loadHero(): Promise<void> {
    try {
      const res = await fetch('/api/hero-images', { credentials: 'same-origin' });
      if (!res.ok) return;
      const imgs = (((await res.json()).images as string[]) ?? []).slice();
      for (let i = imgs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [imgs[i], imgs[j]] = [imgs[j], imgs[i]];
      }
      this.heroImages.set(imgs);
      if (imgs.length > 1) {
        setInterval(() => this.heroIndex.update((v) => (v + 1) % this.heroImages().length), 6000);
      }
    } catch {
      /* bo qua */
    }
  }

  rel(iso: string): string {
    return relTime(iso, this.lang());
  }

  /** Dòng eyebrow: chào theo tên thật từ AD; chưa biết tên thì chào chung. */
  readonly greeting = computed(() => {
    const name = this.user.fullName();
    const vi = this.lang() === 'vi';
    if (!name) return vi ? 'Chào mừng người mới' : 'Welcome aboard';
    return vi ? `Chào mừng ${name}` : `Welcome ${name}`;
  });

  /** Link ra ngoai (Spiceworks…) phai dung <a href> + tab moi, routerLink chi cho duong noi bo. */
  isInternal(url: string): boolean {
    return url.startsWith('/');
  }

  path(url: string): string {
    return url.split('#')[0];
  }
  frag(url: string): string | undefined {
    return url.split('#')[1];
  }
}
