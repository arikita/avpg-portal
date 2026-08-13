import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AD_NOTE, HELPDESK_PORTAL_URL, HELP_LEAD, HELP_SECTIONS, IT_CONTACTS } from '../../content/help.content';
import { SITE } from '../../content/site.config';
import { ContentService } from '../../core/services/content.service';
import { LanguageService } from '../../core/services/language.service';
import { TrPipe } from '../../shared/pipes/tr.pipe';
import { IconComponent } from '../../shared/components/icon/icon';
import { ContentBlocksComponent } from '../../shared/components/content-blocks/content-blocks';
import { RevealDirective } from '../../shared/directives/reveal.directive';

@Component({
  selector: 'app-help',
  imports: [RouterLink, TrPipe, IconComponent, ContentBlocksComponent, RevealDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './help.html',
})
export class Help {
  private readonly content = inject(ContentService);

  readonly site = SITE;
  readonly lead = computed(() => this.content.pick('help', 'HELP_LEAD', HELP_LEAD));
  readonly sections = computed(() => this.content.pick('help', 'HELP_SECTIONS', HELP_SECTIONS));
  readonly contacts = computed(() => this.content.pick('help', 'IT_CONTACTS', IT_CONTACTS));
  readonly adNote = computed(() => this.content.pick('help', 'AD_NOTE', AD_NOTE));
  readonly portalUrlRaw = computed(() => this.content.pick('help', 'HELPDESK_PORTAL_URL', HELPDESK_PORTAL_URL));
  readonly lang = inject(LanguageService).lang;

  initials(name: string): string {
    const w = name.trim().split(/\s+/);
    return (w.length === 1 ? w[0].slice(0, 2) : w[0][0] + w[w.length - 1][0]).toUpperCase();
  }
}
