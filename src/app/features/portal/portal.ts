import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ANNOUNCEMENTS, DOWNLOADS, PORTAL_GROUPS } from '../../content/portal.content';
import { ContentService } from '../../core/services/content.service';
import { LanguageService } from '../../core/services/language.service';
import { UserService } from '../../core/services/user.service';
import { TrPipe } from '../../shared/pipes/tr.pipe';
import { IconComponent } from '../../shared/components/icon/icon';
import { RevealDirective } from '../../shared/directives/reveal.directive';

/** Dia chi dang nhap WorkIT (form POST TK/MK). */
const WORKIT_LOGIN = 'https://anvietphatgroup.vn/TrangChu/Login?loginview=Login_WorkIT';

@Component({
  selector: 'app-portal',
  imports: [RouterLink, TrPipe, IconComponent, RevealDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './portal.html',
  styleUrl: './portal.scss',
})
export class Portal {
  private readonly content = inject(ContentService);
  private readonly userSvc = inject(UserService);

  readonly groups = computed(() => this.content.pick('portal', 'PORTAL_GROUPS', PORTAL_GROUPS));
  readonly announcements = computed(() => this.content.pick('portal', 'ANNOUNCEMENTS', ANNOUNCEMENTS));
  readonly downloads = computed(() => this.content.pick('portal', 'DOWNLOADS', DOWNLOADS));
  readonly lang = inject(LanguageService).lang;

  isInternal(url: string): boolean {
    return url.startsWith('/');
  }

  /** Nut WorkIT xu ly rieng de dang nhap giup (form POST tai khoan/mat khau). */
  isWorkit(url: string): boolean {
    return /(^|\/\/)([^/]*\.)?anvietphatgroup\.vn(\/|$)/i.test(url || '');
  }

  // ---- WorkIT auto login ----------------------------------------------------
  readonly workitOpen = signal(false);
  readonly workitUser = signal('');
  readonly workitPass = signal('');
  readonly workitRemember = signal(true);

  /** Ten dang nhap AD (WorkIT dong bo voi DC nen thuong trung sAMAccountName). */
  private adUser(): string {
    return this.userSvc.me()?.username ?? '';
  }
  private storeKey(): string {
    return `avp-workit-${this.adUser() || 'me'}`;
  }
  private saved(): { u: string; p: string } | null {
    try {
      const raw = localStorage.getItem(this.storeKey());
      if (!raw) return null;
      const o = JSON.parse(atob(raw));
      return o && o.u ? o : null;
    } catch {
      return null;
    }
  }

  /**
   * Bam nut WorkIT: neu da luu mat khau tren may nay thi dang nhap thang (mo
   * tab moi da vao). Chua luu thi mo hop nho de nhap mot lan.
   */
  openWorkit(ev: Event): void {
    ev.preventDefault();
    const s = this.saved();
    if (s) {
      this.postWorkit(s.u, s.p);
      return;
    }
    this.workitUser.set(this.adUser());
    this.workitPass.set('');
    this.workitRemember.set(true);
    this.workitOpen.set(true);
  }

  submitWorkit(): void {
    const u = this.workitUser().trim();
    const p = this.workitPass();
    if (!u || !p) return;
    if (this.workitRemember()) {
      try {
        localStorage.setItem(this.storeKey(), btoa(JSON.stringify({ u, p })));
      } catch {
        /* het cho luu thi thoi, van dang nhap duoc lan nay */
      }
    } else {
      try { localStorage.removeItem(this.storeKey()); } catch { /* bo qua */ }
    }
    this.workitOpen.set(false);
    this.postWorkit(u, p);
    this.workitPass.set('');
  }

  closeWorkit(): void {
    this.workitOpen.set(false);
    this.workitPass.set('');
  }

  forgetWorkit(): void {
    try { localStorage.removeItem(this.storeKey()); } catch { /* bo qua */ }
  }
  hasSavedWorkit(): boolean {
    return !!this.saved();
  }

  /**
   * Gui form POST cheo-nguon toi WorkIT trong tab moi. Form navigation duoc
   * phep gui cheo-nguon (khac fetch/CORS); WorkIT dat cookie phien cho
   * anvietphatgroup.vn -> tab moi da dang nhap. Neu WorkIT doi ma bao mat
   * (captcha) thi tab moi dung o buoc do, nguoi dung nhap not.
   */
  private postWorkit(user: string, pass: string): void {
    const f = document.createElement('form');
    f.method = 'POST';
    f.action = WORKIT_LOGIN;
    f.target = '_blank';
    f.rel = 'noopener';
    f.style.display = 'none';
    const add = (name: string, value: string) => {
      const i = document.createElement('input');
      i.type = 'hidden';
      i.name = name;
      i.value = value;
      f.appendChild(i);
    };
    add('TK', user);
    add('MK', pass);
    document.body.appendChild(f);
    f.submit();
    f.remove();
  }
}
