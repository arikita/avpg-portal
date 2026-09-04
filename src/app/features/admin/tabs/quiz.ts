import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { QUIZ_QUESTIONS, QUIZ_TOPICS } from '../../../content/quiz.content';
import { ApiService } from '../../../core/services/api';
import { LanguageService } from '../../../core/services/language.service';
import { IconComponent } from '../../../shared/components/icon/icon';
import { TrPipe } from '../../../shared/pipes/tr.pipe';
import { AdmBars, Point } from '../charts';
import { ago } from '../admin.store';

interface Person {
  username: string;
  fullName: string;
  department: string;
  attempts: number;
  best: number;
  passed: boolean;
  lastAt: string;
  seconds: number;
}

interface Newcomer {
  username: string;
  name: string;
  title: string;
  department: string;
  joinedAt: string;
}

interface QuizReport {
  days: number;
  total: number;
  pass: number;
  attempts: number;
  people: Person[];
  passedPeople: number;
  firstAt: string;
  /** Tong so cau trong kho (50). */
  pool: number;
  /** `asked` = so lan cau do DUOC HOI; day moi la mau so cua ti le sai. */
  weakest: { id: string; asked: number; wrong: number }[];
  newcomers: Newcomer[];
}

/**
 * Tab "Kiểm tra hội nhập" — ket qua bai test sau buoi training IT.
 *
 * Trang co HAI phan, va phan thu hai moi la ly do dang lam:
 *   - Bang nguoi: ai da lam, dat chua, lam may lan. Dung de doi chieu voi danh
 *     sach nhan vien moi.
 *   - "Cau hay sai nhat": mot cau ma phan lon nguoi lam sai KHONG phai loi cua
 *     nhan vien — do la mot cho trong trong buoi training, hoac mot quy dinh
 *     duoc viet ra ma chua bao gio duoc noi ro. Sua BUOI TRAINING, dung sua
 *     nguoi.
 *
 * Noi dung cau hoi lay tu quiz.content.ts (cung mot file ma trang lam bai
 * dung). API chi tra ve ID — chep chu sang backend la tao ra ban thu hai de
 * lech nhau.
 */
@Component({
  selector: 'app-admin-quiz',
  imports: [IconComponent, AdmBars, TrPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './quiz.html',
})
export class AdminQuiz {
  private readonly api = inject(ApiService);
  readonly lang = inject(LanguageService).lang;
  readonly vi = computed(() => this.lang() === 'vi');

  readonly data = signal<QuizReport | null>(null);
  readonly loading = signal(false);

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.data.set(await this.api.json<QuizReport>('/api/admin/quiz?days=180'));
    this.loading.set(false);
  }

  ago = ago;

  readonly passRate = computed(() => {
    const d = this.data();
    if (!d || !d.people.length) return 0;
    return Math.round((d.passedPeople / d.people.length) * 100);
  });

  /** So NGUOI da lam bai (khong phai so luot). */
  readonly peopleCount = computed(() => this.data()?.people.length ?? 0);

  /**
   * Bang "cau nao sai bao nhieu %".
   *
   * MAU SO LA `asked`, KHONG PHAI tong so luot lam bai. Kho co 50 cau ma moi
   * luot chi boc 10, nen chia cho tong luot thi cau nao cung "it loi" — mot
   * cach noi doi bang so hoc. Cau duoc hoi qua it thi ti le chua co nghia,
   * nen danh dau `itMau` thay vi im lang xep no len dau bang.
   */
  readonly weakRows = computed(() => {
    const d = this.data();
    const lang = this.lang();
    if (!d) return [];
    return d.weakest.map((w) => {
      const q = QUIZ_QUESTIONS.find((x) => x.id === w.id);
      return {
        id: w.id,
        text: q ? q.q[lang] : w.id,
        ref: q?.ref.label ?? null,
        asked: w.asked,
        wrong: w.wrong,
        pct: w.asked ? Math.round((w.wrong / w.asked) * 100) : 0,
        itMau: w.asked < 5,
      };
    });
  });

  /** Chi nhung cau du mau, sai nhieu nhat truoc — dung cho bieu do. */
  readonly weakBars = computed<Point[]>(() =>
    this.weakRows()
      .filter((w) => !w.itMau && w.wrong > 0)
      .slice(0, 10)
      .map((w) => ({ label: w.text, value: w.pct })),
  );

  /**
   * Gom theo CHU DE — voi kho 50 cau thi day moi la bang doc duoc.
   *
   * Tung cau le co mau nho va nhieu; "ca mang Bao mat sai 40%" moi la thu noi
   * cho phong IT biet buoi sau phai day lai phan nao.
   */
  readonly topicRows = computed(() => {
    const d = this.data();
    const lang = this.lang();
    if (!d) return [];
    const cua = new Map(QUIZ_QUESTIONS.map((q) => [q.id, q.topic as string]));
    const gom = new Map<string, { asked: number; wrong: number }>();
    for (const w of d.weakest) {
      const t = cua.get(w.id);
      if (!t) continue;                       // cau da bi xoa khoi kho
      const o = gom.get(t) ?? { asked: 0, wrong: 0 };
      o.asked += w.asked;
      o.wrong += w.wrong;
      gom.set(t, o);
    }
    return QUIZ_TOPICS.map((t) => {
      const o = gom.get(t.id) ?? { asked: 0, wrong: 0 };
      return {
        id: t.id as string,
        label: t.label[lang],
        asked: o.asked,
        wrong: o.wrong,
        pct: o.asked ? Math.round((o.wrong / o.asked) * 100) : 0,
      };
    }).sort((a, b) => b.pct - a.pct);
  });

  readonly topicBars = computed<Point[]>(() =>
    this.topicRows().map((t) => ({ label: t.label, value: t.pct })),
  );

  phut(giay: number): string {
    if (!giay) return '—';
    const m = Math.floor(giay / 60);
    const s = giay % 60;
    return m ? `${m}' ${s}"` : `${s}"`;
  }
}
