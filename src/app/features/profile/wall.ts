import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { WallComment, WallPost } from '../../core/models/wall.models';
import { LanguageService } from '../../core/services/language.service';
import { UserService } from '../../core/services/user.service';
import { WallService } from '../../core/services/wall.service';
import { AvatarComponent } from '../../shared/components/avatar/avatar';
import { IconComponent } from '../../shared/components/icon/icon';
import { TextSeg, linkify } from '../../shared/util/linkify';
import { relTime } from '../news/news.util';

const MAX_BODY = 3000;
const MAX_COMMENT = 1500;

/**
 * Tuong ca nhan — dung o HAI cho:
 *   mode='wall' : tuong cua mot nguoi (trang ho so), can `owner`.
 *   mode='feed' : bang tin chung, bai tuong cua moi nguoi (/api/feed).
 * The bai, cam xuc, binh luan giong het nhau nen dung chung mot component
 * thay vi chep lai giao dien lan thu hai.
 *
 * Chi CHU HO SO dang duoc bai len tuong minh (`canPost` do server quyet dinh,
 * khong phai frontend); moi nguoi con lai tha cam xuc + binh luan.
 * Noi dung la van ban thuan, ve bang binding — dia chi web duoc `linkify` tach
 * ra thanh the <a>, khong qua innerHTML.
 */
