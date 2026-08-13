import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ACCENTS, Activity, Profile as ProfileData } from '../../core/models/profile.models';
import { LanguageService } from '../../core/services/language.service';
import { ProfileService } from '../../core/services/profile.service';
import { ChatService } from '../../core/services/chat.service';
import { UserService } from '../../core/services/user.service';
import { IconComponent } from '../../shared/components/icon/icon';
import { AvatarComponent } from '../../shared/components/avatar/avatar';
import { RevealDirective } from '../../shared/directives/reveal.directive';
import { Wall } from './wall';
import { TrPipe } from '../../shared/pipes/tr.pipe';
import { avatarHue, initials } from '../../shared/util/avatar.util';
import { relTime } from '../news/news.util';

const MAX_HEADLINE = 120;
const MAX_BIO = 1000;
const MAX_INTERESTS = 12;

@Component({
  selector: 'app-profile',
  imports: [IconComponent, AvatarComponent, RevealDirective, RouterLink, TrPipe, Wall],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
})
export class Profile {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ProfileService);
  private readonly userSvc = inject(UserService);
  private readonly chat = inject(ChatService);
  private readonly router = inject(Router);
  readonly lang = inject(LanguageService).lang;

  readonly accents = ACCENTS;
  readonly maxHeadline = MAX_HEADLINE;
  readonly maxBio = MAX_BIO;
  readonly maxInterests = MAX_INTERESTS;

  readonly data = signal<ProfileData | null>(null);
  readonly loading = signal(true);
  readonly notFound = signal(false);

  /** Trang dang xem la ho so cua ai (theo duong dan), 'me' = chinh minh. */
  private readonly who = signal('me');

  // --- che do sua ---
  readonly editing = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly headlineDraft = signal('');
  readonly bioDraft = signal('');
  readonly accentDraft = signal('');
  readonly interestsDraft = signal<string[]>([]);
  readonly interestInput = signal('');
  readonly busyPhoto = signal<'' | 'avatar' | 'cover'>('');

  readonly loadingMore = signal(false);

  /** Cot phai: mac dinh la TUONG ca nhan; hoat dong thu ve mot nut. */
  readonly tab = signal<'wall' | 'activity'>('wall');
  /** So bai tren tuong, do component con bao len de hien tren nut. */
  readonly wallTotal = signal(0);

  readonly bioLeft = computed(() => MAX_BIO - this.bioDraft().length);
  /** Tong mau ap cho ca trang: dang sua thi xem truoc ngay tong dang chon. */
  readonly accentClass = computed(
    () => 'acc-' + ((this.editing() ? this.accentDraft() : this.data()?.accent) || 'brand'),
  );

  constructor() {
    this.route.paramMap.subscribe((p) => {
      this.who.set(p.get('username') || 'me');
      this.editing.set(false);
      this.tab.set('wall');
      this.wallTotal.set(0);
      void this.load();
    });
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.notFound.set(false);
    const data = await this.api.get(this.who());
    if (!data) {
      this.notFound.set(true);
      this.data.set(null);
    } else {
      this.data.set(data);
    }
    this.loading.set(false);
  }

  // ------------------------------------------------------------- hien thi --
  readonly vi = computed(() => this.lang() === 'vi');

  when(iso: string): string {
    return relTime(iso, this.lang());
  }

  /** Anh dai dien co lon: dung chung cach tinh chu cai / mau voi ca trang. */
  readonly initialsOf = computed(() => initials(this.data()?.fullName ?? ''));
  readonly hueOf = computed(() => avatarHue(this.data()?.fullName ?? ''));

  /** "Vào công ty tháng 6/2021 · 5,2 năm" — chi thang/nam, khong lo ngay. */
  joined(): string {
    const d = this.data();
    if (!d?.joinedAt) return '';
    const [y, m] = d.joinedAt.split('-');
    const head = this.vi() ? `Gắn bó từ ${+m}/${y}` : `Joined ${+m}/${y}`;
    if (d.tenureYears == null) return head;
    const n = this.vi() ? d.tenureYears.toFixed(1).replace('.', ',') : d.tenureYears.toFixed(1);
    return `${head} · ${n} ${this.vi() ? 'năm' : 'yrs'}`;
  }

  activityText(a: Activity): string {
    const v = this.vi();
    if (a.kind === 'post') return v ? 'đã đăng bài' : 'published';
    if (a.kind === 'comment') return v ? 'đã bình luận trong' : 'commented on';
    return v ? 'đã bày tỏ cảm xúc với' : 'reacted to';
  }

  activityIcon(a: Activity): string {
    return a.kind === 'post' ? 'newspaper' : a.kind === 'comment' ? 'message' : 'heart';
  }

  // -------------------------------------------------------------- sua ho so --
  startEdit(): void {
    const d = this.data();
    if (!d) return;
    this.headlineDraft.set(d.headline);
    this.bioDraft.set(d.bio);
    this.accentDraft.set(d.accent || 'brand');
    this.interestsDraft.set([...d.interests]);
    this.interestInput.set('');
    this.error.set('');
    this.editing.set(true);
  }

  cancelEdit(): void {
    this.editing.set(false);
    this.error.set('');
  }

  onHeadline(e: Event): void {
    this.headlineDraft.set((e.target as HTMLInputElement).value.slice(0, MAX_HEADLINE));
  }
  onBio(e: Event): void {
    this.bioDraft.set((e.target as HTMLTextAreaElement).value.slice(0, MAX_BIO));
  }
  onInterestInput(e: Event): void {
    this.interestInput.set((e.target as HTMLInputElement).value);
  }

  /** Enter hoac dau phay = chot mot the. */
  onInterestKey(e: KeyboardEvent): void {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      this.addInterest();
    } else if (e.key === 'Backspace' && !this.interestInput()) {
      this.interestsDraft.update((t) => t.slice(0, -1));
    }
  }

  addInterest(): void {
    const tag = this.interestInput().trim().replace(/,/g, '').slice(0, 28);
    if (!tag) return;
    const cur = this.interestsDraft();
    if (cur.length >= MAX_INTERESTS) return;
    if (cur.some((t) => t.toLowerCase() === tag.toLowerCase())) {
      this.interestInput.set('');
      return;
    }
    this.interestsDraft.set([...cur, tag]);
    this.interestInput.set('');
  }

  removeInterest(tag: string): void {
    this.interestsDraft.update((t) => t.filter((x) => x !== tag));
  }

  pickAccent(id: string): void {
    this.accentDraft.set(id);
  }

  async save(): Promise<void> {
    this.saving.set(true);
    this.error.set('');
    const saved = await this.api.save({
      headline: this.headlineDraft(),
      bio: this.bioDraft(),
      accent: this.accentDraft(),
      interests: this.interestsDraft(),
    });
    this.saving.set(false);
    if (!saved) {
      this.error.set(this.vi() ? 'Không lưu được, thử lại giúp mình.' : 'Could not save, please retry.');
      return;
    }
    this.data.set(saved);
    this.editing.set(false);
  }

  /** Bam "Nhan tin" tren ho so nguoi khac -> mo cuoc tro chuyen 1-1 voi ho. */
  async message(username: string): Promise<void> {
    this.chat.start();
    const id = await this.chat.openDm(username);
    if (id != null) void this.router.navigate(['/chat']);
  }

  // ----------------------------------------------------------------- anh --
  async onPhoto(kind: 'avatar' | 'cover', e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';                      // chon lai cung file van kich hoat
    if (!file) return;
    this.busyPhoto.set(kind);
    this.error.set('');
    const res = await this.api.uploadPhoto(kind, file);
    this.busyPhoto.set('');
    if ('error' in res) {
      this.error.set(res.error);
      return;
    }
    this.data.update((d) => (d ? { ...d, [kind]: res.url } : d));
    if (kind === 'avatar') this.userSvc.setAvatar(res.url);
  }

  async removePhoto(kind: 'avatar' | 'cover'): Promise<void> {
    this.busyPhoto.set(kind);
    const ok = await this.api.removePhoto(kind);
    this.busyPhoto.set('');
    if (!ok) return;
    this.data.update((d) => (d ? { ...d, [kind]: '' } : d));
    if (kind === 'avatar') this.userSvc.setAvatar('');
  }

  // -------------------------------------------------------- dong thoi gian --
  async loadMore(): Promise<void> {
    const d = this.data();
    if (!d || this.loadingMore()) return;
    this.loadingMore.set(true);
    const res = await this.api.activity(d.username, d.activity.length);
    this.loadingMore.set(false);
    if (!res) return;
    this.data.update((cur) =>
      cur ? { ...cur, activity: [...cur.activity, ...res.activity], activityMore: res.activityMore } : cur,
    );
  }
}
