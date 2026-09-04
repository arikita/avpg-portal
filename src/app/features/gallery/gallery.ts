import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { LanguageService } from '../../core/services/language.service';
import { Album, AlbumDetail, GalleryService, Photo } from '../../core/services/gallery.service';
import { IconComponent } from '../../shared/components/icon/icon';
import { TrPipe } from '../../shared/pipes/tr.pipe';

/** So anh nap them moi lan cuon toi day. Album co the vai nghin anh nen KHONG
 *  bao gio dung het mot luc — 1687 the <img> cung luc lam dung trinh duyet. */
const PAGE = 150;

/** Ti le mac dinh khi anh chua co kich thuoc trong album.json (album cu, hoac
 *  viec sinh thumb chua chay). 3:2 la ti le may anh pho bien nhat. */
const FALLBACK_RATIO = 1.5;

/** Ba kieu bo cuc, moi kieu giai MOT viec khac nhau — khong phai bay ra cho
 *  co lua chon:
 *    justified: xem thong thuong, giu dung ti le, cac anh cung hang cao bang nhau.
 *    cot      : nhip doc kieu bao anh, hop khi album nhieu anh chan dung.
 *    diemnhan : cu vai tam lai co mot tam to gap doi. Day la kieu DUY NHAT tao
 *               ra nhip ke ca khi ca album chup cung mot ti le — album AVP Cup
 *               deu 7008x4672 nen Dong va Cot nhin gan nhu nhau.
 *    vuong    : day dac nhat, de QUET NHANH tim anh cua minh — chap nhan cat bot.
 *  Lua chon duoc nho lai: nguoi ta co thoi quen xem, doi lai moi lan vao la phien. */
type Layout = 'justified' | 'cot' | 'vuong' | 'diemnhan';
const LAYOUTS: Layout[] = ['justified', 'cot', 'diemnhan', 'vuong'];
const LAYOUT_KEY = 'avp.gallery.layout';

/** Nhip trinh chieu (ms). 4 giay: du de nhin mot tam, khong lau den muc chan. */
const SLIDE_MS = 4000;

/** Chieu cao hang muc tieu cua luoi justified, theo be rong man hinh. */
function rowHeight(w: number): number {
  if (w < 560) return 130;
  if (w < 900) return 170;
  return 210;
}

interface DayGroup {
  day: string;
  photos: Photo[];
}

/**
 * Thu vien anh: khong co :slug thi liet ke album, co thi mo album do.
 *
 * LUOI JUSTIFIED (kieu Google Photos) chu khong phai o vuong: luoi vuong cat
 * cut anh doc — chan dung bi cat mat dau. O day moi anh giu dung ti le that,
 * cac anh trong mot hang cao bang nhau, do CSS flex lo:
 *   flex-grow  = ti le  (anh ngang chiem nhieu cho hon)
 *   flex-basis = ti le x chieu cao hang
 * Khong can JS do dac, khong giat khi thay doi be rong.
 *
 * `w`/`h` tu API dung de giu CHO TRUOC khi anh ve toi (aspect-ratio). Thieu no
 * thi bo cuc nhay lien tuc trong luc cuon — day la ly do backend phai ghi kich
 * thuoc vao album.json.
 *
 * Anh nam o /media (Apache bat Kerberos) nen chi nhan vien dang nhap moi xem
 * duoc.
 */
@Component({
  selector: 'app-gallery',
  imports: [RouterLink, TrPipe, IconComponent],
  templateUrl: './gallery.html',
  styleUrl: './gallery.scss',
})
export class Gallery implements OnDestroy {
  private readonly svc = inject(GalleryService);
  private readonly route = inject(ActivatedRoute);
  readonly lang = inject(LanguageService).lang;
  readonly vi = computed(() => this.lang() === 'vi');

  readonly albums = signal<Album[]>([]);
  readonly canManage = signal(false);
  readonly album = signal<AlbumDetail | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly shown = signal(PAGE);

  /** Nhan dang loc o trang danh sach; '' = tat ca. */
  readonly label = signal('');

