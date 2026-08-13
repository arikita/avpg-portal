import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { NewsPost, ReactionFace, NEWS_CATEGORIES } from '../../core/models/news.models';
import { LanguageService } from '../../core/services/language.service';
import { NewsService } from '../../core/services/news.service';
import { NotificationService } from '../../core/services/notification.service';
import { IconComponent } from '../../shared/components/icon/icon';
import { AvatarComponent } from '../../shared/components/avatar/avatar';
import { TrPipe } from '../../shared/pipes/tr.pipe';
import { avatarHue, initials, relTime } from './news.util';

/** Feed tin tuc noi bo — the bai, react nhanh, dem binh luan. */
@Component({
  selector: 'app-news',
  imports: [RouterLink, TrPipe, IconComponent, AvatarComponent],
  templateUrl: './news.html',
  styleUrl: './news.scss',
})
export class News {
  private readonly svc = inject(NewsService);
  private readonly notif = inject(NotificationService);
  private readonly langSvc = inject(LanguageService);
  readonly lang = this.langSvc.lang;

  readonly categories = NEWS_CATEGORIES;
  readonly posts = signal<NewsPost[]>([]);
  readonly emojis = signal<string[]>([]);
  readonly canPost = signal(false);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly activeCat = signal<string | null>(null);

  // Tim kiem tu khoa
  readonly searchOn = signal(false);
  readonly query = signal('');
  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  /** Bai dau (da ghim hoac moi nhat) lam bai noi bat; con lai xuong dai the. */
  readonly hero = computed(() => this.posts()[0] ?? null);
  readonly rest = computed(() => this.posts().slice(1));

  /** Xoay vong nhieu mau the cho feed do nham chan (magazine-style). */
  private readonly PATTERN = ['standard', 'overlay', 'accent', 'standard', 'wide', 'overlay', 'standard', 'accent'];
  private readonly TONES = ['#5b5bf5', '#0ea5e9', '#a855f7', '#f97316', '#10b981', '#e11d76'];

  /** Mau the theo vi tri; kieu can anh (overlay/wide) ma bai khong co anh -> accent. */
  variantOf(p: NewsPost, i: number): string {
    const v = this.PATTERN[i % this.PATTERN.length];
    if ((v === 'overlay' || v === 'wide') && !p.cover) return 'accent';
    return v;
  }

  /** Mau nhan (accent/overlay tint) xoay theo vi tri. */
  tone(i: number): string {
    return this.TONES[i % this.TONES.length];
  }

  readonly initials = initials;
  readonly avatarHue = avatarHue;
  rel = (iso: string) => relTime(iso, this.lang());

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const data = await this.svc.feed(this.activeCat() ?? undefined, false, this.query());
      this.posts.set(data.posts);
      this.emojis.set(data.emojis);
      this.canPost.set(data.canPost);
      this.notif.clearNewsBadge(); // vao trang tin => an badge NEW ngay
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  setCat(id: string | null): void {
    this.activeCat.set(id);
    void this.load();
  }

  /** Mo/dong o tim kiem; dong thi xoa tu khoa va tai lai neu dang loc. */
  toggleSearch(): void {
    const open = !this.searchOn();
    this.searchOn.set(open);
    if (!open && this.query()) {
      this.query.set('');
      void this.load();
    }
  }

  /** Go tu khoa: tai lai sau khi ngung go 300ms. */
  onQuery(v: string): void {
    this.query.set(v);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => void this.load(), 300);
  }

  clearQuery(): void {
    if (!this.query()) return;
    this.query.set('');
    void this.load();
  }

  catLabel(id: string) {
    return this.categories.find((c) => c.id === id)?.label ?? { vi: id, en: id };
  }

  /** Top 3 emoji nhieu nhat cua mot bai, de hien tren the. */
  topEmojis(p: NewsPost): string[] {
    return Object.entries(p.reactions.counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([e]) => e);
  }

  /**
   * Chu hien khi re chuot: ten tung nguoi kem emoji ho tha, roi den bang tong
   * ket theo emoji. Vd: "Vu Long Hai 👍 · Le Nguyen Kieu Oanh 🎉 · và 8 người
   * khác — 👍 5 · ❤️ 3 · 🎉 1 · 👏 1".
   */
  rxTitle(p: NewsPost): string {
    const faces = p.reactions.faces ?? [];
    const who = faces.map((f) => `${f.name} ${f.emoji}`);
    const more = p.reactions.total - faces.length;
    if (more > 0) who.push(this.lang() === 'vi' ? `và ${more} người khác` : `and ${more} more`);
    const sum = Object.entries(p.reactions.counts)
      .sort((a, b) => b[1] - a[1])
      .map(([e, n]) => `${e} ${n}`)
      .join(' · ');
    return `${who.join(' · ')}${who.length ? ' — ' : ''}${sum}`;
  }

  /** Vai nguoi react gan nhat, de hien avatar tren the (toi da 3 cho gon). */
  rxFaces(p: NewsPost): ReactionFace[] {
    return (p.reactions.faces ?? []).slice(0, 3);
  }

  async react(p: NewsPost, emoji: string, ev: Event): Promise<void> {
    ev.stopPropagation();
    ev.preventDefault();
    try {
      const rx = await this.svc.react(p.id, emoji);
      this.posts.update((list) => list.map((x) => (x.id === p.id ? { ...x, reactions: rx } : x)));
    } catch {
      /* im lang: react loi thi giu nguyen */
    }
  }
}
