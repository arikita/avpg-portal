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
import { RouterLink } from '@angular/router';
import { CHECKLIST, ONBOARDING_INTRO, SECTIONS } from '../../content/onboarding.content';
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
export class Onboarding implements AfterViewInit {
  private readonly content = inject(ContentService);

  readonly intro = computed(() => this.content.pick('onboarding', 'ONBOARDING_INTRO', ONBOARDING_INTRO));
  readonly checklist = computed(() => this.content.pick('onboarding', 'CHECKLIST', CHECKLIST));
  readonly sections = computed(() => this.content.pick('onboarding', 'SECTIONS', SECTIONS));
  readonly lang = inject(LanguageService).lang;

  private readonly progress = inject(ProgressService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly total = computed(() => this.checklist().length);
  readonly doneCount = computed(
    () => this.checklist().filter((i) => this.progress.done().has(i.id)).length,
  );
  readonly percent = computed(() =>
    this.total() ? Math.round((this.doneCount() / this.total()) * 100) : 0,
  );
  readonly activeId = signal(SECTIONS[0].id);

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


  private io?: IntersectionObserver;

  /** Quan sat lai khi noi dung tu API ve (DOM bi render lai). */
  private observe(): void {
    if (typeof IntersectionObserver === 'undefined') return;
    this.io?.disconnect();
    this.io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) this.activeId.set(e.target.id);
        }
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
      this.sections();
      setTimeout(() => this.observe(), 0);
    });
  }
}
