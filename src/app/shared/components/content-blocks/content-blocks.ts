import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Block, CalloutTone } from '../../../core/models/content.models';
import { LanguageService } from '../../../core/services/language.service';
import { TrPipe } from '../../pipes/tr.pipe';
import { IconComponent } from '../icon/icon';
import { RevealDirective } from '../../directives/reveal.directive';

/** Declaratively renders an array of content Blocks (paragraphs, steps,
 *  callouts, key-value fields with copy, tables, link grids). */
@Component({
  selector: 'app-content-blocks',
  imports: [TrPipe, IconComponent, RevealDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './content-blocks.html',
})
export class ContentBlocksComponent {
  readonly blocks = input.required<Block[]>();
  readonly lang = inject(LanguageService).lang;

  any(b: Block): any {
    return b;
  }

  isUrl(v: string): boolean {
    return /^https?:\/\//i.test(v);
  }

  isEmail(v: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }

  iconFor(tone: CalloutTone): string {
    switch (tone) {
      case 'tip':
        return 'sparkles';
      case 'success':
        return 'check';
      case 'warning':
      case 'danger':
        return 'alert-triangle';
      default:
        return 'info';
    }
  }
}
