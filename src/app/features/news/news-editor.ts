import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { NewsDraft, NewsStatus, PollQ, NEWS_CATEGORIES } from '../../core/models/news.models';
import { LanguageService } from '../../core/services/language.service';
import { NewsService } from '../../core/services/news.service';
import { UserService } from '../../core/services/user.service';
import { IconComponent } from '../../shared/components/icon/icon';
import { TrPipe } from '../../shared/pipes/tr.pipe';
import { RichEditor } from './rich-editor';

/** Soan / sua bai tin tuc. Chi tac gia (HR/Marketing/IS) vao duoc. */
@Component({
  selector: 'app-news-editor',
  imports: [RouterLink, TrPipe, IconComponent, RichEditor],
  templateUrl: './news-editor.html',
  styleUrl: './news-editor.scss',
})
export class NewsEditor {
  private readonly svc = inject(NewsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly langSvc = inject(LanguageService);
  private readonly userSvc = inject(UserService);
  readonly lang = this.langSvc.lang;

  readonly categories = NEWS_CATEGORIES;
  readonly editId = signal<number | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly uploading = signal(false);

  // Truong soan thao
  readonly category = signal('announcement');
  readonly titleVi = signal('');
  readonly titleEn = signal('');
  readonly summaryVi = signal('');
  readonly summaryEn = signal('');
  readonly bodyVi = signal('');
  readonly bodyEn = signal('');
  readonly cover = signal('');
  readonly status = signal<NewsStatus>('published');
  readonly commentsOff = signal(false);   // tat binh luan cho bai nay

  // Hen gio phat hanh: bat cong tac + chon gio (dang datetime-local cua may).
  readonly schedOn = signal(false);
  readonly schedAt = signal('');

  // Binh chon — chi tao khi soan bai moi (sua poll da co chua ho tro).
  // Mot bai co the co NHIEU cau hoi; moi cau hoi co lua chon rieng.
  readonly pollOn = signal(false);
  readonly questions = signal<PollQ[]>([{ question: '', multi: false, allowAdd: false, options: [{ label: '' }, { label: '' }] }]);
  readonly pollAnon = signal(false);
  readonly pollCloses = signal('');        // dang datetime-local cua trinh duyet
  readonly hasExistingPoll = signal(false);

  private editQ(i: number, patch: Partial<PollQ>): void {
    this.questions.update((qs) => qs.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  }

  addQuestion(): void {
    this.questions.update((qs) =>
      qs.length >= 20 ? qs : [...qs, { question: '', multi: false, allowAdd: false, options: [{ label: '' }, { label: '' }] }]);
  }
  removeQuestion(i: number): void {
    this.questions.update((qs) => (qs.length > 1 ? qs.filter((_, idx) => idx !== i) : qs));
  }
  setQuestion(i: number, val: string): void {
    this.editQ(i, { question: val });
  }
  setMulti(i: number, val: boolean): void {
    this.editQ(i, { multi: val });
  }
  setAllowAdd(i: number, val: boolean): void {
    this.editQ(i, { allowAdd: val });
  }
  addOption(i: number): void {
    this.editQ(i, { options: [...this.questions()[i].options, { label: '' }] });
  }
  removeOption(i: number, j: number): void {
    const opts = this.questions()[i].options;
    if (opts.length > 2) this.editQ(i, { options: opts.filter((_, idx) => idx !== j) });
  }
  setOption(i: number, j: number, val: string): void {
    this.editQ(i, {
      options: this.questions()[i].options.map((o, idx) => (idx === j ? { ...o, label: val } : o)),
    });
  }

  readonly canPost = computed(() => this.userSvc.me()?.canPostNews !== false);
  readonly isEdit = computed(() => this.editId() !== null);

  /* --- Tu luu nhap vao may (dong tab / mat dien khong mat bai dang go) --- */
  readonly restorable = signal<string | null>(null);
  private readonly draftKey: string;
  private stash: Record<string, string> | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    const idParam = this.route.snapshot.paramMap.get('id');
    this.draftKey = `avp-news-draft-${idParam ?? 'new'}`;
    if (idParam) void this.loadExisting(Number(idParam));

    try {
      const raw = localStorage.getItem(this.draftKey);
      if (raw) {
        const saved = JSON.parse(raw);
        this.stash = saved;
        this.restorable.set(new Date(saved['t']).toLocaleString('vi-VN'));
      }
    } catch {
      /* nhap hong thi bo qua */
    }

    effect(() => {
      const snap = this.snapshot();               // doc het cac o de theo doi
      if (this.loading()) return;
      clearTimeout(this.timer);
      // Ghi tre mot chut cho khoi dung o dia moi phim.
      this.timer = setTimeout(() => {
        try {
          localStorage.setItem(this.draftKey, JSON.stringify({ ...snap, t: Date.now() }));
        } catch {
          /* het cho luu thi thoi */
        }
      }, 1500);
    });
  }

  /** ISO -> chuoi cho o datetime-local (yyyy-MM-ddTHH:mm, gio may nguoi dung). */
  private toLocalInput(iso: string): string {
    const d = new Date(iso);
    const p2 = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`;
  }

  private snapshot(): Record<string, string> {
    return {
      category: this.category(), titleVi: this.titleVi(), titleEn: this.titleEn(),
      summaryVi: this.summaryVi(), summaryEn: this.summaryEn(),
      bodyVi: this.bodyVi(), cover: this.cover(),
    };
  }

  restoreDraft(): void {
    const s = this.stash;
    if (!s) return;
    this.category.set(s['category'] || 'announcement');
    this.titleVi.set(s['titleVi'] || '');
    this.titleEn.set(s['titleEn'] || '');
    this.summaryVi.set(s['summaryVi'] || '');
    this.summaryEn.set(s['summaryEn'] || '');
    this.bodyVi.set(s['bodyVi'] || '');
    this.cover.set(s['cover'] || '');
    this.restorable.set(null);
  }

  dropDraft(): void {
    localStorage.removeItem(this.draftKey);
    this.stash = null;
    this.restorable.set(null);
  }

  private async loadExisting(id: number): Promise<void> {
    this.loading.set(true);
    try {
      const p = await this.svc.get(id);
      this.editId.set(p.id);
      this.category.set(p.category);
      this.titleVi.set(p.title.vi);
      this.titleEn.set(p.title.en === p.title.vi ? '' : p.title.en);
      this.summaryVi.set(p.summary.vi);
      this.summaryEn.set(p.summary.en === p.summary.vi ? '' : p.summary.en);
      this.bodyVi.set(p.body?.vi ?? '');
      this.bodyEn.set(p.body?.en === p.body?.vi ? '' : (p.body?.en ?? ''));
      this.cover.set(p.cover);
      this.status.set(p.status);
      if (p.status === 'scheduled' && p.scheduledAt) {
        this.schedOn.set(true);
        this.schedAt.set(this.toLocalInput(p.scheduledAt));
      }
      this.commentsOff.set(p.commentsEnabled === false);
      const polls = p.polls?.length ? p.polls : p.poll ? [p.poll] : [];
      if (polls.length) {
        // Nap binh chon cu vao trinh soan de sua duoc (giu id -> khong mat phieu).
        this.hasExistingPoll.set(true);
        this.pollOn.set(true);
        this.questions.set(polls.map((q) => ({
          id: q.id,
          question: q.question,
          multi: q.multi,
          allowAdd: q.allowAdd,
          options: q.options.map((o) => ({ id: o.id, label: o.label, votes: o.votes })),
        })));
        this.pollAnon.set(polls[0].anonymous);
        this.pollCloses.set(polls[0].closesAt ? this.toLocalInput(polls[0].closesAt) : '');
      }
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  async pickCover(ev: Event): Promise<void> {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.uploading.set(true);
    this.error.set(null);
    try {
      this.cover.set(await this.svc.upload(file));
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.uploading.set(false);
      (ev.target as HTMLInputElement).value = '';
    }
  }

  private draft(status: NewsStatus): NewsDraft {
    const dto: NewsDraft = {
      title: { vi: this.titleVi().trim(), en: this.titleEn().trim() },
      summary: { vi: this.summaryVi().trim(), en: this.summaryEn().trim() },
      body: { vi: this.bodyVi(), en: this.bodyEn() },
      cover: this.cover(),
      category: this.category(),
      status,
      // Gui ca khi khong hen gio (null) de bo gio hen cu luc dang ngay / luu nhap.
      scheduledAt: status === 'scheduled' ? new Date(this.schedAt()).toISOString() : null,
      commentsEnabled: !this.commentsOff(),
    };
    if (this.pollOn() && !this.hasExistingPoll()) {
      const polls = this.pollPayload().map((q) => ({ ...q, options: q.options.map((o) => o.label) }));
      if (polls.length) dto.polls = polls;
    }
    return dto;
  }

  /** Danh sach cau hoi da lam sach, dung cho ca luc tao lan luc sua. */
  private pollPayload() {
    const closesAt = this.pollCloses() ? new Date(this.pollCloses()).toISOString() : null;
    return this.questions()
      .map((q) => ({
        id: q.id,
        question: q.question.trim(),
        multi: q.multi,
        allowAdd: q.allowAdd,
        anonymous: this.pollAnon(),
        closesAt,
        options: q.options
          .map((o) => ({ id: o.id, label: o.label.trim() }))
          .filter((o) => o.label),
      }))
      .filter((q) => q.options.length >= 2);
  }

  /** Gio hen da chon (rong / sai / da qua = khong hop le). */
  readonly schedValid = computed(() => {
    const t = new Date(this.schedAt()).getTime();
    return !Number.isNaN(t) && t > Date.now();
  });

  /** Nut chinh: bat hen gio thi dat lich, khong thi dang ngay. */
  publish(): void {
    void this.save(this.schedOn() ? 'scheduled' : 'published');
  }

  async save(status: NewsStatus): Promise<void> {
    if (status === 'scheduled' && !this.schedValid()) {
      this.error.set(this.lang() === 'vi'
        ? 'Giờ hẹn đăng phải là một mốc trong tương lai.'
        : 'The scheduled time must be in the future.');
      return;
    }
    if (!this.titleVi().trim()) {
      this.error.set(this.lang() === 'vi' ? 'Cần nhập tiêu đề (tiếng Việt).' : 'Vietnamese title is required.');
      return;
    }
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      const dto = this.draft(status);
      const post = this.isEdit()
        ? await this.svc.update(this.editId()!, dto)
        : await this.svc.create(dto);
      // Bai da dang: binh chon sua qua endpoint rieng (doi chieu theo id).
      if (this.isEdit() && this.pollOn()) await this.svc.updatePolls(post.id, this.pollPayload());
      clearTimeout(this.timer);
      localStorage.removeItem(this.draftKey);       // da luu len server roi
      void this.router.navigate(['/news', post.id]);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }
}
