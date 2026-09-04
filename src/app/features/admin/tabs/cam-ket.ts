import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { ApiService } from '../../../core/services/api';
import { LanguageService } from '../../../core/services/language.service';
import { IconComponent } from '../../../shared/components/icon/icon';
import { ago } from '../admin.store';

interface Person {
  username: string;
  fullName: string;
  department: string;
  email: string;
  joinedAt: string;
  /** DANG_KY | DA_KY | TU_CHOI */
  status: string;
  createdAt: string;
  signedAt: string;
}

interface ChuaKy {
  username: string;
  name: string;
  title: string;
  department: string;
  joinedAt: string;
}

interface Report {
  tuNgay: string;
  people: Person[];
  signed: number;
  chuaKy: ChuaKy[];
}

/**
 * Tab "Cam ket bao mat" — xem server/app/camket.py.
 *
 * BANG QUAN TRONG O DAY LA BANG "CHUA KY", khong phai bang "da ky".
 * Danh sach nguoi da ky chi de tra cuu khi can; thu ma phong IT thuc su can
 * nhin moi sang la ai con thieu. Vi vay no dung dau trang va co so dem rieng.
 *
 * `chuaKy` do backend dung recent_accounts roi loc theo ngay chot — da bo tai
 * khoan da tat va tai khoan dung chung. KHONG phai ca 850 nhan vien: ban cam
 * ket chi ap dung cho tai khoan tao tu `tuNgay` tro di.
 *
 * KHONG CO NUT NAO O DAY. admin.py chi doc (luat cung so 2 dau file do), va
 * "nhac ky" thi chua co duong gui — nguoi quan tri nhin ten roi nhac truc
 * tiep. Them mot nut gui mail o day la them mot duong ghi vao mot file cam
 * ghi, va mot hang rao quyen thu hai phai duy tri.
 */
@Component({
  selector: 'app-admin-cam-ket',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './cam-ket.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminCamKet {
  private readonly api = inject(ApiService);
  readonly lang = inject(LanguageService).lang;
  readonly vi = computed(() => this.lang() === 'vi');

  readonly data = signal<Report | null>(null);
  readonly dangTai = signal(true);

  readonly daKy = computed(() => (this.data()?.people ?? []).filter((p) => p.status === 'DA_KY'));
  readonly dangDo = computed(() =>
    (this.data()?.people ?? []).filter((p) => p.status !== 'DA_KY'),
  );
  readonly chuaKy = computed(() => this.data()?.chuaKy ?? []);

  /** Bao nhieu phan tram nguoi thuoc dien da ky xong. */
  readonly tiLe = computed(() => {
    const xong = this.daKy().length;
    const tong = xong + this.chuaKy().length;
    return tong ? Math.round((xong / tong) * 100) : 0;
  });

  /** `ago` can biet ngon ngu; boc lai de template khong phai truyen vi() moi cho. */
  khiNao(iso: string): string {
    return ago(iso, this.vi());
  }

  constructor() {
    void this.tai();
  }

  async tai(): Promise<void> {
    this.dangTai.set(true);
    this.data.set(await this.api.json<Report>('/api/admin/cam-ket'));
    this.dangTai.set(false);
  }

  nhan(status: string): string {
    if (status === 'DA_KY') return this.vi() ? 'Đã ký' : 'Signed';
    if (status === 'TU_CHOI') return this.vi() ? 'Từ chối' : 'Rejected';
    return this.vi() ? 'Đang ký dở' : 'In progress';
  }
}