  /** Vi tri anh dang xem lon; null = dong. */
  readonly viewing = signal<number | null>(null);

  readonly rowH = signal(rowHeight(typeof window === 'undefined' ? 1200 : window.innerWidth));

  readonly layout = signal<Layout>(this.readLayout());
  readonly layouts = LAYOUTS;

  /** Trinh chieu: lightbox tu chay. Dung cho man hinh o sanh / cuoc hop —
   *  day la thu bien thu vien thanh "bo mat tap doan" thay vi mot kho anh. */
  readonly playing = signal(false);
  private slideTimer?: ReturnType<typeof setInterval>;

  private readonly sentinel = viewChild<ElementRef<HTMLElement>>('sentinel');
  private io?: IntersectionObserver;

  readonly photos = computed<Photo[]>(() => this.album()?.photos ?? []);
  readonly visible = computed(() => this.photos().slice(0, this.shown()));
  readonly hasMore = computed(() => this.photos().length > this.shown());

  readonly current = computed(() => {
    const i = this.viewing();
    return i === null ? null : (this.photos()[i] ?? null);
  });

  /** Anh ke tiep — de nap truoc, bam mui ten khong phai cho trang trang. */
  readonly nextUrl = computed(() => {
    const i = this.viewing();
    const p = this.photos();
    return i === null || !p.length ? '' : (p[(i + 1) % p.length]?.full ?? '');
  });

  /** Album da loc theo nhan, gom theo NAM. Nam moi nhat len tren. */
  readonly byYear = computed(() => {
    const want = this.label();
    const list = this.albums().filter((a) => !want || a.label === want);
    const groups = new Map<string, Album[]>();
    for (const a of list) {
      const y = (a.date || '').slice(0, 4) || '—';
      groups.set(y, [...(groups.get(y) ?? []), a]);
    }
    return [...groups.entries()]
      .sort((x, y) => y[0].localeCompare(x[0]))
      .map(([year, items]) => ({ year, items }));
  });

  /** Cac nhan CO THAT trong danh sach — khong ve chip rong cho nhan chua dung. */
  readonly labelsInUse = computed(() => [...new Set(this.albums().map((a) => a.label))].sort());

  /**
   * Anh dang hien, gom theo ngay chup. Mot giai bong da 1687 anh keo dai nhieu
   * ngay; khong chia ra thi khong ai tim duoc tran cua minh.
   * Anh khong co EXIF gom vao mot nhom cuoi.
   */
  readonly groups = computed<DayGroup[]>(() => {
    const out: DayGroup[] = [];
    for (const p of this.visible()) {
      const day = p.day || '';
      const last = out[out.length - 1];
      if (last && last.day === day) last.photos.push(p);
      else out.push({ day, photos: [p] });
    }
    return out;
  });

  /** Co ngay chup nao khong — khong co thi khong ve tieu de nhom. */
  readonly hasDays = computed(() => this.photos().some((p) => !!p.day));

  constructor() {
    this.route.paramMap.subscribe((p) => void this.load(p.get('slug')));

    // Gan bo quan sat khi the moc xuat hien (chi co o trang album).
    effect(() => {
      const el = this.sentinel()?.nativeElement;
      this.io?.disconnect();
      if (!el) return;
      this.io = new IntersectionObserver(
        (es) => {
          if (es.some((e) => e.isIntersecting)) this.more();
        },
        // Nap truoc mot man hinh: cuon toi noi thi anh da san sang.
        { rootMargin: '800px 0px' },
      );
      this.io.observe(el);
    });
  }

  ngOnDestroy(): void {
    this.io?.disconnect();
    this.stopSlides();
    document.body.style.overflow = '';
  }

  private readLayout(): Layout {
    try {
      const v = localStorage.getItem(LAYOUT_KEY) as Layout | null;
      if (v && LAYOUTS.includes(v)) return v;
    } catch {
      /* che do rieng tu / trinh duyet chan — dung mac dinh */
    }
    return 'justified';
  }

