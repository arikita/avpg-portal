import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { LanguageService } from '../../core/services/language.service';
import { Album, AlbumDetail, GalleryService, Photo } from '../../core/services/gallery.service';
import { IconComponent } from '../../shared/components/icon/icon';
import { TrPipe } from '../../shared/pipes/tr.pipe';

/** So anh hien moi lan (bam "Xem them" de load tiep) — 1 album co the vai nghin anh. */
const PAGE = 120;

/**
 * Thu vien anh hoat dong: khong co :slug thi liet ke album, co thi mo album do
 * (luoi anh + xem lon). Anh nam o /media (Apache bat Kerberos) nen chi nhan
 * vien dang nhap moi xem duoc.
 */
@Component({
  selector: 'app-gallery',
  imports: [RouterLink, TrPipe, IconComponent],
  templateUrl: './gallery.html',
  styleUrl: './gallery.scss',
})
export class Gallery {
  private readonly svc = inject(GalleryService);
  private readonly route = inject(ActivatedRoute);
  readonly lang = inject(LanguageService).lang;

  readonly albums = signal<Album[]>([]);
  readonly album = signal<AlbumDetail | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly shown = signal(PAGE);

  /** Vi tri anh dang xem lon; null = dong. */
  readonly viewing = signal<number | null>(null);

  readonly photos = computed<Photo[]>(() => this.album()?.photos ?? []);
  readonly visible = computed(() => this.photos().slice(0, this.shown()));
  readonly current = computed(() => {
    const i = this.viewing();
    return i === null ? null : this.photos()[i] ?? null;
  });

  constructor() {
    this.route.paramMap.subscribe((p) => void this.load(p.get('slug')));
  }

  private async load(slug: string | null): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    this.viewing.set(null);
    this.shown.set(PAGE);
    try {
      if (slug) {
        this.album.set(await this.svc.album(slug));
      } else {
        this.album.set(null);
        this.albums.set((await this.svc.albums()).albums);
      }
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  more(): void {
    this.shown.update((n) => n + PAGE);
  }

  open(i: number): void {
    this.viewing.set(i);
    document.body.style.overflow = 'hidden';
  }

  close(): void {
    this.viewing.set(null);
    document.body.style.overflow = '';
  }

  step(d: number): void {
    const n = this.photos().length;
    if (!n) return;
    this.viewing.update((i) => (i === null ? null : (i + d + n) % n));
    // Da xem toi cuoi trang hien tai thi mo them cho luoi phia sau.
    const i = this.viewing();
    if (i !== null && i >= this.shown()) this.shown.set(Math.ceil((i + 1) / PAGE) * PAGE);
  }

  @HostListener('document:keydown', ['$event'])
  onKey(ev: KeyboardEvent): void {
    if (this.viewing() === null) return;
    if (ev.key === 'Escape') this.close();
    else if (ev.key === 'ArrowRight') this.step(1);
    else if (ev.key === 'ArrowLeft') this.step(-1);
    else return;
    ev.preventDefault();
  }
}
