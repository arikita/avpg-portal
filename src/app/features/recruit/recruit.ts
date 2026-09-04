import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import {
  LINK_NHAN_VIEN_MOI,
  MAU_THU_TU_CHOI,
  MauThu,
  THU_KET,
  THU_MO_DAU,
  TIEU_DE_MAC_DINH,
} from '../../content/recruit.content';
import { ContentService } from '../../core/services/content.service';
import { LanguageService } from '../../core/services/language.service';
import { UserService } from '../../core/services/user.service';
import { ApiService } from '../../core/services/api';
import { IconComponent } from '../../shared/components/icon/icon';

/** Phòng ban được dùng trang này. So sau khi trim + hạ chữ thường. */
const PHONG_DUOC_DUNG = ['information system', 'human resources'];

/**
 * Cong cu soan thu cho phong Nhan su — /tuyen-dung.
 *
 * Chuyen tu site tinh cu (nhanh `main`, GitHub Pages) vao portal 04/09/2026.
 *
 * BON DIEU DANG BIET:
 *
 *  1. PHAN QUYEN O DAY LA HANG RAO GIAY, KHONG PHAI HANG RAO THAT.
 *     Toan bo cong cu chay trong trinh duyet, ma nguon nam trong bundle ma ca
 *     850 nguoi tai ve, va go thang duong dan van vao duoc. No CHI de trang
 *     nay khong bay ra truoc mat nguoi khong lien quan.
 *     Chap nhan duoc vi: mau thu tu choi khong phai bi mat, va `mailto:` mo
 *     Outlook CUA CHINH NGUOI BAM nen khong ai mao danh Nhan su duoc.
 *     Neu sau nay them viec that su nhay cam (xem danh sach ung vien, luu ho
 *     so) thi PHAI dung hang rao o server, dung tin vao cai `@if` nay.
 *
 *  2. LOC THEO `department` CUA AD, KHONG THEO NHOM BAO MAT.
 *     Cung ly do voi nut Bao loi (xem ghi chu isITDept trong app.ts): nhom
 *     `Human Resources` tren AD con chua nguoi ngoai phong va 40 tai khoan da
 *     nghi, dung no la mo cho ca nhung nguoi do.
 *
 *  3. `mailto:` NHET VAO IFRAME AN, khong dung `window.open`.
 *     Giu nguyen thu thuat cua ban cu: tren HTTPS, `window.open('mailto:...')`
 *     bi trinh duyet chan hoac mo mot tab trang roi treo o do. Gan `src` cho
 *     mot iframe an thi Outlook nhan duoc lenh ma khong tab nao bi mo.
 *
 *  4. KHONG CO DAU VET. `mailto:` chi MO san mot thu nhap trong Outlook —
 *     nguoi dung van phai tu bam Gui. Portal khong biet thu da gui hay chua,
 *     gui cho ai, luc nao. Day la quyet dinh cua user (04/09/2026): doi lai la
 *     khong phai dung SMTP. Muon co luu vet thi phai gui o server.
 */
