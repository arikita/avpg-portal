import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FAQS } from '../../content/faq.content';
import { ContentService } from '../../core/services/content.service';
import { LanguageService } from '../../core/services/language.service';
import { TrPipe } from '../../shared/pipes/tr.pipe';
import { IconComponent } from '../../shared/components/icon/icon';

@Component({
  selector: 'app-faq',
  imports: [TrPipe, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './faq.html',
})
export class Faq {
  private readonly content = inject(ContentService);
  private readonly langSvc = inject(LanguageService);

  readonly faqs = computed(() => this.content.pick('faq', 'FAQS', FAQS));
  readonly lang = this.langSvc.lang;
  readonly query = signal('');
  readonly open = signal(-1);

  readonly items = computed(() => {
    const q = this.query().trim().toLowerCase();
    const l = this.lang();
    const all = this.faqs();
    if (!q) return all;
    return all.filter((f) =>
      (f.q[l] + ' ' + f.a[l] + ' ' + (f.tag?.[l] ?? '')).toLowerCase().includes(q),
    );
  });

  toggle(i: number): void {
    this.open.set(this.open() === i ? -1 : i);
  }

  onSearch(e: Event): void {
    this.query.set((e.target as HTMLInputElement).value);
    this.open.set(-1);
  }
}
