import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { NewsComment, NewsPost, Poll, PollOption, NEWS_CATEGORIES } from '../../core/models/news.models';
import { LanguageService } from '../../core/services/language.service';
import { NewsService } from '../../core/services/news.service';
import { UserService } from '../../core/services/user.service';
import { IconComponent } from '../../shared/components/icon/icon';
import { AvatarComponent } from '../../shared/components/avatar/avatar';
import { RichBody } from '../../shared/components/rich-body/rich-body';
import { TrPipe } from '../../shared/pipes/tr.pipe';
import { avatarHue, initials, relTime } from './news.util';

/** Trang chi tiet mot bai: noi dung, react nhieu emoji, binh luan long nhau. */
@Component({
  selector: 'app-news-detail',
  imports: [RouterLink, NgTemplateOutlet, TrPipe, IconComponent, RichBody, AvatarComponent],
  templateUrl: './news-detail.html',
  styleUrl: './news-detail.scss',
})
export class NewsDetail {
  private readonly svc = inject(NewsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly langSvc = inject(LanguageService);
  private readonly userSvc = inject(UserService);
  readonly lang = this.langSvc.lang;

  readonly post = signal<NewsPost | null>(null);
  readonly comments = signal<NewsComment[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);

  // Soan binh luan / tra loi / sua — chi mot o mo cung luc cho gon.
  readonly newComment = signal('');
  readonly replyTo = signal<number | null>(null);
  readonly replyText = signal('');
  readonly editingId = signal<number | null>(null);
  readonly editText = signal('');

  readonly me = computed(() => this.userSvc.me()?.username ?? '');
  readonly bodyText = computed(() => this.post()?.body?.[this.lang()] || this.post()?.body?.vi || '');
  /** Con cho binh luan moi (tra loi) khong. */
  readonly canComment = computed(() => this.post()?.commentsEnabled !== false);

  readonly initials = initials;
  readonly avatarHue = avatarHue;
  rel = (iso: string) => relTime(iso, this.lang());

  constructor() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    void this.load(id);
  }

  async load(id: number): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const p = await this.svc.get(id);
      this.post.set(p);
      this.comments.set(p.comments ?? []);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  catLabel(id: string) {
    return NEWS_CATEGORIES.find((c) => c.id === id)?.label ?? { vi: id, en: id };
  }

