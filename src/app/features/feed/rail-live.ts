import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ChatService } from '../../core/services/chat.service';
import { LanguageService } from '../../core/services/language.service';
import { NewsService } from '../../core/services/news.service';
import { RailData, RailNewcomer, RailNews, RailPerson, RailPhotos, RailPoll } from '../../core/models/rail.models';
import { AvatarComponent } from '../../shared/components/avatar/avatar';
import { IconComponent } from '../../shared/components/icon/icon';
import { relTime } from '../news/news.util';

/**
 * Cot PHAI trang Doi song: nhung gi dang dien ra trong cong ty.
 *
 * Anh su kien -> ai dang mo portal -> tin moi -> binh chon dang mo -> thanh
 * vien moi. Moi o tu an minh khi khong co du lieu, nen cot khong bao gio hien
 * khung rong.
 */
@Component({
  selector: 'app-rail-live',
  imports: [RouterLink, IconComponent, AvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- ================================================= anh su ki?n -->
    @if (photos(); as g) {
      @if (g.photos.length) {
        <section class="card ph">
          <h4>
            <app-icon name="images" /> {{ g.title[lang()] || (vi() ? 'Khoảnh khắc' : 'Moments') }}
          </h4>
          <div class="mosaic">
            @for (p of g.photos; track p.thumb; let i = $index) {
              <a class="cell c{{ i + 1 }}" [routerLink]="['/gallery', g.slug]">
                <img [src]="p.thumb" alt="" loading="lazy" />
              </a>
            }
            <a class="cell more" [routerLink]="['/gallery', g.slug]">
              <b>+{{ g.count - g.photos.length }}</b>
              <span>{{ vi() ? 'ảnh' : 'photos' }}</span>
            </a>
          </div>
        </section>
      }
    }

    <!-- ==================================================== dang online -->
    <section class="card">
      <h4><span class="dot"></span> {{ vi() ? 'Đang trực tuyến' : 'Online now' }}</h4>
      @if (online().length) {
        <div class="people">
          @for (p of online(); track p.username) {
            <button type="button" class="person" (click)="chatWith(p.username)" [attr.title]="p.name">
              <span class="wrap">
                <app-avatar [username]="p.username" [name]="p.name" [size]="38" />
                <i class="on"></i>
              </span>
              <span class="pn">{{ short(p.name) }}</span>
            </button>
          }
        </div>
      } @else {
        <p class="empty">{{ vi() ? 'Chưa thấy ai khác đang mở portal 👋' : 'Nobody else is here right now 👋' }}</p>
      }
    </section>

    <!-- ======================================================= tin moi -->
    @if (news().length) {
      <section class="card">
        <h4><app-icon name="newspaper" /> {{ vi() ? 'Tin mới' : 'Latest news' }}</h4>
        @for (n of news(); track n.id) {
          <a class="nrow" [routerLink]="['/news', n.id]">
            @if (n.cover) {
              <img [src]="n.cover" alt="" loading="lazy" />
            } @else {
              <span class="nofoto"><app-icon name="newspaper" /></span>
            }
            <span class="ntx">
              <b>{{ n.title[lang()] }}</b>
              <i>{{ when(n.publishedAt) }}</i>
            </span>
          </a>
        }
        <a class="allx" routerLink="/news">{{ vi() ? 'Xem tất cả tin' : 'All news' }} <app-icon name="arrow-right" /></a>
      </section>
    }

    <!-- ==================================================== binh chon -->
    @if (poll(); as p) {
      <section class="card poll">
        <h4><app-icon name="check-square" /> {{ vi() ? 'Đang bình chọn' : 'Open poll' }}</h4>
        <p class="q">{{ p.poll.question }}</p>
        @for (o of p.poll.options; track o.id) {
          <button
            type="button"
            class="opt"
            [class.mine]="o.mine"
            [class.picked]="picked().includes(o.id)"
            [disabled]="busy() || p.poll.closed"
            (click)="choose(p, o.id)"
          >
            @if (showResult(p)) {
              <span class="bar" [style.width.%]="pct(p, o.votes)"></span>
            }
            <span class="lb">{{ o.label }}</span>
            @if (showResult(p)) {
              <span class="pc">{{ pct(p, o.votes) }}%</span>
            } @else if (o.mine || picked().includes(o.id)) {
              <app-icon name="check" />
            }
          </button>
        }
        @if (p.poll.multi && picked().length && !p.poll.voted) {
          <button type="button" class="btn btn-primary btn-sm btn-block send" [disabled]="busy()" (click)="submit(p)">
            {{ vi() ? 'Gửi bình chọn' : 'Submit' }}
          </button>
        }
        <div class="pfoot">
          <span>{{ p.poll.totalVoters }} {{ vi() ? 'người đã chọn' : 'voted' }}</span>
          <a [routerLink]="['/news', p.postId]">{{ vi() ? 'Mở bài' : 'Open post' }}</a>
        </div>
      </section>
    }

    <!-- ================================================ thanh vien moi -->
    @if (newcomers().length) {
      <section class="card">
        <h4><app-icon name="user-plus" /> {{ vi() ? 'Thành viên mới' : 'New faces' }}</h4>
        @for (p of newcomers(); track p.username) {
          <a class="nc" [routerLink]="['/profile', p.username]">
            <app-avatar [username]="p.username" [name]="p.name" [size]="34" />
            <span class="ntx">
              <b>{{ p.name }}</b>
              <i>{{ p.department || (vi() ? 'Vừa gia nhập' : 'Just joined') }} · {{ when(p.joinedAt) }}</i>
            </span>
          </a>
        }
      </section>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .card {
        padding: 16px;
      }
      .card + .card {
        margin-top: 16px;
      }
      h4 {
        display: flex;
        align-items: center;
        gap: 7px;
        font-size: 0.78rem;
        font-weight: 800;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--text-3);
        margin-bottom: 12px;
      }
      h4 svg {
        width: 15px;
        height: 15px;
      }
      /* Cham xanh nhap nhay cho o "dang truc tuyen". */
      .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--success);
        box-shadow: 0 0 0 0 color-mix(in srgb, var(--success) 60%, transparent);
        animation: pulse 2.4s ease-out infinite;
      }
      @keyframes pulse {
        70% {
          box-shadow: 0 0 0 7px transparent;
        }
        100% {
          box-shadow: 0 0 0 0 transparent;
        }
      }
      /* ----------------------------------------------------- mosaic anh */
      .ph {
        padding-bottom: 16px;
      }
      .mosaic {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        grid-auto-rows: 1fr;
        gap: 4px;
        aspect-ratio: 1;
      }
      .cell {
        position: relative;
        overflow: hidden;
        border-radius: 6px;
        background: var(--surface-3);
        display: block;
      }
      .cell img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
        transition: transform 0.5s cubic-bezier(0.2, 0.7, 0.3, 1);
      }
      .cell:hover img {
        transform: scale(1.12);
      }
      .c1 {
        grid-area: 1 / 1 / 3 / 3;
        border-radius: 10px;
      }
      .c2 {
        grid-area: 1 / 3 / 2 / 4;
      }
      .c3 {
        grid-area: 2 / 3 / 3 / 4;
      }
      .c4 {
        grid-area: 3 / 1 / 4 / 2;
      }
      .c5 {
        grid-area: 3 / 2 / 4 / 3;
      }
      .more {
        grid-area: 3 / 3 / 4 / 4;
        display: grid;
        place-content: center;
        text-align: center;
        line-height: 1.1;
        text-decoration: none;
        background: var(--grad-brand-2);
        color: #fff;
      }
      .more b {
        font-size: 0.9rem;
        font-weight: 800;
      }
      .more span {
        font-size: 0.62rem;
        opacity: 0.9;
      }
      /* --------------------------------------------------- dang online */
      .people {
        display: flex;
        flex-wrap: wrap;
        gap: 10px 6px;
      }
      .person {
        width: 60px;
        border: 0;
        background: none;
        padding: 2px;
        cursor: pointer;
        display: grid;
        justify-items: center;
        gap: 4px;
        border-radius: var(--r-sm);
      }
      .person:hover {
        background: var(--surface-2);
      }
      .wrap {
        position: relative;
        line-height: 0;
      }
      .on {
        position: absolute;
        right: -1px;
        bottom: -1px;
        width: 11px;
        height: 11px;
        border-radius: 50%;
        background: var(--success);
        border: 2px solid var(--surface);
      }
      .pn {
        font-size: 0.68rem;
        color: var(--text-2);
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .empty {
        font-size: 0.84rem;
        color: var(--text-3);
      }
      /* ------------------------------------------------------- tin moi */
      .nrow,
      .nc {
        display: flex;
        gap: 10px;
        align-items: center;
        padding: 8px;
        margin-inline: -8px;
        border-radius: var(--r-sm);
        text-decoration: none;
      }
      .nrow:hover,
      .nc:hover {
        background: var(--surface-2);
      }
      .nrow img,
      .nofoto {
        width: 46px;
        height: 46px;
        border-radius: 9px;
        object-fit: cover;
        flex-shrink: 0;
      }
      .nofoto {
        display: grid;
        place-items: center;
        background: var(--grad-brand);
        color: #fff;
      }
      .nofoto svg {
        width: 18px;
        height: 18px;
      }
      .ntx {
        min-width: 0;
      }
      .ntx b {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        font-size: 0.84rem;
        font-weight: 700;
        color: var(--text);
        line-height: 1.3;
      }
      .ntx i {
        display: block;
        margin-top: 2px;
        font-size: 0.72rem;
        font-style: normal;
        color: var(--text-3);
      }
      .allx {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        margin-top: 8px;
        font-size: 0.8rem;
        font-weight: 700;
        color: var(--brand);
        text-decoration: none;
      }
      .allx svg {
        width: 14px;
        height: 14px;
      }
      /* ------------------------------------------------------ binh chon */
      .q {
        font-weight: 700;
        font-size: 0.92rem;
        margin-bottom: 10px;
      }
      .opt {
        position: relative;
        width: 100%;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 9px 11px;
        margin-bottom: 6px;
        border: 1px solid var(--border-2);
        border-radius: var(--r-sm);
        background: var(--surface);
        cursor: pointer;
        text-align: left;
        overflow: hidden;
        transition: border-color 0.14s ease;
      }
      .opt:hover:not(:disabled) {
        border-color: var(--brand);
      }
      .opt:disabled {
        cursor: default;
      }
      .opt.mine,
      .opt.picked {
        border-color: var(--brand);
        color: var(--brand);
        font-weight: 700;
      }
      .opt svg {
        width: 15px;
        height: 15px;
      }
      .bar {
        position: absolute;
        inset: 0 auto 0 0;
        background: color-mix(in srgb, var(--brand) 14%, transparent);
        transition: width 0.5s cubic-bezier(0.2, 0.7, 0.3, 1);
      }
      .lb,
      .pc {
        position: relative;
        font-size: 0.84rem;
      }
      .lb {
        flex: 1;
        min-width: 0;
      }
      .pc {
        font-weight: 800;
        font-size: 0.78rem;
        color: var(--text-2);
      }
      .send {
        margin-top: 4px;
      }
      .pfoot {
        display: flex;
        justify-content: space-between;
        margin-top: 10px;
        font-size: 0.74rem;
        color: var(--text-3);
      }
      .pfoot a {
        color: var(--brand);
        font-weight: 700;
        text-decoration: none;
      }
      /* Man hinh hep: cot ben nam duoi bang tin va rong bang no — mosaic vuong
         se cao ca man hinh neu khong chan lai. */
      @media (max-width: 1023px) {
        .mosaic {
          max-width: 420px;
          margin-inline: auto;
        }
      }
    `,
  ],
})
export class RailLive {
  private readonly newsSvc = inject(NewsService);
  private readonly chat = inject(ChatService);
  private readonly router = inject(Router);
  readonly lang = inject(LanguageService).lang;
  readonly vi = computed(() => this.lang() === 'vi');

  readonly data = input<RailData | null>(null);

  readonly photos = computed<RailPhotos | null>(() => this.data()?.photos ?? null);
  readonly online = computed<RailPerson[]>(() => this.data()?.online ?? []);
  readonly news = computed<RailNews[]>(() => this.data()?.news ?? []);
  readonly newcomers = computed<RailNewcomer[]>(() => (this.data()?.newcomers ?? []).slice(0, 4));

  /** Ban sao cua o binh chon de bo phieu xong cap nhat tai cho, khong tai lai. */
  readonly poll = linkedSignal<RailPoll | null>(() => this.data()?.poll ?? null);
  readonly picked = signal<number[]>([]);
  readonly busy = signal(false);

  when(iso: string): string {
    return relTime(iso, this.lang());
  }

  /** Ten goi cho vua o duoi avatar: "Tran Duc Manh" -> "Manh". */
  short(name: string): string {
    return name.trim().split(/\s+/).slice(-1)[0] || name;
  }

  async chatWith(username: string): Promise<void> {
    const id = await this.chat.openDm(username);
    if (id != null) void this.router.navigate(['/chat']);
  }

  showResult(p: RailPoll): boolean {
    return p.poll.voted || p.poll.closed;
  }

  pct(p: RailPoll, votes: number): number {
    const total = p.poll.options.reduce((s, o) => s + o.votes, 0);
    return total ? Math.round((votes / total) * 100) : 0;
  }

  /** Mot lua chon: bam la gui luon. Nhieu lua chon: bam de danh dau roi Gui. */
  choose(p: RailPoll, optionId: number): void {
    if (p.poll.voted || p.poll.closed) return;
    if (!p.poll.multi) {
      void this.send(p, [optionId]);
      return;
    }
    this.picked.update((ids) => (ids.includes(optionId) ? ids.filter((i) => i !== optionId) : [...ids, optionId]));
  }

  submit(p: RailPoll): void {
    if (this.picked().length) void this.send(p, this.picked());
  }

  private async send(p: RailPoll, ids: number[]): Promise<void> {
    this.busy.set(true);
    try {
      const res = await this.newsSvc.vote(p.postId, p.poll.id, ids);
      const fresh = res.polls.find((x) => x.id === p.poll.id);
      if (fresh) this.poll.set({ ...p, poll: fresh });
      this.picked.set([]);
    } catch {
      // Bo phieu that bai thi giu nguyen trang thai cu, nguoi dung bam lai duoc.
    } finally {
      this.busy.set(false);
    }
  }
}
