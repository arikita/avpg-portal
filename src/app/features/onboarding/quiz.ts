import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import {
  QUIZ_DRAW,
  QUIZ_INTRO,
  QUIZ_PASS,
  QUIZ_QUESTIONS,
  QUIZ_TOPICS,
  QuizQuestion,
} from '../../content/quiz.content';
import { ApiService } from '../../core/services/api';
import { LanguageService } from '../../core/services/language.service';
import { IconComponent } from '../../shared/components/icon/icon';
import { TrPipe } from '../../shared/pipes/tr.pipe';
import { celebrate } from '../../shared/util/confetti';

/** Trang thai cua nguoi dang dang nhap, tu GET /api/quiz. */
interface Status {
  total: number;
  /** Tong so cau trong kho (50) — chi de hien cho nguoi lam bai biet. */
  pool: number;
  pass: number;
  attempts: number;
  best: number;
  passed: boolean;
  lastAt: string;
}

/** Ket qua cham diem, tu POST /api/quiz/submit. */
interface Result {
  score: number;
  total: number;
  pass: number;
  passed: boolean;
  /** ID cac cau tra loi sai. CO Y khong kem dap an dung — xem quiz.py. */
  wrong: string[];
}

/**
 * Bai kiem tra sau buoi hoi nhap IT.
 *
 * MOT CAU MOI MAN HINH, khong phai mot trang dai 10 cau: nguoi lam bai tren
 * dien thoai (nhieu nguoi lam ngay sau buoi training, chua co may) khong phai
 * cuon tim cau chua tra loi, va thanh tien do noi ro con bao xa. Doi lai phai
 * co nut quay lai — va phai xem duoc TOAN BAI truoc khi nop, neu khong thi
 * "lo bam nham cau 3" tro thanh mot cau sai vinh vien.
 *
 * BOC 10 CAU TU KHO 50 MOI LUOT, roi tron ca thu tu cau lan thu tu lua chon
 * (Fisher-Yates). Vi bai lam gui len la ID chuoi chu khong phai so thu tu,
 * tron khong anh huong gi toi cham diem — nhung no lam cho viec truyen tay
 * nhau "1B 2C 3A" thanh vo dung, va kho 50 cau lam viec chep de tro nen vo
 * nghia: hai luot bat ky trung binh chi trung 2 cau.
 *
 * DIEM SO KHONG DUOC TINH O DAY. Client gui cac ID da chon, server cham. Xem
 * ghi chu dau server/app/quiz.py.
 */