  setLayout(l: Layout): void {
    this.layout.set(l);
    try {
      localStorage.setItem(LAYOUT_KEY, l);
    } catch {
      /* khong ghi duoc thi thoi, chi mat viec nho lua chon */
    }
  }

  layoutText(l: Layout): string {
    const vi: Record<Layout, string> = {
      justified: 'Dòng', cot: 'Cột', diemnhan: 'Điểm nhấn', vuong: 'Ô vuông',
    };
    const en: Record<Layout, string> = {
      justified: 'Rows', cot: 'Columns', diemnhan: 'Highlights', vuong: 'Squares',
    };
    return this.vi() ? vi[l] : en[l];
  }

  layoutIcon(l: Layout): string {
    if (l === 'justified') return 'align-left';
    if (l === 'cot') return 'align-center';
    if (l === 'diemnhan') return 'sparkles';
    return 'grid';
  }

  // ------------------------------------------------------- trinh chieu --
  startSlides(): void {
    if (!this.photos().length) return;
    if (this.viewing() === null) this.open(0);
    this.playing.set(true);
    this.slideTimer = setInterval(() => this.step(1), SLIDE_MS);
  }

  stopSlides(): void {
    if (this.slideTimer) clearInterval(this.slideTimer);
    this.slideTimer = undefined;
    this.playing.set(false);
  }

  toggleSlides(): void {
    if (this.playing()) this.stopSlides();
    else this.startSlides();
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
        const r = await this.svc.albums();
        this.albums.set(r.albums);
        this.canManage.set(r.canManage);
      }
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  /** Ti le ngang/doc; anh chua biet kich thuoc thi coi nhu 3:2. */
  ratio(p: Photo): number {
    return p.w > 0 && p.h > 0 ? p.w / p.h : FALLBACK_RATIO;
  }

  /** Vi tri cua anh trong TOAN album (lightbox dem theo album, khong theo nhom). */
  indexOf(p: Photo): number {
    return this.photos().indexOf(p);
  }

  dayLabel(day: string): string {
    if (!day) return this.vi() ? 'Không rõ ngày' : 'Undated';
    const [y, m, d] = day.split('-');
    return this.vi() ? `${d}/${m}/${y}` : `${d}/${m}/${y}`;
  }

  setLabel(l: string): void {
    this.label.set(this.label() === l ? '' : l);
  }

  /** Co the album do Marketing chon. Album cu chua co truong nay => 'thuong'. */
  sizeOf(a: Album): string {
    return a.size === 'noibat' || a.size === 'gon' ? a.size : 'thuong';
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

  more(): void {
    if (this.hasMore()) this.shown.update((n) => n + PAGE);
  }

  open(i: number): void {
    this.viewing.set(i);
    document.body.style.overflow = 'hidden';
  }

  close(): void {
    this.stopSlides();
    this.viewing.set(null);
    document.body.style.overflow = '';
  }

  step(d: number): void {
    const n = this.photos().length;
    if (!n) return;
    this.viewing.update((i) => (i === null ? null : (i + d + n) % n));
    // Da xem toi cuoi phan dang hien thi mo them cho luoi phia sau, de dong
    // xong lightbox van thay dung cho minh vua o.
    const i = this.viewing();
    if (i !== null && i >= this.shown()) this.shown.set(Math.ceil((i + 1) / PAGE) * PAGE);
  }

  @HostListener('window:resize')
  onResize(): void {
    this.rowH.set(rowHeight(window.innerWidth));
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

  // ---- vuot tren dien thoai: khong co thi lightbox gan nhu vo dung o mobile
  private touchX = 0;

  onTouchStart(ev: TouchEvent): void {
    this.touchX = ev.changedTouches[0]?.clientX ?? 0;
  }

  onTouchEnd(ev: TouchEvent): void {
    const dx = (ev.changedTouches[0]?.clientX ?? 0) - this.touchX;
    if (Math.abs(dx) > 50) this.step(dx < 0 ? 1 : -1);
  }
}
