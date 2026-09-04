import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';

import { ApiService } from '../../core/services/api';
import { LanguageService } from '../../core/services/language.service';
import { IconComponent } from '../../shared/components/icon/icon';
import { celebrate } from '../../shared/util/confetti';

/** Trang thai cua nguoi dang dang nhap, tu GET /api/cam-ket. */
interface TrangThai {
  /** Nguoi nay co thuoc dien phai ky khong (tai khoan AD tao tu `tuNgay`). */
  apDung: boolean;
  tuNgay: string;
  joinedAt: string;
  fullName: string;
  department: string;
  title: string;
  email: string;
  /** CHUA_KY | DANG_KY | DA_KY | TU_CHOI */
  status: string;
  signedAt: string;
  /** Duong dan khung ky cua Documenso. Rong khi da ky xong. */
  signUrl: string;
}

/**
 * Ky cam ket bao mat sau buoi hoi nhap IT.
 *
 * KY NGAY TRONG PORTAL, khong day nguoi ta sang mot trang la. Khung ky cua
 * Documenso duoc nhung bang iframe — `/embed/sign/<token>` tra
 * `frame-ancestors *` nen nhung duoc; rieng trang chu cua Documenso thi
 * `'self'`, dung nham duong dan la khung trang tron ma khong bao gi.
 *
 * BA DIEU DANG BIET:
 *
 *  1. GIAO DIEN TRONG KHUNG KY LA TIENG ANH. Documenso khong co tieng Viet
 *     (enum ngon ngu chi co de/en/fr/es/it/nl/pl/pt-BR/ja/ko/zh). Vi vay phan
 *     huong dan tieng Viet phai nam NGOAI khung — ba buoc ngan ngay tren dau
 *     iframe. Bo phan do di la nhan vien moi nhin thay mot bang tieng Anh
 *     khong ai giai thich.
 *
 *  2. KHONG BIET DUOC LUC NAO NGUOI TA KY XONG. iframe khac origin nen portal
 *     khong doc duoc gi ben trong. Nen co nut "Toi da ky xong" de nguoi dung
 *     tu bao, cong voi mot vong hoi lai (`_theoDoi`) moi 5 giay trong luc
 *     khung ky dang mo. Nguon su that van la Documenso — portal chi hoi lai.
 *
 *  3. TAO TAI LIEU LA VIEC CHAM (dap PDF + 4 luot goi API). Nut Ky co trang
 *     thai `dangTao` rieng, neu khong nguoi dung bam hai ba lan vi tuong may
 *     treo. Backend chong trung bang khoa chinh tren `username`, nhung dung
 *     de nguoi dung phai thu.
 */
@Component({
  selector: 'app-cam-ket',
  standalone: true,
  imports: [IconComponent, RouterLink, DatePipe],
  templateUrl: './cam-ket.html',
  styleUrl: './cam-ket.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CamKet {
  private readonly api = inject(ApiService);
  private readonly sanitizer = inject(DomSanitizer);
  readonly lang = inject(LanguageService).lang;
  readonly vi = computed(() => this.lang() === 'vi');

  readonly data = signal<TrangThai | null>(null);
  readonly dangTai = signal(true);
  readonly dangTao = signal(false);
  readonly loi = signal('');
  /** Da bam Ky va khung ky dang mo. */
  readonly dangKy = signal(false);

  readonly daKy = computed(() => this.data()?.status === 'DA_KY');
  readonly apDung = computed(() => this.data()?.apDung === true);

  /** Angular chan src cua iframe neu chua qua sanitizer. */
  readonly khungKy = computed<SafeResourceUrl | null>(() => {
    const url = this.data()?.signUrl;
    return url ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null;
  });

  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    void this.tai();
  }

  ngOnDestroy(): void {
    this._dungTheoDoi();
  }

  async tai(): Promise<void> {
    this.dangTai.set(true);
    const d = await this.api.json<TrangThai>('/api/cam-ket');
    this.data.set(d);
    this.dangTai.set(false);
    if (d?.status === 'DA_KY') this._dungTheoDoi();
  }

  /** Bam "Ky ngay" — backend tao tai lieu (hoac tra lai ban dang co). */
  async ky(): Promise<void> {
    if (this.dangTao()) return;
    this.dangTao.set(true);
    this.loi.set('');
    try {
      const res = await this.api.fetch('/api/cam-ket/ky', { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        this.loi.set(body?.detail || 'Không tạo được bản cam kết. Thử lại sau ít phút.');
        return;
      }
      this.data.set(await res.json());
      this.dangKy.set(true);
      this._theoDoi();
    } catch {
      this.loi.set('Không kết nối được hệ thống ký. Thử lại sau ít phút.');
    } finally {
      this.dangTao.set(false);
    }
  }

  /** Nguoi dung tu bao da ky xong — hoi lai server ngay thay vi doi vong lap. */
  async daXong(): Promise<void> {
    await this.tai();
    if (this.daKy()) {
      this.dangKy.set(false);
      celebrate();
    } else {
      this.loi.set('Hệ thống chưa ghi nhận chữ ký. Hoàn tất các bước trong khung ký rồi bấm lại.');
    }
  }

  /**
   * Hoi lai trang thai moi 5 giay trong luc khung ky mo.
   *
   * iframe khac origin nen khong co cach nao biet nguoi ta bam Complete —
   * xem ghi chu (2) dau file. Chi chay khi khung dang mo, va dung ngay khi
   * thay DA_KY, de khong co mot vong lap treo mai tren tab nguoi dung quen dong.
   */
  private _theoDoi(): void {
    this._dungTheoDoi();
    this.timer = setInterval(async () => {
      const d = await this.api.json<TrangThai>('/api/cam-ket');
      if (!d) return;
      this.data.set(d);
      if (d.status === 'DA_KY') {
        this.dangKy.set(false);
        this._dungTheoDoi();
        celebrate();
      }
    }, 5000);
  }

  private _dungTheoDoi(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
