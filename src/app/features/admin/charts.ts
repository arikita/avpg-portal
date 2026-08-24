import { ChangeDetectionStrategy, Component, ElementRef, computed, input, signal, viewChild } from '@angular/core';

/**
 * Bieu do cua bang dieu khien — SVG/CSS thuan, KHONG thu vien.
 *
 * Vi sao khong keo Chart.js/ApexCharts: portal chay sau Kerberos va Apache
 * KHONG cho tai gi tu CDN; them mot thu vien ve la them ~60 kB vao bundle cho
 * ba hinh ve. Ba hinh nay ve tay het ~200 dong.
 *
 * LUAT VE HINH (theo dung thu tu, mau la buoc CUOI):
 *   1. MOT truc. Khong bao gio hai truc y tren cung mot khung — "luot xem" va
 *      "so nguoi" khac don vi thi tach thanh HAI bieu do canh nhau.
 *   2. Mot hue tuan tu cho "nhieu/it". Mau khac nhau chi de phan biet DANH
 *      TINH, ma o day khong co danh tinh nao can phan biet.
 *   3. Chu KHONG BAO GIO mang mau du lieu — nhan/so dung mau chu; cham mau
 *      canh ben moi la thu mang danh tinh.
 *   4. Khong ghi so len moi diem. Chi ghi diem cuoi / diem cuc tri; con lai de
 *      cho tooltip va bang.
 */

export interface Point {
  label: string;
  value: number;
}

/** 1.284 · 12,9K — so lon trong o thong ke doc bang mat, khong doc tung chu so. */
export function compact(n: number): string {
  if (!isFinite(n)) return '0';
  if (Math.abs(n) >= 10000)
    return new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
  return n.toLocaleString('vi-VN');
}

