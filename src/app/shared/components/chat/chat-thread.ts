import {
  AfterViewChecked, ChangeDetectionStrategy, Component, ElementRef, computed,
  inject, input, viewChild,
} from '@angular/core';
import { ChatMessage } from '../../../core/models/chat.models';
import { ChatService } from '../../../core/services/chat.service';
import { LanguageService } from '../../../core/services/language.service';
import { TextSeg, linkify } from '../../util/linkify';
import { AvatarComponent } from '../avatar/avatar';
import { IconComponent } from '../icon/icon';

/** Mot dong trong khung: tin nhan, hoac vach ngan ngay. */
type Row =
  | { t: 'day'; key: string; label: string }
  | { t: 'msg'; key: string; m: ChatMessage; mine: boolean; head: boolean; tail: boolean };

const QUICK = ['👍', '❤️', '😄', '🎉', '👏', '🙏', '🔥', '😢'];
/** Cach nhau qua lau thi tach cum, du cung nguoi gui. */
const GROUP_GAP_MS = 5 * 60 * 1000;

/**
 * Khung hoi thoai — dung chung cho khung chat noi va trang /chat.
 *
 * Tin nhan lien tiep cua cung mot nguoi duoc gom thanh cum (chi cum cuoi moi
 * co avatar), co vach ngan ngay, va noi dung la VAN BAN THUAN — dia chi web
 * duoc tach thanh the <a> bang linkify, khong qua innerHTML.
 */
@Component({
  selector: 'app-chat-thread',
  imports: [IconComponent, AvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './chat-thread.html',
  styleUrl: './chat-thread.scss',
})
export class ChatThread implements AfterViewChecked {
  readonly chat = inject(ChatService);
  readonly lang = inject(LanguageService).lang;

  /** Khung noi thap hon trang /chat nen cho phep chinh chieu cao tu ngoai. */
  readonly compact = input(false);

  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  private readonly box = viewChild<ElementRef<HTMLTextAreaElement>>('box');

  readonly quick = QUICK;
  readonly draft = { text: '', image: '' };
  readonly vi = computed(() => this.lang() === 'vi');

  // Bam day cua so khi co tin moi — tru khi nguoi ta dang keo len doc lai.
  private lastCount = 0;
  private stick = true;

  readonly rows = computed<Row[]>(() => {
    const msgs = this.chat.activeMessages();
    const me = this.chat.me();
    const out: Row[] = [];
    let lastDay = '';
    for (let i = 0; i < msgs.length; i++) {
      const m = msgs[i];
      const d = new Date(m.at);
      const day = d.toDateString();
      if (day !== lastDay) {
        lastDay = day;
        out.push({ t: 'day', key: 'd' + day, label: this.dayLabel(d) });
      }
      const prev = msgs[i - 1];
      const next = msgs[i + 1];
      const near = (a: ChatMessage, b: ChatMessage) =>
        Math.abs(new Date(a.at).getTime() - new Date(b.at).getTime()) < GROUP_GAP_MS;
      const head =
        !prev || prev.sender !== m.sender || !near(prev, m) || new Date(prev.at).toDateString() !== day;
      const tail =
        !next || next.sender !== m.sender || !near(m, next) || new Date(next.at).toDateString() !== day;
      out.push({ t: 'msg', key: 'm' + m.id, m, mine: m.sender === me, head, tail });
    }
    return out;
  });

  readonly typingName = computed(() => {
    const id = this.chat.activeId();
    return id == null ? '' : this.chat.typing()[id] ?? '';
  });

  readonly canLoadOlder = computed(() => {
    const id = this.chat.activeId();
    return id != null && this.chat.hasOlder()[id] === true;
  });

  ngAfterViewChecked(): void {
    const n = this.chat.activeMessages().length;
    if (n !== this.lastCount) {
      this.lastCount = n;
      if (this.stick) this.toBottom();
    }
  }

  onScroll(): void {
    const el = this.scroller()?.nativeElement;
    if (!el) return;
    // Coi la "dang bam day" khi con cach day duoi 60px.
    this.stick = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  }

  private toBottom(): void {
    const el = this.scroller()?.nativeElement;
    if (el) queueMicrotask(() => (el.scrollTop = el.scrollHeight));
  }

  // ------------------------------------------------------------ hien thi --
  segs(text: string): TextSeg[] {
    return linkify(text);
  }

  time(iso: string): string {
    return new Date(iso).toLocaleTimeString(this.vi() ? 'vi-VN' : 'en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private dayLabel(d: Date): string {
    const today = new Date();
    const y = new Date();
    y.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return this.vi() ? 'Hôm nay' : 'Today';
    if (d.toDateString() === y.toDateString()) return this.vi() ? 'Hôm qua' : 'Yesterday';
    return d.toLocaleDateString(this.vi() ? 'vi-VN' : 'en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  // --------------------------------------------------------------- gui --
  onInput(e: Event): void {
    const el = e.target as HTMLTextAreaElement;
    this.draft.text = el.value;
    // O nhap tu cao dan theo noi dung, toi da 5 dong.
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    const id = this.chat.activeId();
    if (id != null && el.value.trim()) this.chat.notifyTyping(id);
  }

  onKey(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void this.send();
    }
  }

  async send(): Promise<void> {
    const id = this.chat.activeId();
    const body = this.draft.text.trim();
    if (id == null || (!body && !this.draft.image)) return;
    const image = this.draft.image;
    this.draft.text = '';
    this.draft.image = '';
    const el = this.box()?.nativeElement;
    if (el) {
      el.value = '';
      el.style.height = 'auto';
    }
    this.stick = true;
    await this.chat.send(id, body, image);
  }

  addEmoji(e: string): void {
    const el = this.box()?.nativeElement;
    this.draft.text += e;
    if (el) {
      el.value = this.draft.text;
      el.focus();
    }
  }

  async onFile(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    await this.attach(file);
  }

  /** Dan anh chup man hinh thang vao o nhap (Ctrl+V). */
  async onPaste(e: ClipboardEvent): Promise<void> {
    const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'));
    if (!item) return;
    const file = item.getAsFile();
    if (!file) return;
    e.preventDefault();
    await this.attach(file);
  }

  private async attach(file: File): Promise<void> {
    const res = await this.chat.uploadImage(file);
    if ('url' in res) this.draft.image = res.url;
  }

  clearImage(): void {
    this.draft.image = '';
  }

  async recall(m: ChatMessage): Promise<void> {
    const msg = this.vi() ? 'Thu hồi tin nhắn này?' : 'Recall this message?';
    if (!confirm(msg)) return;
    await this.chat.recall(m.id);
  }

  loadOlder(): void {
    const id = this.chat.activeId();
    if (id != null) {
      this.stick = false;
      void this.chat.loadOlder(id);
    }
  }
}
