import { Injectable, effect, signal } from '@angular/core';
import { Lang } from '../models/content.models';

const KEY = 'avp.lang';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly _lang = signal<Lang>(this.initial());

  /** Reactive current language. Use `lang()` in templates, e.g. `text | tr:lang()`. */
  readonly lang = this._lang.asReadonly();

  constructor() {
    effect(() => {
      const l = this._lang();
      try {
        localStorage.setItem(KEY, l);
      } catch {}
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('lang', l);
      }
    });
  }

  set(l: Lang): void {
    this._lang.set(l);
  }

  toggle(): void {
    this._lang.set(this._lang() === 'vi' ? 'en' : 'vi');
  }

  private initial(): Lang {
    if (typeof document !== 'undefined') {
      const attr = document.documentElement.getAttribute('lang');
      if (attr === 'vi' || attr === 'en') return attr;
    }
    try {
      const s = localStorage.getItem(KEY);
      if (s === 'vi' || s === 'en') return s;
    } catch {}
    return 'vi';
  }
}
