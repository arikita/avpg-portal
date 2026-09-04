import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { CHECKLIST, ONBOARDING_INTRO, PHONG_BAN, PhongBan } from '../../content/onboarding.content';
import { ContentService } from '../../core/services/content.service';
import { LanguageService } from '../../core/services/language.service';
import { ProgressService } from '../../core/services/progress.service';
import { TrPipe } from '../../shared/pipes/tr.pipe';
import { IconComponent } from '../../shared/components/icon/icon';
import { ContentBlocksComponent } from '../../shared/components/content-blocks/content-blocks';
import { RevealDirective } from '../../shared/directives/reveal.directive';
import { celebrate } from '../../shared/util/confetti';

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
  readonly checklist = computed(() => this.content.pick('onboarding', 'CHECKLIST', CHECKLIST));
  readonly lang = inject(LanguageService).lang;

  /** Danh sach phong ban — trang nay chi bay the dan sang, khong render noi dung. */
  readonly phongBan = PHONG_BAN;

  /** So muc that su co, doc qua ContentService de dem dung ban DB neu co. */
  soMuc(p: PhongBan): number {
    return this.content.pick(p.module, p.sectionsKey, p.sections).length;
  }

  private readonly progress = inject(ProgressService);

  readonly total = computed(() => this.checklist().length);
  readonly doneCount = computed(
    () => this.checklist().filter((i) => this.progress.done().has(i.id)).length,
  );
  readonly percent = computed(() =>
    this.total() ? Math.round((this.doneCount() / this.total()) * 100) : 0,
  );

  private celebrated = false;

  isDone(id: string): boolean {
    return this.progress.isDone(id);
  }

  toggle(id: string): void {
    this.progress.toggle(id);
    const done = this.doneCount();
    if (done === this.total() && !this.celebrated) {
      this.celebrated = true;
      celebrate();
    }
    if (done < this.total()) this.celebrated = false;
  }
}
