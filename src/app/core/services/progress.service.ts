import { Injectable, computed, signal } from '@angular/core';

const KEY = 'avp.progress';

/** Tracks completed onboarding checklist items, persisted to localStorage. */
@Injectable({ providedIn: 'root' })
export class ProgressService {
  private readonly _done = signal<ReadonlySet<string>>(this.load());

  readonly done = this._done.asReadonly();
  readonly count = computed(() => this._done().size);

  isDone(id: string): boolean {
    return this._done().has(id);
  }

  toggle(id: string): void {
    const next = new Set(this._done());
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this._done.set(next);
    this.save(next);
  }

  clear(): void {
    const empty = new Set<string>();
    this._done.set(empty);
    this.save(empty);
  }

  private load(): Set<string> {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return new Set<string>(JSON.parse(raw));
    } catch {}
    return new Set<string>();
  }

  private save(set: ReadonlySet<string>): void {
    try {
      localStorage.setItem(KEY, JSON.stringify([...set]));
    } catch {}
  }
}
