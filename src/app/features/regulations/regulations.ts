import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { REG_INTRO, REG_SECTIONS } from '../../content/regulations.content';
import { ContentService } from '../../core/services/content.service';
import { LanguageService } from '../../core/services/language.service';
import { TrPipe } from '../../shared/pipes/tr.pipe';
import { IconComponent } from '../../shared/components/icon/icon';
import { ContentBlocksComponent } from '../../shared/components/content-blocks/content-blocks';
import { RevealDirective } from '../../shared/directives/reveal.directive';

@Component({
  selector: 'app-regulations',
  imports: [RouterLink, TrPipe, IconComponent, ContentBlocksComponent, RevealDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './regulations.html',
})
export class Regulations implements AfterViewInit {
  private readonly content = inject(ContentService);

  readonly intro = computed(() => this.content.pick('regulations', 'REG_INTRO', REG_INTRO));
  readonly sections = computed(() => this.content.pick('regulations', 'REG_SECTIONS', REG_SECTIONS));
  readonly lang = inject(LanguageService).lang;
  readonly activeId = signal(REG_SECTIONS[0].id);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);


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
