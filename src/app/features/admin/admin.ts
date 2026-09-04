import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

import { SITE } from '../../content/site.config';
import { Lang } from '../../core/models/content.models';
import { LanguageService } from '../../core/services/language.service';
import { ThemeService } from '../../core/services/theme.service';
import { UserService } from '../../core/services/user.service';
import { IconComponent } from '../../shared/components/icon/icon';
import { AccountMenu } from '../../shared/components/account-menu/account-menu';
import { AdminStore } from './admin.store';
import { ADMINLTE_VERSION } from './adminlte.version';
import { AdminOverview } from './tabs/overview';
import { AdminContent } from './tabs/content';
import { AdminAnalytics } from './tabs/analytics';
import { AdminErrors } from './errors/errors';
import { AdminNews } from './tabs/news';
import { AdminUsers } from './tabs/users';
import { AdminQuiz } from './tabs/quiz';
import { AdminCamKet } from './tabs/cam-ket';
import { AdminSystem } from './tabs/system';

/** Mot muc tren thanh ben. `id` la doan duong dan: /admin/<id>. */
interface Tab {
  id: string;
  icon: string;
  vi: string;
  en: string;
  /** Co dat thi ve mot dong tieu de nhom NGAY TRUOC muc nay. */
  group?: 'run' | 'watch';
}

const TABS: Tab[] = [
  { id: 'overview', icon: 'grid', vi: 'Tổng quan', en: 'Overview' },
  { id: 'content', icon: 'edit', vi: 'Nội dung', en: 'Content', group: 'run' },
  { id: 'news', icon: 'newspaper', vi: 'Tin tức', en: 'News' },
  { id: 'users', icon: 'users', vi: 'Người dùng', en: 'People' },
  { id: 'quiz', icon: 'graduation-cap', vi: 'Kiểm tra hội nhập', en: 'Induction check' },
  { id: 'cam-ket', icon: 'shield-check', vi: 'Cam kết bảo mật', en: 'Security commitment' },
  { id: 'analytics', icon: 'zap', vi: 'Lượt truy cập', en: 'Traffic', group: 'watch' },
  { id: 'errors', icon: 'alert-triangle', vi: 'Lỗi ứng dụng', en: 'Errors' },
  { id: 'system', icon: 'settings', vi: 'Hệ thống', en: 'System' },
];

/** Duoi be rong nay AdminLTE cho sidebar truot de len noi dung (sidebar-open)
 *  thay vi day noi dung sang phai. Phai khop `sidebar-expand-lg` o template. */
const LG = 992;

/**
 * Bang dieu khien quan tri — MOT trang, 9 tab, khung AdminLTE v4.
 *
 * Duong dan la /admin/<tab> chu khong phai trang thai trong bo nho: nguoi quan
 * tri phai gui duoc link "xem cai loi nay" cho nhau, va thong bao loi tu server
 * van tro toi /admin/errors?id=123 nhu cu (xem telemetry.py). /admin tran =
 * tab Tong quan.
 *
 * VE CSS: template AdminLTE goi san Bootstrap 5.3 nen dinh nghia dung nhung ten
 * lop portal dang dung o cho khac (.container, .card, .btn, .row) va reset ca
 * body/h1/a. Vi vay KHONG nap no vao `styles` cua angular.json. tools/
 * build_adminlte_css.mjs nhot toan bo file xuong duoi lop `.lte`, ket qua nam
 * o public/vendor/adminlte-<ver>.css va CHI duoc nap khi ai do mo /admin
 * (loadTheme ben duoi) — 850 nguoi vao trang chu khong phai tai 300KB CSS ho
 * khong bao gio dung.
 *
 * ViewEncapsulation.None: 8 component tab dung chung admin.scss. Moi selector
 * trong file scss do BAT BUOC bat dau bang `.lte` hoac `.adm` — xem ghi chu
 * dau file do.
 */