@Component({
  selector: 'app-quiz',
  imports: [RouterLink, IconComponent, TrPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './quiz.html',
  styleUrl: './quiz.scss',
})
export class Quiz {
  private readonly api = inject(ApiService);
  readonly lang = inject(LanguageService).lang;
  readonly vi = computed(() => this.lang() === 'vi');

  readonly intro = QUIZ_INTRO;
  readonly passMark = QUIZ_PASS;
  /** So cau MOI LUOT (10), khong phai so cau trong kho (50). */
  readonly totalQuestions = QUIZ_DRAW;
  readonly poolSize = QUIZ_QUESTIONS.length;

  /** intro = man gioi thieu · doing = dang lam · result = da nop. */
  readonly stage = signal<'intro' | 'doing' | 'result'>('intro');
  readonly status = signal<Status | null>(null);
  readonly result = signal<Result | null>(null);
  readonly sending = signal(false);
  readonly failed = signal(false);

  /** De bai cua LUOT NAY — da tron. */
  readonly questions = signal<QuizQuestion[]>([]);
  readonly at = signal(0);
  /** id cau -> id lua chon. */
  readonly picked = signal<Record<string, string>>({});

  private startedAt = 0;

  readonly current = computed(() => this.questions()[this.at()]);
  readonly answeredCount = computed(() => Object.keys(this.picked()).length);
  readonly percent = computed(() =>
    Math.round((this.answeredCount() / Math.max(1, this.totalQuestions)) * 100),
  );
  readonly isLast = computed(() => this.at() === this.questions().length - 1);
  readonly allAnswered = computed(() => this.answeredCount() === this.totalQuestions);

  /** Cau chua tra loi — de "Nop bai" chi ro thay vi bao chung chung. */
  readonly missing = computed(() => {
    const p = this.picked();
    return this.questions()
      .map((q, i) => ({ q, i }))
      .filter((x) => !p[x.q.id]);
  });

  /** Cac cau lam sai, kem duong dan doc lai. */
  readonly wrongQuestions = computed<QuizQuestion[]>(() => {
    const ids = new Set(this.result()?.wrong ?? []);
    // Tra ve theo thu tu GOC de nguoi doc di tu tren xuong nhu trang huong dan,
    // khong phai theo thu tu ngau nhien cua luot vua roi.
    return QUIZ_QUESTIONS.filter((q) => ids.has(q.id));
  });

  constructor() {
    void this.loadStatus();
  }

  private async loadStatus(): Promise<void> {
    this.status.set(await this.api.json<Status>('/api/quiz'));
  }

  /** Fisher-Yates tren mot ban sao — khong dung mang goc trong bundle. */
  private shuffle<T>(items: readonly T[]): T[] {
    const a = [...items];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /**
   * Boc de: 10 cau tu kho 50, CAN THEO CHU DE.
   *
   * Boc bua 10/50 thi co luot hoi 4 cau ve mat khau ma khong hoi cau nao ve
   * USB — trong khi USB la thu ai cung phai biet, va mot luot nhu vay khong
   * cho phong IT ket luan duoc gi ve nguoi lam. Nen: moi chu de (9 chu de)
   * gop dung 1 cau, cau thu 10 boc tu do trong phan con lai.
   *
   * Mot chu de rong (ai do xoa het cau cua no) chi lam thieu 1 cau va vong bu
   * o duoi lap lai — KHONG duoc nem loi giua luc nguoi ta bat dau lam bai.
   */
  private bocDe(): QuizQuestion[] {
    const con = new Set(QUIZ_QUESTIONS.map((q) => q.id));
    const chon: QuizQuestion[] = [];

    for (const t of this.shuffle(QUIZ_TOPICS)) {
      if (chon.length >= QUIZ_DRAW) break;
      const cua = QUIZ_QUESTIONS.filter((q) => q.topic === t.id && con.has(q.id));
      if (!cua.length) continue;
      const q = this.shuffle(cua)[0];
      chon.push(q);
      con.delete(q.id);
    }

    // Con thieu (cau thu 10, hoac bu cho mot chu de rong) thi boc tu do.
    for (const q of this.shuffle(QUIZ_QUESTIONS.filter((x) => con.has(x.id)))) {
      if (chon.length >= QUIZ_DRAW) break;
      chon.push(q);
      con.delete(q.id);
    }

    return this.shuffle(chon).map((q) => ({ ...q, options: this.shuffle(q.options) }));
  }

  start(): void {
    this.questions.set(this.bocDe());
    this.picked.set({});
    this.at.set(0);
    this.result.set(null);
    this.failed.set(false);
    this.startedAt = Date.now();
    this.stage.set('doing');
  }

  pick(questionId: string, optionId: string): void {
    this.picked.update((p) => ({ ...p, [questionId]: optionId }));
  }

  isPicked(questionId: string, optionId: string): boolean {
    return this.picked()[questionId] === optionId;
  }

  go(delta: number): void {
    const next = this.at() + delta;
    if (next >= 0 && next < this.questions().length) {
      this.at.set(next);
      this.scrollUp();
    }
  }

  /** Nhay thang toi mot cau — dung cho danh sach "chua tra loi". */
  goTo(index: number): void {
    this.at.set(index);
    this.scrollUp();
  }

  private scrollUp(): void {
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      /* moi truong khong co window (SSR/test) — bo qua */
    }
  }

  async submit(): Promise<void> {
    if (this.sending() || !this.allAnswered()) return;
    this.sending.set(true);
    this.failed.set(false);
    try {
      const res = await this.api.fetch('/api/quiz/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Gui kem DE cua luot nay: server cham dung 10 cau da boc, chu khong
          // doan tu cac cau co mat trong `answers` — cau bo trong phai duoc
          // tinh la sai, khong phai bi bo qua.
          drawn: this.questions().map((q) => q.id),
          answers: this.picked(),
          seconds: Math.round((Date.now() - this.startedAt) / 1000),
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as Result;
      this.result.set(data);
      this.stage.set('result');
      this.scrollUp();
      if (data.passed) celebrate();
      void this.loadStatus();
    } catch {
      // Khong nuot loi im lang: nguoi ta vua lam xong 10 cau, phai biet la bai
      // CHUA duoc ghi nhan va bam gui lai duoc, chu khong phai doan.
      this.failed.set(true);
    } finally {
      this.sending.set(false);
    }
  }
}
