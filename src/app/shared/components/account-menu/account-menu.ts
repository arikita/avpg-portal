import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  signal,
} from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';

import { LanguageService } from '../../../core/services/language.service';
import { UserService } from '../../../core/services/user.service';
import { IconComponent } from '../icon/icon';
import { initials } from '../../util/avatar.util';

/** Duong Apache xoa phien form roi tra ve trang dang nhap (SessionMaxAge 1). */
const LOGOUT_URL = '/dang-nhap/thoat';

/**
 * Nut tai khoan tren thanh menu: avatar bam ra menu Ho so / Dang xuat.
 *
 * VE VIEC "DANG XUAT" — doc truoc khi sua:
 * Nut nay chi THAT SU ket thuc phien voi nguoi dang nhap bang form (may khong
 * join domain): Apache xoa cookie `avpsess` la xong. May JOIN DOMAIN dang nhap
 * bang ve Kerberos cua phien Windows, nen bam xong quay lai portal la vao ngay
 * — khong co cach nao "dang xuat" khoi Kerberos tu phia web.
 *
 * Vi vay voi may SSO, menu hien them mot dong noi thang dieu do. Giau nut di
 * thi nguoi dung di tim; de nut im lang khong tac dung thi ho tuong portal
 * hong. Noi that la lua chon con lai, va no cung dung ve mat bao mat: ranh
 * gioi that cua may domain la phien Windows chu khong phai portal.
 *
 * `sso` do /api/me tra ve, tinh tu chinh dieu kien ma Apache dung de re nhanh
 * xac thuc (co cookie avpsess hay khong) — xem ghi chu trong main.py.
 */
@Component({
  selector: 'app-account-menu',
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './account-menu.html',
  styleUrl: './account-menu.scss',
})
export class AccountMenu {
  private readonly user = inject(UserService);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly router = inject(Router);
  readonly lang = inject(LanguageService).lang;
  readonly vi = computed(() => this.lang() === 'vi');

  readonly open = signal(false);

  readonly avatar = this.user.avatar;
  readonly username = this.user.username;
  readonly fullName = computed(() => this.user.fullName() || this.user.username() || '');
  readonly mail = computed(() => this.user.me()?.mail ?? '');
  readonly initials = computed(() => initials(this.fullName() || '?'));
  /** Thieu truong => coi nhu SSO: tha canh bao thua con hon hua sai. */
  readonly sso = computed(() => this.user.me()?.sso !== false);

  constructor() {
    // Doi trang thi dong menu. Khong co dong nay thi bam "Ho so" xong menu van
    // treo tren trang moi.
    this.router.events.subscribe((e) => {
      if (e instanceof NavigationEnd) this.open.set(false);
    });
  }

  toggle(): void {
    this.open.update((v) => !v);
  }

  close(): void {
    this.open.set(false);
  }

  /** Bam ra ngoai thi dong. Bat o document vi menu noi len tren noi dung. */
  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent): void {
    if (!this.open()) return;
    if (!this.host.nativeElement.contains(ev.target as Node)) this.open.set(false);
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    this.open.set(false);
  }

  /**
   * Roi khoi Angular han — day la duong cua Apache, khong phai route SPA.
   * `location.assign` chu khong phai router.navigate.
   */
  signOut(): void {
    this.open.set(false);
    window.location.assign(LOGOUT_URL);
  }
}
