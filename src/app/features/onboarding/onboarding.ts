import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ONBOARDING_INTRO, PHONG_BAN, PhongBan } from '../../content/onboarding.content';
import { ContentService } from '../../core/services/content.service';
import { LanguageService } from '../../core/services/language.service';
import { TrPipe } from '../../shared/pipes/tr.pipe';
import { IconComponent } from '../../shared/components/icon/icon';
import { ContentBlocksComponent } from '../../shared/components/content-blocks/content-blocks';
import { RevealDirective } from '../../shared/directives/reveal.directive';

@Component({
  selector: 'app-onboarding',
  imports: [RouterLink, TrPipe, IconComponent, ContentBlocksComponent, RevealDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './onboarding.html',
  styleUrl: './onboarding.scss',
})
export class Onboarding {
  private readonly content = inject(ContentService);

  readonly intro = computed(() => this.content.pick('onboarding', 'ONBOARDING_INTRO', ONBOARDING_INTRO));
  readonly lang = inject(LanguageService).lang;

  /** Danh sach phong ban — trang nay chi bay the dan sang, khong render noi dung. */
  readonly phongBan = PHONG_BAN;

  /** So muc that su co, doc qua ContentService de dem dung ban DB neu co. */
  soMuc(p: PhongBan): number {
    return this.content.pick(p.module, p.sectionsKey, p.sections).length;
  }

}
