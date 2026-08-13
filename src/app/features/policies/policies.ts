import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { POLICIES } from '../../content/policies.content';
import { ContentService } from '../../core/services/content.service';
import { LanguageService } from '../../core/services/language.service';
import { TrPipe } from '../../shared/pipes/tr.pipe';
import { IconComponent } from '../../shared/components/icon/icon';
import { RevealDirective } from '../../shared/directives/reveal.directive';

@Component({
  selector: 'app-policies',
  imports: [TrPipe, IconComponent, RevealDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './policies.html',
})
export class Policies {
  private readonly content = inject(ContentService);

  readonly policies = computed(() => this.content.pick('policies', 'POLICIES', POLICIES));
  readonly lang = inject(LanguageService).lang;
}