@Component({
  selector: 'app-recruit',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './recruit.html',
  styleUrl: './recruit.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Recruit {
  private readonly api = inject(ApiService);
  private readonly content = inject(ContentService);
  private readonly userSvc = inject(UserService);
  readonly lang = inject(LanguageService).lang;
  readonly vi = computed(() => this.lang() === 'vi');

  readonly linkNhanVienMoi = LINK_NHAN_VIEN_MOI;

  /** Chua doc xong /api/me thi chua ket luan duoc — tra `null` de trang hien
   *  trang thai dang tai, khong nhap nhay "khong co quyen" roi lai hien ra. */
  readonly duocDung = computed<boolean | null>(() => {
    const me = this.userSvc.me();
    if (!me) return null;
    return PHONG_DUOC_DUNG.includes((me.department ?? '').trim().toLowerCase());
  });

  readonly mauThu = computed<MauThu[]>(() =>
    this.content.pick('recruit', 'MAU_THU_TU_CHOI', MAU_THU_TU_CHOI),
  );

  readonly mauDangChon = signal(MAU_THU_TU_CHOI[0].id);
  readonly email = signal('');
  readonly hoTen = signal('');
  readonly gioiTinh = signal<'' | 'Nam' | 'Nữ'>('');
  readonly viTri = signal('');
  readonly tieuDe = signal('');
  /** Người dùng sửa tay nội dung thì không ghi đè nữa. */
  readonly noiDungSua = signal<string | null>(null);
  readonly daMo = signal(false);

  constructor() {
    const td = this.content.pick('recruit', 'TIEU_DE_MAC_DINH', TIEU_DE_MAC_DINH);
    this.tieuDe.set(this.vi() ? td.vi : td.en);
  }

  /** Thư đã soạn. Người dùng sửa tay thì giữ nguyên bản họ sửa. */
  readonly noiDung = computed(() => this.noiDungSua() ?? this.soanThu());

  private soanThu(): string {
    const l = this.vi() ? 'vi' : 'en';
    const gt = this.gioiTinh();
    const chen = (s: string) =>
      s
        .replaceAll('{xungHo}', gt === 'Nam' ? 'Mr' : gt === 'Nữ' ? 'Ms' : 'Mr/Ms')
        .replaceAll('{hoTen}', this.hoTen().trim() || (this.vi() ? '[Họ và tên]' : '[Full name]'))
        .replaceAll('{anhChi}', gt === 'Nam' ? 'Anh' : gt === 'Nữ' ? 'Chị' : 'Anh/chị')
        .replaceAll('{viTri}', this.viTri().trim() || (this.vi() ? '[Vị trí]' : '[Position]'));

    const mo = this.content.pick('recruit', 'THU_MO_DAU', THU_MO_DAU)[l];
    const ket = this.content.pick('recruit', 'THU_KET', THU_KET)[l];
    const mau = this.mauThu().find((m) => m.id === this.mauDangChon()) ?? this.mauThu()[0];
    return [chen(mo), chen(mau.lyDo[l]), chen(ket)].join('\n\n');
  }

  chonMau(id: string): void {
    this.mauDangChon.set(id);
    // Doi mau thi soan lai tu dau — nguoi dung vua chon mot ly do khac, giu
    // ban ho sua truoc do la giu lai dung cai ly do vua bi thay.
    this.noiDungSua.set(null);
  }

  dat(o: 'email' | 'hoTen' | 'viTri' | 'tieuDe', v: string): void {
    this[o].set(v);
    if (o !== 'tieuDe') this.noiDungSua.set(null);
  }

  datGioiTinh(v: string): void {
    this.gioiTinh.set(v as '' | 'Nam' | 'Nữ');
    this.noiDungSua.set(null);
  }

  /** Mở Outlook với thư đã soạn sẵn. Xem ghi chú (3) và (4) đầu file. */
  moOutlook(): void {
    const url =
      // DIA CHI KHONG DUOC MA HOA. `encodeURIComponent` doi `@` thanh `%40`,
      // ma Outlook khong giai ma phan dia chi cua `mailto:` — no nhan mot
      // nguoi nhan vo nghia roi khong mo gi ca. Ban tinh cu de nguyen dia chi
      // va chay duoc; toi them ma hoa vao va lam hong (user bao 04/09/2026).
      // Chi bo khoang trang va xuong dong, thu chan chen them tham so vao URL.
      `mailto:${this.email().trim().replace(/[\s<>"]/g, '')}` +
      `?subject=${encodeURIComponent(this.tieuDe())}` +
      // Outlook can \r\n moi xuong dong dung; chi \n thi cac doan dinh lien nhau.
      `&body=${encodeURIComponent(this.noiDung().replace(/\n/g, '\r\n'))}`;
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    iframe.src = url;
    setTimeout(() => iframe.remove(), 2000);
    this.daMo.set(true);
  }

  // ------------------------------------------------------- anh chao mung --
  /** Anh chan dung nguoi dung chon. Chi giu trong bo nho, khong tai len cho
   *  nao khac ngoai chinh portal. */
  readonly anhGoc = signal<File | null>(null);
  readonly anhKetQua = signal<string>('');
  readonly dangVe = signal(false);
  readonly loiAnh = signal('');
  readonly acmTen = signal('');
  readonly acmChucVu = signal('');
  readonly acmPhongBan = signal('');
  readonly acmDienThoai = signal('');
  readonly acmNgay = signal('');
  readonly acmGioiTinh = signal<'' | 'Nam' | 'Nữ'>('');

  chonAnh(ev: Event): void {
    const f = (ev.target as HTMLInputElement).files?.[0] ?? null;
    this.anhGoc.set(f);
    this.loiAnh.set('');
  }

  readonly duVeAnh = computed(() => !!this.anhGoc() && !!this.acmTen().trim());

  /**
   * Goi server ghep anh. Anh chan dung KHONG roi mang noi bo — day la ly do
   * chinh keo viec nay ve tu Render (xem ghi chu dau server/app/welcome_anh.py).
   */
  async veAnh(): Promise<void> {
    const f = this.anhGoc();
    if (!f || this.dangVe()) return;
    this.dangVe.set(true);
    this.loiAnh.set('');
    // Thu cu roi moi tao cai moi — moi blob URL giu mot anh trong bo nho cho
    // toi khi bi thu hoi; bam ve 20 lan la 20 anh nam lai.
    if (this.anhKetQua()) URL.revokeObjectURL(this.anhKetQua());
    this.anhKetQua.set('');
    try {
      const fd = new FormData();
      fd.append('image', f);
      fd.append('name', this.acmTen().trim());
      fd.append('position', this.acmChucVu().trim());
      fd.append('department', this.acmPhongBan().trim());
      fd.append('phone', this.acmDienThoai().trim());
      fd.append('startDate', this.acmNgay());
      fd.append('gender', this.acmGioiTinh());
      const res = await this.api.fetch('/api/tuyen-dung/anh-chao-mung', { method: 'POST', body: fd });
      if (!res.ok) {
        const b = await res.json().catch(() => null);
        this.loiAnh.set(b?.detail || 'Không tạo được ảnh. Thử lại sau ít phút.');
        return;
      }
      this.anhKetQua.set(URL.createObjectURL(await res.blob()));
    } catch {
      this.loiAnh.set('Không gọi được máy chủ. Thử lại sau ít phút.');
    } finally {
      this.dangVe.set(false);
    }
  }

  readonly duSoan = computed(
    () => !!this.email().trim() && !!this.hoTen().trim() && !!this.viTri().trim(),
  );
}