@Component({
  selector: 'app-admin',
  imports: [
    RouterLink,
    IconComponent,
    AccountMenu,
    AdminOverview,
    AdminContent,
    AdminAnalytics,
    AdminErrors,
    AdminNews,
    AdminUsers,
    AdminQuiz,
    AdminCamKet,
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
  private readonly langSvc = inject(LanguageService);
  private readonly themeSvc = inject(ThemeService);
  readonly store = inject(AdminStore);

  readonly lang = this.langSvc.lang;
  readonly theme = this.themeSvc.theme;
  readonly site = SITE;
  readonly tabs = TABS;
  readonly adminLteVersion = ADMINLTE_VERSION;

  readonly canEdit = computed(() => this.user.me()?.canEdit === true);
  readonly ready = computed(() => this.user.me() !== null);
  readonly fullName = computed(() => this.user.fullName() || this.user.username() || '');

  /** CSS cua AdminLTE nap bang <link> chen tay nen khong chan render nhu the
   *  <link> trong index.html. Cho no tai xong roi moi ve khung, neu khong se
   *  chop mot nhip HTML tho khong style. */
  readonly cssReady = signal(false);

  /** Man rong: thu han thanh ben. Man hep: truot no de len noi dung. Hai
   *  trang thai khac nhau nen AdminLTE dung hai lop khac nhau. */
  readonly railCollapsed = signal(false);
  readonly railOpen = signal(false);

  private readonly params = toSignal(this.route.paramMap);
  readonly tab = computed(() => {
    const t = this.params()?.get('tab') ?? 'overview';
    return TABS.some((x) => x.id === t) ? t : 'overview';
  });
  readonly tabTitle = computed(() => {
    const t = TABS.find((x) => x.id === this.tab());
    return t ? this.label(t) : '';
  });

  constructor() {
    this.loadTheme();
    void this.store.load();
  }

  /**
   * Chen <link> toi ban CSS da nhot, mot lan cho ca phien lam viec.
   *
   * Roi khoi /admin van de nguyen the link: file da nhot duoi `.lte` nen khong
   * co selector nao cham toi trang khac, giu lai thi quay lai /admin khong phai
   * tai lai. Ten file co so phien ban (adminlte.version.ts sinh cung luc voi
   * file css) nen doi ban la doi URL — khong dinh bay chunk cu nhu Angular.
   */
  private loadTheme(): void {
    const id = 'adminlte-css';
    if (document.getElementById(id)) {
      this.cssReady.set(true);
      return;
    }
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = `vendor/adminlte-${ADMINLTE_VERSION}.css`;
    // Hong CSS thi van ve — trang tho con doc duoc, trang trang thi khong.
    link.onload = link.onerror = () => this.cssReady.set(true);

    // prepend, KHONG phai append. AdminLTE la lop NEN cua nha cung cap; style
    // cua portal (styles.scss) va cua trang nay (admin.scss, Angular chen bang
    // <style> khi component dung toi) phai nam SAU no de con ghi de duoc. De o
    // cuoi <head> thi moi ghi de "cung do cu the" deu thua am tham — do bang
    // thuoc tinh 25/08/2026: `.lte .small-box > .inner{padding-right:92px}`
    // thua `padding:10px` cua AdminLTE, nhan o so lieu chay xuong duoi bieu
    // tuong 70px va gan nhu khong doc duoc.
    document.head.prepend(link);
  }

  label(t: Tab): string {
    return this.lang() === 'vi' ? t.vi : t.en;
  }

  groupLabel(g: 'run' | 'watch'): string {
    if (g === 'run') return this.lang() === 'vi' ? 'VẬN HÀNH' : 'OPERATE';
    return this.lang() === 'vi' ? 'THEO DÕI' : 'MONITOR';
  }

  /** Huy hieu ben phai ten muc. 0 = khong ve gi (im lang la binh thuong). */
  badge(id: string): number {
    if (id === 'errors') return this.store.newErrors();
    if (id === 'overview') return this.store.todoCount();
    return 0;
  }

  toggleRail(): void {
    if (window.innerWidth < LG) this.railOpen.update((v) => !v);
    else this.railCollapsed.update((v) => !v);
  }

  /** Bam mot muc tren dien thoai => dong thanh ben, neu khong no che noi dung
   *  vua chuyen toi. Tren man rong khong dong gi ca. */
  closeRail(): void {
    if (window.innerWidth < LG) this.railOpen.set(false);
  }

  setLang(l: Lang): void {
    this.langSvc.set(l);
  }

  toggleTheme(): void {
    this.themeSvc.toggle();
  }
}
