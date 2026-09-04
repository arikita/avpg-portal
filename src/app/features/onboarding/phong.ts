import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';

import { PHONG_BAN, PhongBan } from '../../content/onboarding.content';
import { ContentService } from '../../core/services/content.service';
import { LanguageService } from '../../core/services/language.service';
import { ContentBlocksComponent } from '../../shared/components/content-blocks/content-blocks';
import { IconComponent } from '../../shared/components/icon/icon';
import { TrPipe } from '../../shared/pipes/tr.pipe';

/**
 * Trang hoi nhap cua MOT phong ban — /onboarding/<slug>.
 *
 * Mot component dung chung cho moi phong; khac nhau chi la du lieu, lay tu
 * `PHONG_BAN` trong onboarding.content.ts. Them mot phong = them mot phan tu
 * o danh sach do, khong dung toi file nay.
 *
 * BAY THU TU ROUTE: `onboarding/:phong` PHAI khai SAU `onboarding/kiem-tra`
 * va `onboarding/cam-ket` trong app.routes.ts. Angular khop route theo thu tu,
 * dat truoc thi `kiem-tra` bi hieu la ten mot phong ban va trang bai kiem tra
 * BIEN MAT — khong mot dong loi nao. Cung dung cai bay `gallery/manage` da ghi
 * trong CLAUDE.md. Hang `RESERVED` giu cho hai ten do, va co test khoa lai.
 *
 * Phong chua co noi dung (Nhan su, dang cho ho gui) thi hien trang thai "dang
 * cap nhat" chu khong ra mot trang trang tron — nguoi doc phai biet la chua co
 * chu khong phai la hong.
 */
@Component({
  selector: 'app-onboarding-phong',
  standalone: true,
  imports: [RouterLink, TrPipe, IconComponent, ContentBlocksComponent],
  templateUrl: './phong.html',
  styleUrl: './onboarding.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnboardingPhong implements AfterViewInit {
  /**
   * Doan duong dan, lay tu route param `:phong`.
   *
   * KHONG dung `input()` de nhan param: cach do chi chay khi router bat
   * `withComponentInputBinding()`, ma app.config.ts KHONG bat. Hau qua la
   * input mai mai la chuoi rong => moi trang phong ban deu ra "khong co trang
   * nay", khong mot dong loi nao. Da dinh that 04/09/2026, audit_onboarding
   * bat duoc.
   *
   * Bat co do toan cuc chi de mot component doc duoc param la doi hanh vi cua
   * MOI component trong app — dat hon nhieu so voi ba dong o day.
   *
   * Doc qua `paramMap` chu khong phai `snapshot`: di tu /onboarding/it sang
   * /onboarding/nhan-su thi Angular DUNG LAI component nay, snapshot khong
   * doi va trang se ket o phong cu.
   */
  readonly phong = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((m) => m.get('phong') ?? '')),
    { initialValue: '' },
  );

  private readonly content = inject(ContentService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly lang = inject(LanguageService).lang;
  readonly vi = computed(() => this.lang() === 'vi');

  readonly pb = computed<PhongBan | undefined>(() =>
    PHONG_BAN.find((p) => p.slug === this.phong()),
  );

  readonly intro = computed(() => {
    const p = this.pb();
    return p ? this.content.pick(p.module, p.introKey, p.intro) : null;
  });

  readonly sections = computed(() => {
    const p = this.pb();
    return p ? this.content.pick(p.module, p.sectionsKey, p.sections) : [];
  });

  readonly activeId = signal('');

  private io?: IntersectionObserver;

  private observe(): void {
    if (typeof IntersectionObserver === 'undefined') return;
    this.io?.disconnect();
    this.io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) this.activeId.set(e.target.id);
      },
      { rootMargin: '-45% 0px -50% 0px', threshold: 0 },
    );
    this.host.nativeElement
      .querySelectorAll<HTMLElement>('[data-sec]')
      .forEach((s) => this.io!.observe(s));
  }

  ngAfterViewInit(): void {
    this.observe();
  }

  constructor() {
    effect(() => {
      // Noi dung tu API ve thi DOM render lai — phai quan sat lai tu dau.
      this.sections();
      setTimeout(() => this.observe(), 0);
    });
  }
}
