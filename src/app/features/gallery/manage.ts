import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import {
  GalleryService,
  Job,
  ManageAlbum,
  Photo,
  SourceDir,
} from '../../core/services/gallery.service';
import { LanguageService } from '../../core/services/language.service';
import { UserService } from '../../core/services/user.service';
import { IconComponent } from '../../shared/components/icon/icon';
import { TrPipe } from '../../shared/pipes/tr.pipe';

/**
 * Quan ly thu vien anh — them / sua / xoa album.
 *
 * VI SAO NAM O /gallery/manage CHU KHONG PHAI TRONG /admin:
 * `/admin` chi mo cho danh sach CONTENT_ADMIN_USERS (2 nguoi). Quyen quan ly
 * anh lai thuoc nhom dang tin HR/Marketing/IS — dat trong /admin thi dung
 * nhung nguoi can dung nhat lai khong vao duoc, tuc van y nguyen nut that cu:
 * chi IT moi them duoc anh. Quan ly dat NGAY TAI cho noi dung song.
 *
 * Duong dan `gallery/manage` phai khai TRUOC `gallery/:slug` trong app.routes,
 * va backend giu 'manage' trong RESERVED de khong album nao chiem mat ten do.
 */
@Component({
  selector: 'app-gallery-manage',
  imports: [FormsModule, RouterLink, TrPipe, IconComponent],
  templateUrl: './manage.html',
  styleUrl: './manage.scss',
})
export class GalleryManage implements OnDestroy {
  private readonly svc = inject(GalleryService);
  private readonly router = inject(Router);
  private readonly user = inject(UserService);
  readonly lang = inject(LanguageService).lang;
  readonly vi = computed(() => this.lang() === 'vi');