/** Tran truc y lam tron len so "dep" — 0/50/100 chu khong phai 0/47/94. */
function niceMax(v: number): number {
  if (v <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  for (const s of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (v <= s * mag) return s * mag;
  return 10 * mag;
}

// ===========================================================================
// Duong xu huong — mot chuoi, to bong 10%, cham cuoi co vien nen 2px
// ===========================================================================
// Vi sao KHONG ve chu bang <text> trong SVG: SVG co viewBox se co gian theo be
// rong the chua, va chu co gian theo. Cung mot bieu do nam o cot hep thi nhan
// truc con ~6px (khong doc noi), nam o khung rong thi phong to nhu tieu de.
// Nen: SVG chi ve NET (duong, bong, luoi); moi chu va cham deu la the HTML dat
// theo phan tram => luon dung co chu that, va cham luon tron.
// Duong ke dung `vector-effect="non-scaling-stroke"` de giu dung 2px du khung
// co bien dang the nao.
@Component({
  selector: 'adm-trend',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="adm-trend" (pointermove)="move($event)" (pointerleave)="hover.set(-1)" (pointercancel)="hover.set(-1)">
      <div class="ax-y">
        @for (g of gridlines(); track g.f) {
          <span [style.bottom.%]="g.f * 100">{{ g.t }}</span>
        }
      </div>

      <div class="plot" #plot>
        @for (g of gridlines(); track g.f) {
          <i class="grid" [style.bottom.%]="g.f * 100"></i>
        }

        <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" [attr.aria-label]="title()">
          @if (pts().length > 1) {
            <path [attr.d]="areaD()" fill="var(--viz-1-soft)" />
            <path
              [attr.d]="lineD()"
              fill="none"
              stroke="var(--viz-1)"
              stroke-width="2"
              stroke-linejoin="round"
              stroke-linecap="round"
              vector-effect="non-scaling-stroke"
            />
          }
        </svg>

        @if (pts().length > 1) {
          <i class="dot" [style.left.%]="pts()[pts().length - 1].x" [style.top.%]="pts()[pts().length - 1].y"></i>
          <b class="end" [style.left.%]="pts()[pts().length - 1].x" [style.top.%]="pts()[pts().length - 1].y">
            {{ fmt(data()[data().length - 1].value) }}
          </b>
        }

        @if (hover() >= 0 && pts()[hover()]; as h) {
          <i class="cross" [style.left.%]="h.x"></i>
          <i class="dot" [style.left.%]="h.x" [style.top.%]="h.y"></i>
        }

        @if (hover() >= 0 && data()[hover()]; as d) {
          <div class="adm-tip" [style.left.%]="pts()[hover()].x">
            <div class="t">{{ d.label }}</div>
            <b>{{ d.value.toLocaleString('vi-VN') }}</b> {{ unit() }}
          </div>
        }
      </div>

      <div class="ax-x">
        @for (t of ticks(); track t.x) {
          <span [style.left.%]="t.x" [class.first]="t.x === 0" [class.last]="t.x === 100">{{ t.label }}</span>
        }
      </div>

    </div>
  `,
})
export class AdmTrend {
  private readonly plot = viewChild<ElementRef<HTMLElement>>('plot');

  readonly data = input<Point[]>([]);
  readonly title = input('');
  readonly unit = input('');

  readonly hover = signal(-1);

  readonly max = computed(() => niceMax(Math.max(1, ...this.data().map((d) => d.value))));

  /** Toa do theo PHAN TRAM khung ve — khong phu thuoc kich thuoc that. */
  readonly pts = computed(() => {
    const d = this.data();
    const n = d.length;
    if (!n) return [] as { x: number; y: number }[];
    return d.map((p, i) => ({
      x: n > 1 ? (i / (n - 1)) * 100 : 50,
      y: 100 - (p.value / this.max()) * 100,
    }));
  });

  readonly lineD = computed(() =>
    this.pts()
      .map((p, i) => (i ? 'L' : 'M') + p.x.toFixed(2) + ' ' + p.y.toFixed(2))
      .join(' '),
  );

  readonly areaD = computed(() => {
    const p = this.pts();
    if (p.length < 2) return '';
    return `${this.lineD()} L100 100 L0 100 Z`;
  });

  /** Ba moc truc y: 0, giua, tran. Lam tron len so "dep" truoc khi hien. */
  readonly gridlines = computed(() =>
    [0, 0.5, 1].map((f) => ({ f, t: compact(Math.round(this.max() * f)) })),
  );

  /** Chi ba moc ngay: dau / giua / cuoi. Nhieu hon la chu chong len nhau. */
  readonly ticks = computed(() => {
    const d = this.data();
    if (d.length < 2) return [] as { x: number; label: string }[];
    const mid = Math.floor((d.length - 1) / 2);
    return [
      { x: 0, label: d[0].label },
      { x: 50, label: d[mid].label },
      { x: 100, label: d[d.length - 1].label },
    ];
  });

  fmt = compact;

  /** Doi toa do chuot -> chi so diem, do tren KHUNG VE (khong ke le truc y). */
  move(ev: PointerEvent): void {
    const n = this.data().length;
    const el = this.plot()?.nativeElement;
    if (n < 2 || !el) return;
    const box = el.getBoundingClientRect();
    if (!box.width) return;
    const rel = (ev.clientX - box.left) / box.width;
    this.hover.set(Math.max(0, Math.min(n - 1, Math.round(rel * (n - 1)))));
  }
}

// ===========================================================================
// Xep hang ngang — HTML/CSS, khong SVG: nhan dai bao nhieu cung khong bi cat
// ===========================================================================
@Component({
  selector: 'adm-bars',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!data().length) {
      <div class="adm-empty">{{ empty() }}</div>
    } @else {
      <div class="adm-bars">
        @for (d of data(); track d.label) {
          <div class="adm-bar-row" [attr.title]="d.label + ': ' + d.value.toLocaleString('vi-VN')">
            <div class="k">{{ d.label }}</div>
            <div class="track">
              <div class="fill" [style.width.%]="pct(d.value)"></div>
            </div>
            <div class="v">{{ fmt(d.value) }}</div>
          </div>
        }
      </div>
    }
  `,
})
export class AdmBars {
  readonly data = input<Point[]>([]);
  readonly empty = input('Chưa có dữ liệu');
  readonly max = computed(() => Math.max(1, ...this.data().map((d) => d.value)));
  fmt = compact;
  pct(v: number): number {
    return Math.max(1.5, (v / this.max()) * 100);
  }
}

// ===========================================================================
// Cot theo gio trong ngay
// ===========================================================================
@Component({
  selector: 'adm-cols',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="adm-cols">
      @for (d of data(); track d.label) {
        <div class="c" [attr.title]="d.label + ': ' + d.value.toLocaleString('vi-VN')">
          <div class="col"><div class="fill" [style.height.%]="pct(d.value)"></div></div>
          <div class="t">{{ d.label }}</div>
        </div>
      }
    </div>
  `,
})
export class AdmCols {
  readonly data = input<Point[]>([]);
  readonly max = computed(() => Math.max(1, ...this.data().map((d) => d.value)));
  pct(v: number): number {
    return v > 0 ? Math.max(3, (v / this.max()) * 100) : 0;
  }
}

// ===========================================================================
// Duong nho trong o so lieu (12 diem) — khong truc, khong nhan
// ===========================================================================
@Component({
  selector: 'adm-spark',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 120 32" preserveAspectRatio="none" aria-hidden="true" style="width:100%;height:32px;display:block">
      @if (d()) {
        <path [attr.d]="d()" fill="none" [attr.stroke]="'var(--viz-1)'" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
      }
    </svg>
  `,
})
export class AdmSpark {
  readonly data = input<number[]>([]);
  readonly d = computed(() => {
    const v = this.data().slice(-12);
    if (v.length < 2) return '';
    const max = Math.max(1, ...v);
    const step = 118 / (v.length - 1);
    return v
      .map((n, i) => (i ? 'L' : 'M') + (1 + i * step).toFixed(1) + ' ' + (30 - (n / max) * 28).toFixed(1))
      .join(' ');
  });
}
