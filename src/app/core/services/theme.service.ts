import { Injectable, effect, signal } from '@angular/core';
import { Theme } from '../models/content.models';

const KEY = 'avp.theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly _theme = signal<Theme>(this.initial());

  readonly theme = this._theme.asReadonly();

  constructor() {
    effect(() => {
      const t = this._theme();
      try {
        localStorage.setItem(KEY, t);
      } catch {}
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', t);
      }
    });
  }

  toggle(): void {
    this._theme.set(this._theme() === 'dark' ? 'light' : 'dark');
  }

  set(t: Theme): void {
    this._theme.set(t);
  }

  private initial(): Theme {
    // The inline script in index.html already resolved the theme before paint.
    if (typeof document !== 'undefined') {
      const attr = document.documentElement.getAttribute('data-theme');
      if (attr === 'dark' || attr === 'light') return attr;
    }
    try {
      const s = localStorage.getItem(KEY);
      if (s === 'dark' || s === 'light') return s;
    } catch {}
    return 'light';
  }
}
