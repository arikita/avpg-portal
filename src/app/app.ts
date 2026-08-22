import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NAV, NAV_MORE, SITE } from './content/site.config';
import { HELPDESK_PORTAL_URL } from './content/help.content';
import { Lang } from './core/models/content.models';
import { LanguageService } from './core/services/language.service';
import { ThemeService } from './core/services/theme.service';
import { UserService } from './core/services/user.service';
import { TrPipe } from './shared/pipes/tr.pipe';
import { IconComponent } from './shared/components/icon/icon';
import { ContentService } from './core/services/content.service';
import { NotificationService } from './core/services/notification.service';
import { NotificationsBell } from './shared/components/notifications/notifications';
import { ChatDock } from './shared/components/chat-dock/chat-dock';
import { BugReport } from './shared/components/bug-report/bug-report';
import { initials } from './shared/util/avatar.util';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TrPipe, IconComponent, NotificationsBell, ChatDock, BugReport],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly nav = NAV;
  /** Chinh sach + FAQ: chi o chan trang va menu dien thoai, khong len navbar. */
  readonly navMore = NAV_MORE;
  /** Mang gop san (menu dien thoai + chan trang) — dung mang co dinh chu khong
   *  ghep trong template, tranh tao mang moi moi vong change detection. */
  readonly navAll = [...NAV, ...NAV_MORE];
  readonly site = SITE;

  /** Link "Gui yeu cau ho tro" o chan trang tro THANG toi cong Spiceworks.
   *  Lay qua ContentService de con sua duoc tu DB nhu trang /help. */
  private readonly content = inject(ContentService);
  readonly helpdeskUrl = computed(() =>
    this.content.pick('help', 'HELPDESK_PORTAL_URL', HELPDESK_PORTAL_URL),
  );

  private readonly langSvc = inject(LanguageService);
  private readonly themeSvc = inject(ThemeService);
  readonly lang = this.langSvc.lang;
  readonly theme = this.themeSvc.theme;

  readonly menuOpen = signal(false);

  /** Link Quan tri chi hien voi thanh vien nhom bien tap. */
  private readonly userSvc = inject(UserService);
  readonly canEdit = computed(() => this.userSvc.me()?.canEdit === true);
  readonly unseenNews = inject(NotificationService).unseenNews;

  /** Nut ho so tren navbar: anh that neu da tai len, khong thi chu cai dau. */
  readonly myAvatar = this.userSvc.avatar;
  readonly myInitials = computed(() =>
    initials(this.userSvc.fullName() || this.userSvc.username() || '?'),
  );

  /** Nut len dau trang: chi hien khi da keo gan het trang ("keo het trang"). */
  readonly showToTop = signal(false);
  private readonly router = inject(Router);

  constructor() {
    // Doi trang => chieu cao noi dung thay doi, tinh lai sau khi render.
    this.router.events.subscribe((e) => {
      if (e instanceof NavigationEnd) setTimeout(() => this.updateToTop(), 0);
    });
  }

  @HostListener('window:scroll')
  @HostListener('window:resize')
  updateToTop(): void {
    const full = document.documentElement.scrollHeight;
    const seen = window.scrollY + window.innerHeight;
    // Trang phai du dai de cuon, va da cham day (con <= 80px la toi day).
    this.showToTop.set(full > window.innerHeight + 60 && full - seen <= 80);
  }

  scrollTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  setLang(l: Lang): void {
    this.langSvc.set(l);
  }
  toggleTheme(): void {
    this.themeSvc.toggle();
  }
  toggleMenu(): void {
    this.menuOpen.update((v) => !v);
  }
  closeMenu(): void {
    this.menuOpen.set(false);
  }
}
