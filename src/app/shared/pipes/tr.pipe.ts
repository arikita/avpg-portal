import { Pipe, PipeTransform } from '@angular/core';
import { L, Lang } from '../../core/models/content.models';

/**
 * Resolves a bilingual value for the active language.
 * Usage: `{{ item.title | tr:lang() }}` — passing `lang()` (a signal call)
 * makes this pure pipe re-run whenever the language changes.
 */
@Pipe({ name: 'tr' })
export class TrPipe implements PipeTransform {
  transform(value: L | string | null | undefined, lang: Lang): string {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    return value[lang] ?? value.vi ?? value.en ?? '';
  }
}