@Component({
  selector: 'app-wall',
  imports: [IconComponent, AvatarComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './wall.html',
  styleUrl: './wall.scss',
})
export class Wall {
  private readonly api = inject(WallService);
  private readonly userSvc = inject(UserService);
  readonly lang = inject(LanguageService).lang;

  /** Tuong cua ai (bo trong khi mode='feed'). */
  readonly owner = input('');
  readonly ownerName = input('');
  readonly mode = input<'wall' | 'feed'>('wall');
  /** Bao so bai len trang cha de hien tren nut "Bài đăng". */
  readonly totalChange = output<number>();

  readonly maxBody = MAX_BODY;

  readonly posts = signal<WallPost[]>([]);
  readonly more = signal(false);
  readonly total = signal(0);
  readonly canPost = signal(false);
  readonly emojis = signal<string[]>([]);
  readonly loading = signal(true);
  readonly loadingMore = signal(false);
  readonly error = signal('');

  /** Bang tin: loc theo pham vi. `scopeUsed` la pham vi server THUC SU dung
      (khong doan duoc phong ban thi no lui ve 'all' va giao dien noi ro). */
  readonly scope = signal<'all' | 'dept'>('all');
  readonly scopeUsed = signal<'all' | 'dept'>('all');

  /** O soan bai: o bang tin thi avatar la CUA MINH, khong phai chu tuong. */
  readonly composerName = computed(() =>
    this.mode() === 'feed' ? this.userSvc.fullName() ?? '' : this.ownerName());
  readonly composerUser = computed(() =>
    this.mode() === 'feed' ? this.userSvc.username() : this.owner());

  // --- o soan bai ---
  readonly draft = signal('');
  readonly draftImage = signal('');
  readonly posting = signal(false);
  readonly uploading = signal(false);

  // --- sua bai ---
  readonly editingId = signal<number | null>(null);
  readonly editDraft = signal('');
  readonly editImage = signal('');

  // --- binh luan ---
  readonly commentDraft = signal<Record<number, string>>({});
  readonly openComments = signal<Record<number, boolean>>({});

  readonly vi = computed(() => this.lang() === 'vi');

  constructor() {
    // Doi nguoi (bam sang ho so khac) hoac doi pham vi thi tai lai.
    effect(() => {
      const who = this.owner();
      const feed = this.mode() === 'feed';
      this.scope();
      if (feed || who) void this.load();
    });
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    const page = this.mode() === 'feed'
      ? await this.api.feed(this.scope(), 0)
      : await this.api.page(this.owner(), 0);
    this.loading.set(false);
    if (!page) {
      this.error.set(this.mode() === 'feed'
      ? (this.vi() ? 'Không tải được bảng tin.' : 'Could not load the feed.')
      : (this.vi() ? 'Không tải được tường.' : 'Could not load the wall.'));
      return;
    }
    this.posts.set(page.posts);
    this.more.set(page.more);
    this.total.set(page.total);
    this.canPost.set(page.canPost);
    this.emojis.set(page.emojis);
    this.scopeUsed.set(page.scope ?? 'all');
    this.totalChange.emit(page.total);
  }

  setScope(s: 'all' | 'dept'): void {
    this.scope.set(s);
  }

  async loadMore(): Promise<void> {
    if (this.loadingMore()) return;
    this.loadingMore.set(true);
    const page = this.mode() === 'feed'
      ? await this.api.feed(this.scope(), this.posts().length)
      : await this.api.page(this.owner(), this.posts().length);
    this.loadingMore.set(false);
    if (!page) return;
    this.posts.update((cur) => [...cur, ...page.posts]);
    this.more.set(page.more);
  }

  // ------------------------------------------------------------ hien thi --
  when(iso: string): string {
    return relTime(iso, this.lang());
  }

  /** Van ban thuan -> cac mau chu, dia chi web thanh link. */
  segs(text: string): TextSeg[] {
    return linkify(text);
  }

  /** "👍 3 · ❤️ 1" cho phan chu goi y khi re chuot. */
  rxTitle(p: WallPost): string {
    return Object.entries(p.reactions.counts)
      .map(([e, n]) => `${e} ${n}`)
      .join(' · ');
  }

  topEmojis(p: WallPost): string[] {
    return Object.entries(p.reactions.counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([e]) => e);
  }

  commentsOf(p: WallPost): WallComment[] {
    return p.comments ?? [];
  }

  isOpen(p: WallPost): boolean {
    return this.openComments()[p.id] === true || (p.comments?.length ?? 0) > 0;
  }

  toggleComments(p: WallPost): void {
    this.openComments.update((m) => ({ ...m, [p.id]: !m[p.id] }));
  }

  // --------------------------------------------------------------- soan --
  onDraft(e: Event): void {
    this.draft.set((e.target as HTMLTextAreaElement).value.slice(0, MAX_BODY));
  }

  async onImage(e: Event, forEdit = false): Promise<void> {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.uploading.set(true);
    this.error.set('');
    const res = await this.api.uploadImage(file);
    this.uploading.set(false);
    if ('error' in res) {
      this.error.set(res.error);
      return;
    }
    (forEdit ? this.editImage : this.draftImage).set(res.url);
  }

  clearImage(forEdit = false): void {
    (forEdit ? this.editImage : this.draftImage).set('');
  }

  async post(): Promise<void> {
    const body = this.draft().trim();
    const image = this.draftImage();
    if ((!body && !image) || this.posting()) return;
    this.posting.set(true);
    this.error.set('');
    const created = await this.api.create(body, image);
    this.posting.set(false);
    if (!created) {
      this.error.set(this.vi() ? 'Không đăng được bài.' : 'Could not post.');
      return;
    }
    this.posts.update((cur) => [created, ...cur]);
    this.total.update((n) => n + 1);
    this.totalChange.emit(this.total());
    this.draft.set('');
    this.draftImage.set('');
  }

  // ---------------------------------------------------------------- sua --
  startEdit(p: WallPost): void {
    this.editingId.set(p.id);
    this.editDraft.set(p.body);
    this.editImage.set(p.image);
  }

  cancelEdit(): void {
    this.editingId.set(null);
  }

  onEditDraft(e: Event): void {
    this.editDraft.set((e.target as HTMLTextAreaElement).value.slice(0, MAX_BODY));
  }

  async saveEdit(p: WallPost): Promise<void> {
    const body = this.editDraft().trim();
    const image = this.editImage();
    if (!body && !image) return;
    const saved = await this.api.update(p.id, body, image);
    if (!saved) {
      this.error.set(this.vi() ? 'Không lưu được.' : 'Could not save.');
      return;
    }
    this.replace(saved);
    this.editingId.set(null);
  }

  async remove(p: WallPost): Promise<void> {
    const msg = this.vi() ? 'Xoá bài này? Không khôi phục được.' : 'Delete this post? This cannot be undone.';
    if (!confirm(msg)) return;
    const ok = await this.api.remove(p.id);
    if (!ok) return;
    this.posts.update((cur) => cur.filter((x) => x.id !== p.id));
    this.total.update((n) => Math.max(0, n - 1));
    this.totalChange.emit(this.total());
  }

  // ------------------------------------------------------------ cam xuc --
  async react(p: WallPost, emoji: string): Promise<void> {
    // Bam lai dung emoji dang chon = go cam xuc.
    const next = p.reactions.mine === emoji ? null : emoji;
    const updated = await this.api.react(p.id, next);
    if (updated) this.replace(updated);
  }

  // ----------------------------------------------------------- binh luan --
  draftOf(p: WallPost): string {
    return this.commentDraft()[p.id] ?? '';
  }

  onCommentDraft(p: WallPost, e: Event): void {
    const v = (e.target as HTMLTextAreaElement).value.slice(0, MAX_COMMENT);
    this.commentDraft.update((m) => ({ ...m, [p.id]: v }));
  }

  onCommentKey(p: WallPost, e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void this.sendComment(p);
    }
  }

  async sendComment(p: WallPost): Promise<void> {
    const body = this.draftOf(p).trim();
    if (!body) return;
    const updated = await this.api.comment(p.id, body);
    if (!updated) {
      this.error.set(this.vi() ? 'Không gửi được bình luận.' : 'Could not comment.');
      return;
    }
    this.replace(updated);
    this.commentDraft.update((m) => ({ ...m, [p.id]: '' }));
  }

  async removeComment(c: WallComment): Promise<void> {
    const msg = this.vi() ? 'Xoá bình luận này?' : 'Delete this comment?';
    if (!confirm(msg)) return;
    const updated = await this.api.deleteComment(c.id);
    if (updated) this.replace(updated);
  }

  private replace(p: WallPost): void {
    this.posts.update((cur) => cur.map((x) => (x.id === p.id ? p : x)));
  }
}