  fullDate(iso: string): string {
    return new Date(iso).toLocaleString(this.lang() === 'vi' ? 'vi-VN' : 'en-GB',
      { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  async react(emoji: string): Promise<void> {
    const p = this.post();
    if (!p) return;
    try {
      const rx = await this.svc.react(p.id, emoji);
      this.post.set({ ...p, reactions: rx });
    } catch {
      /* giu nguyen */
    }
  }

  count(emoji: string): number {
    return this.post()?.reactions.counts[emoji] ?? 0;
  }

  // -------- ai da react (modal) --------
  readonly reactorsOpen = signal(false);
  openReactors(): void {
    if (this.post()?.reactions.total) this.reactorsOpen.set(true);
  }

  // -------- poll / binh chon (mot bai co the co NHIEU cau hoi) --------
  readonly pollBusy = signal(false);
  readonly polls = computed<Poll[]>(() => {
    const p = this.post();
    return p?.polls?.length ? p.polls : p?.poll ? [p.poll] : [];
  });

  /** Trang thai rieng cho tung cau hoi, tra theo id cua cau hoi. */
  private readonly sels = signal<Record<number, number[]>>({});
  private readonly revoting = signal<Record<number, boolean>>({});
  private readonly peeking = signal<Record<number, boolean>>({});
  private readonly drafts = signal<Record<number, string>>({});

  isSel(poll: Poll, optId: number): boolean {
    return (this.sels()[poll.id] ?? []).includes(optId);
  }
  hasSel(poll: Poll): boolean {
    return (this.sels()[poll.id] ?? []).length > 0;
  }
  newOptionOf(poll: Poll): string {
    return this.drafts()[poll.id] ?? '';
  }
  setNewOption(poll: Poll, val: string): void {
    this.drafts.update((d) => ({ ...d, [poll.id]: val }));
  }

  /**
   * Khi nao hien ket qua: da bo phieu, hoac da het han, hoac nguoi dang bai
   * bam "Xem ket qua" (tac gia can xem duoc ma khong phai bo phieu).
   */
  showResults(poll: Poll): boolean {
    if (this.revoting()[poll.id]) return false;
    return poll.voted || poll.closed || !!this.peeking()[poll.id];
  }
  /** Tac gia / kiem duyet xem ket qua ma khong can bo phieu. */
  canPeek(poll: Poll): boolean {
    return !!this.post()?.canEdit && !poll.voted && !poll.closed && !this.peeking()[poll.id];
  }
  peek(poll: Poll): void {
    this.peeking.update((m) => ({ ...m, [poll.id]: true }));
  }

  pct(poll: Poll, o: PollOption): number {
    return poll.totalVoters ? Math.round((o.votes / poll.totalVoters) * 100) : 0;
  }

  togglePollOpt(poll: Poll, o: PollOption): void {
    if (poll.closed) return;
    if (poll.multi) {
      const cur = this.sels()[poll.id] ?? [];
      const next = cur.includes(o.id) ? cur.filter((x) => x !== o.id) : [...cur, o.id];
      this.sels.update((s) => ({ ...s, [poll.id]: next }));
    } else {
      void this.submitVote(poll, [o.id]);
    }
  }

  submitMulti(poll: Poll): void {
    void this.submitVote(poll, this.sels()[poll.id] ?? []);
  }

  private async submitVote(poll: Poll, ids: number[]): Promise<void> {
    const p = this.post();
    if (!p || !ids.length || this.pollBusy()) return;
    this.pollBusy.set(true);
    try {
      const res = await this.svc.vote(p.id, poll.id, ids);
      this.post.set({ ...p, polls: res.polls, poll: res.polls[0] ?? null });
      this.revoting.update((m) => ({ ...m, [poll.id]: false }));
      this.sels.update((s) => ({ ...s, [poll.id]: [] }));
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.pollBusy.set(false);
    }
  }

  /** Nguoi binh chon tu them mot phuong an. */
  async addOption(poll: Poll): Promise<void> {
    const label = this.newOptionOf(poll).trim();
    const p = this.post();
    if (!label || !p || this.pollBusy()) return;
    this.pollBusy.set(true);
    try {
      const res = await this.svc.addPollOption(p.id, poll.id, label);
      this.post.set({ ...p, polls: res.polls, poll: res.polls[0] ?? null });
      this.setNewOption(poll, '');
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.pollBusy.set(false);
    }
  }

  revote(poll: Poll): void {
    this.sels.update((s) => ({ ...s, [poll.id]: poll.options.filter((o) => o.mine).map((o) => o.id) }));
    this.revoting.update((m) => ({ ...m, [poll.id]: true }));
  }

  // -------- binh luan --------
  async submitComment(): Promise<void> {
    const p = this.post();
    const body = this.newComment().trim();
    if (!p || !body || this.busy()) return;
    this.busy.set(true);
    try {
      const res = await this.svc.addComment(p.id, body);
      this.comments.set(res.comments);
      this.newComment.set('');
    } finally {
      this.busy.set(false);
    }
  }

  openReply(c: NewsComment): void {
    this.editingId.set(null);
    this.replyTo.set(this.replyTo() === c.id ? null : c.id);
    this.replyText.set('');
  }

  async submitReply(parent: NewsComment): Promise<void> {
    const p = this.post();
    const body = this.replyText().trim();
    if (!p || !body || this.busy()) return;
    this.busy.set(true);
    try {
      const res = await this.svc.addComment(p.id, body, parent.id);
      this.comments.set(res.comments);
      this.replyTo.set(null);
      this.replyText.set('');
    } finally {
      this.busy.set(false);
    }
  }

  openEdit(c: NewsComment): void {
    this.replyTo.set(null);
    this.editingId.set(c.id);
    this.editText.set(c.body);
  }

  async submitEdit(c: NewsComment): Promise<void> {
    const body = this.editText().trim();
    if (!body || this.busy()) return;
    this.busy.set(true);
    try {
      const res = await this.svc.editComment(c.id, body);
      this.comments.set(res.comments);
      this.editingId.set(null);
    } finally {
      this.busy.set(false);
    }
  }

  async removeComment(c: NewsComment): Promise<void> {
    if (this.busy()) return;
    const ask = this.lang() === 'vi' ? 'Xoá bình luận này?' : 'Delete this comment?';
    if (!confirm(ask)) return;
    this.busy.set(true);
    try {
      const res = await this.svc.deleteComment(c.id);
      this.comments.set(res.comments);
    } finally {
      this.busy.set(false);
    }
  }

  canManageComment(c: NewsComment): boolean {
    return !c.deleted && (c.author === this.me() || !!this.post()?.canModerate);
  }
  canEditComment(c: NewsComment): boolean {
    return !c.deleted && c.author === this.me();
  }

  // -------- quan tri bai --------
  async togglePin(): Promise<void> {
    const p = this.post();
    if (!p) return;
    const res = await this.svc.pin(p.id);
    this.post.set({ ...p, pinned: res.pinned });
  }

  async removePost(): Promise<void> {
    const p = this.post();
    if (!p) return;
    const ask = this.lang() === 'vi' ? 'Xoá hẳn bài viết này?' : 'Delete this post permanently?';
    if (!confirm(ask)) return;
    await this.svc.remove(p.id);
    void this.router.navigate(['/news']);
  }
}