  readonly albums = signal<ManageAlbum[]>([]);
  readonly labels = signal<string[]>([]);
  readonly sizes = signal<string[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly note = signal('');

  /** null = danh sach; 'new' = dang them; slug = dang sua album do. */
  readonly mode = signal<string | null>(null);

  // ---- trinh duyet thu muc tren share
  readonly srcPath = signal('');
  readonly srcDirs = signal<SourceDir[]>([]);
  readonly srcImages = signal(0);
  readonly srcBusy = signal(false);

  // ---- form
  readonly fSrc = signal('');
  readonly fSlug = signal('');
  readonly fVi = signal('');
  readonly fEn = signal('');
  readonly fDescVi = signal('');
  readonly fDescEn = signal('');
  readonly fDate = signal('');
  readonly fLabel = signal('khac');
  readonly fSize = signal('thuong');
  readonly fStatus = signal('draft');
  readonly fOrder = signal(0);
  readonly saving = signal(false);

  // ---- chon anh bia / anh noi bat
  readonly photos = signal<Photo[]>([]);
  readonly pickBusy = signal(false);
  readonly fCover = signal('');
  readonly fCovers = signal<string[]>([]);
  readonly fFeatured = signal<string[]>([]);

  private timer?: ReturnType<typeof setInterval>;

  /** Nguoi khong co quyen thi khong ve gi — hang rao THAT nam o server, day
   *  chi la khong bay ra mot form vo dung. */
  readonly canManage = computed(() => this.user.me()?.canPostNews === true);

  readonly editing = computed(() => {
    const m = this.mode();
    return m && m !== 'new' ? (this.albums().find((a) => a.slug === m) ?? null) : null;
  });

  /** Con album nao dang sinh thumb khong — con thi phai hoi lai tien do. */
  readonly anyRunning = computed(() => this.albums().some((a) => a.job?.state === 'running'));

  constructor() {
    void this.load();
    // Hoi lai tien do moi 2 giay, va CHI khi con viec dang chay: album 1687
    // anh mat vai phut, khong co thanh tien do thi nguoi dung tuong treo.
    this.timer = setInterval(() => {
      if (this.anyRunning()) void this.load(true);
    }, 2000);
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async load(quiet = false): Promise<void> {
    if (!quiet) this.loading.set(true);
    try {
      const r = await this.svc.manageList();
      this.albums.set(r.albums);
      this.labels.set(r.labels);
      this.sizes.set(r.sizes ?? ['noibat', 'thuong', 'gon']);
      this.error.set('');
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  labelText(l: string): string {
    const vi: Record<string, string> = {
      'su-kien': 'Sự kiện',
      'the-thao': 'Thể thao',
      'dao-tao': 'Đào tạo',
      'nha-may': 'Nhà máy',
      khac: 'Khác',
    };
    const en: Record<string, string> = {
      'su-kien': 'Events',
      'the-thao': 'Sports',
      'dao-tao': 'Training',
      'nha-may': 'Factory',
      khac: 'Other',
    };
    return (this.vi() ? vi[l] : en[l]) ?? l;
  }

  /** Co the album tren trang danh sach — quyen bien tap "bo mat" cua trang. */
  sizeText(s: string): string {
    const vi: Record<string, string> = {
      noibat: 'Nổi bật — chiếm cả hàng',
      thuong: 'Thường',
      gon: 'Gọn — xếp nhiều cái một hàng',
    };
    const en: Record<string, string> = {
      noibat: 'Featured — full row',
      thuong: 'Normal',
      gon: 'Compact',
    };
    return (this.vi() ? vi[s] : en[s]) ?? s;
  }

  statusText(s: string): string {
    if (s === 'public') return this.vi() ? 'Công khai' : 'Public';
    if (s === 'draft') return this.vi() ? 'Bản nháp' : 'Draft';
    return this.vi() ? 'Đang ẩn' : 'Hidden';
  }

  pct(j: Job): number {
    return j?.total ? Math.round(((j.done ?? 0) / j.total) * 100) : 0;
  }

  // ------------------------------------------------- trinh duyet share --
  async browse(path: string): Promise<void> {
    this.srcBusy.set(true);
    this.error.set('');
    try {
      const r = await this.svc.sources(path);
      this.srcPath.set(r.path);
      this.srcDirs.set(r.dirs);
      this.srcImages.set(r.images);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.srcBusy.set(false);
    }
  }

  /** Duong dan cha, de bam quay len mot cap. */
  readonly crumbs = computed(() => {
    const parts = this.srcPath() ? this.srcPath().split('/') : [];
    let acc = '';
    return parts.map((name) => {
      acc = acc ? `${acc}/${name}` : name;
      return { name, path: acc };
    });
  });

  /** Doan ten thu muc thanh slug: bo dau, thay khoang trang bang gach ngang. */
  private toSlug(s: string): string {
    return s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/gi, 'd')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
  }

  chooseSrc(d: SourceDir): void {
    if (d.album) return;                       // da thanh album roi
    this.fSrc.set(d.path);
    this.fSlug.set(this.toSlug(d.name));
    this.fVi.set(d.name);
    this.fEn.set(d.name);
    const y = d.path.match(/\b(20\d{2})\b/);
    this.fDate.set(y ? y[1] : '');
  }

  startNew(): void {
    this.mode.set('new');
    this.note.set('');
    this.fSrc.set('');
    this.fSlug.set('');
    this.fVi.set('');
    this.fEn.set('');
    this.fDescVi.set('');
    this.fDescEn.set('');
    this.fDate.set('');
    this.fLabel.set('khac');
    void this.browse('');
  }

  async startEdit(a: ManageAlbum): Promise<void> {
    this.mode.set(a.slug);
    this.note.set('');
    this.fVi.set(a.title.vi);
    this.fEn.set(a.title.en);
    this.fDescVi.set(a.desc.vi);
    this.fDescEn.set(a.desc.en);
    this.fDate.set(a.date);
    this.fLabel.set(a.label);
    this.fSize.set(a.size || 'thuong');
    this.fStatus.set(a.status);
    this.fOrder.set(a.order);
    this.fCover.set('');
    this.fCovers.set([]);
    this.fFeatured.set([]);
    this.photos.set([]);
    this.pickBusy.set(true);
    try {
      const full = await this.svc.album(a.slug);
      this.photos.set(full.photos);
      this.fFeatured.set(full.photos.filter((p) => p.star).map((p) => p.id));
    } catch {
      /* chua sinh thumb xong thi chua chon bia duoc — khong phai loi */
    } finally {
      this.pickBusy.set(false);
    }
  }

  cancel(): void {
    this.mode.set(null);
    void this.load();
  }

  // ------------------------------------------------------------- ghi ----
  async create(): Promise<void> {
    if (!this.fSrc() || !this.fSlug()) return;
    this.saving.set(true);
    this.error.set('');
    try {
      await this.svc.create({
        slug: this.fSlug(),
        src: this.fSrc(),
        title: { vi: this.fVi(), en: this.fEn() || this.fVi() },
        desc: { vi: this.fDescVi(), en: this.fDescEn() },
        date: this.fDate(),
        label: this.fLabel(),
      });
      this.note.set(
        this.vi()
          ? 'Đã tạo. Đang sinh ảnh thu nhỏ ở chế độ nền — album nghìn ảnh mất vài phút.'
          : 'Created. Thumbnails are being generated in the background.',
      );
      this.mode.set(null);
      await this.load();
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }

  async save(): Promise<void> {
    const slug = this.mode();
    if (!slug || slug === 'new') return;
    this.saving.set(true);
    this.error.set('');
    try {
      const body: Record<string, unknown> = {
        title: { vi: this.fVi(), en: this.fEn() || this.fVi() },
        desc: { vi: this.fDescVi(), en: this.fDescEn() },
        date: this.fDate(),
        label: this.fLabel(),
        size: this.fSize(),
        status: this.fStatus(),
        order: this.fOrder(),
        featured: this.fFeatured(),
      };
      if (this.fCover()) body['cover'] = this.fCover();
      if (this.fCovers().length) body['covers'] = this.fCovers();
      await this.svc.update(slug, body);
      this.note.set(this.vi() ? 'Đã lưu.' : 'Saved.');
      this.mode.set(null);
      await this.load();
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }

  async reindex(a: ManageAlbum): Promise<void> {
    try {
      await this.svc.reindex(a.slug);
      await this.load(true);
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }

  async remove(a: ManageAlbum): Promise<void> {
    const msg = this.vi()
      ? `Xoá album "${a.title.vi}" khỏi portal?\n\nẢnh gốc trên file server KHÔNG bị đụng tới — chỉ xoá ảnh thu nhỏ và thông tin album.`
      : `Remove album "${a.title.en}" from the portal?\n\nOriginals on the file server are NOT touched.`;
    if (!confirm(msg)) return;
    try {
      await this.svc.remove(a.slug);
      await this.load();
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }

  // ------------------------------------------------ chon bia / noi bat --
  setCover(p: Photo): void {
    this.fCover.set(p.id);
    // Bia mosaic: anh vua chon dung dau, ba anh ke tiep bu vao.
    const rest = this.photos()
      .filter((x) => x.id !== p.id)
      .slice(0, 3)
      .map((x) => x.id);
    this.fCovers.set([p.id, ...rest]);
  }

  toggleStar(p: Photo): void {
    this.fFeatured.update((list) =>
      list.includes(p.id) ? list.filter((x) => x !== p.id) : [...list, p.id].slice(0, 12),
    );
  }

  isStar(p: Photo): boolean {
    return this.fFeatured().includes(p.id);
  }

  open(a: ManageAlbum): void {
    void this.router.navigate(['/gallery', a.slug]);
  }
}
