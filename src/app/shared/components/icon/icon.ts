import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ICONS } from '../../icons';

function wrap(inner: string): string {
  return (
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
    inner +
    '</svg>'
  );
}

@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="i" [innerHTML]="html()"></span>`,
  styles: [`:host { display: inline-flex; line-height: 0; vertical-align: middle; } .i { display: inline-flex; }`],
})
export class IconComponent {
  private readonly sanitizer = inject(DomSanitizer);
  readonly name = input.required<string>();

  readonly html = computed<SafeHtml>(() =>
    this.sanitizer.bypassSecurityTrustHtml(wrap(ICONS[this.name()] ?? ICONS['dot'])),
  );
}
