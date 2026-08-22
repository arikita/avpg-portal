import { effect, inject, Injectable } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { safePath } from '../../shared/util/safe-path';
import { Me, UserService } from './user.service';

/**
 * Do luot truy cap portal bang Google Analytics 4.
 *
 * Portal la SPA: index.html chi tai mot lan nen gtag khong tu thay chuyen trang
 * => page_view phai gui tay o moi lan doi route, khong thi GA chi ghi nhan
 * dung 1 luot xem cho ca phien.
 *
 * Dieu khoan GA cam gui du lieu dinh danh ca nhan, nen truoc khi gui:
 *   - duong dan bi lam sach  (/profile/haivl -> /profile/*)
 *   - ten dang nhap bam SHA-256 truoc khi dung lam user_id
 */

/** Measurement ID: GA4 > Admin > Data streams > Web. De rong = tat do luong. */
const GA_ID = 'G-0D97GKKZ6W';

/** Chi do tren portal that; ng serve tren may dev khong lam ban so lieu. */
const TRACKED_HOSTS = ['portal.anvietphatgroup.com'];

declare global {
  interface Window {
    dataLayer?: IArguments[];
    gtag?: (...args: unknown[]) => void;
  }
}

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly userSvc = inject(UserService);

  private readonly enabled = !!GA_ID && TRACKED_HOSTS.includes(location.hostname);
  private identified = false;

  constructor() {
    if (!this.enabled) return;

    // Dung dung snippet cua Google: gtag day nguyen doi tuong `arguments` vao
    // dataLayer, khong phai mang. Doi sang mang la gtag.js doc sai lenh.
    window.dataLayer ??= [];
    window.gtag = function gtag() {
      window.dataLayer!.push(arguments);
    };
    this.gtag('js', new Date());
    this.gtag('config', GA_ID, { send_page_view: false });

    // /api/me ve sau khi app khoi dong => cho signal co du lieu roi moi gan danh tinh.
    effect(() => {
      const me = this.userSvc.me();
      if (this.identified || !me) return;
      this.identified = true;
      void this.identify(me);
    });
  }

  /**
   * Nap gtag.js. Goi mot lan luc khoi dong app (xem app.config.ts).
   * Cac lenh day vao dataLayer truoc khi script tai xong khong mat: gtag.js
   * xu ly ca hang doi co san — day chinh la ly do snippet cua Google dung
   * dataLayer thay vi goi ham truc tiep.
   */
  init(): void {
    if (!this.enabled) return;
    const tag = document.createElement('script');
    tag.async = true;
    tag.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(tag);
  }

  /** Goi tu AnalyticsTitleStrategy, sau khi document.title da doi. */
  pageView(url: string): void {
    if (!this.enabled) return;
    const path = safePath(url);
    this.gtag('event', 'page_view', {
      page_path: path,
      // Bat buoc ghi de: mac dinh gtag lay document.location, trong do co ten dang nhap.
      page_location: location.origin + path,
      page_title: document.title,
    });
  }

  /** Dem duoc so NGUOI that thay vi so trinh duyet, va tach duoc theo phong ban. */
  private async identify(me: Me): Promise<void> {
    this.gtag('set', 'user_properties', { department: me.department || 'khong ro' });
    const id = await sha256(me.username);
    if (id) this.gtag('set', { user_id: id });
  }

  private gtag(...args: unknown[]): void {
    window.gtag?.(...args);
  }
}

/**
 * Doi tieu de trang XONG moi bao page_view.
 *
 * Router phat NavigationEnd TRUOC khi goi titleStrategy.updateTitle
 * (@angular/router router2.mjs: events.next(new NavigationEnd(...)) roi moi
 * den updateTitle). Bam vao NavigationEnd thi moi page_view deu mang
 * document.title cua trang TRUOC DO — sai lech ma khong he bao loi.
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly analytics = inject(AnalyticsService);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const t = this.buildTitle(snapshot);
    if (t !== undefined) this.title.setTitle(t);
    this.analytics.pageView(snapshot.url);
  }
}

/** Bam ten dang nhap; tra null neu trinh duyet khong co WebCrypto (http, ban cu). */
async function sha256(text: string): Promise<string | null> {
  if (!text || !globalThis.crypto?.subtle) return null;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text.toLowerCase()));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}
