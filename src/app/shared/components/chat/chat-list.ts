import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { Conversation } from '../../../core/models/chat.models';
import { ChatService } from '../../../core/services/chat.service';
import { DirectoryService } from '../../../core/services/directory.service';
import { LanguageService } from '../../../core/services/language.service';
import { relTime } from '../../../features/news/news.util';
import { fold } from '../../util/fold';
import { AvatarComponent } from '../avatar/avatar';
import { IconComponent } from '../icon/icon';

interface Person {
  username: string;
  name: string;
  title: string;
  dept: string;
}

/**
 * Cot trai cua chat: danh sach cuoc tro chuyen + man hinh chon nguoi.
 *
 * Danh sach nguoi lay tu danh ba AD (`/api/directory`) — nghia la chi gom
 * nguoi CO SO MAY LE, giong trang Danh ba. Da noi ro tren giao dien.
 */
@Component({
  selector: 'app-chat-list',
  imports: [IconComponent, AvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './chat-list.html',
  styleUrl: './chat-list.scss',
})
export class ChatList {
  readonly chat = inject(ChatService);
  private readonly dir = inject(DirectoryService);
  readonly lang = inject(LanguageService).lang;

  /** Bao ra ngoai khi da chon xong (khung noi doi sang man hinh hoi thoai). */
  readonly picked = output<number>();

  readonly mode = signal<'list' | 'new' | 'group'>('list');
  readonly query = signal('');
  readonly groupTitle = signal('');
  readonly groupPicks = signal<string[]>([]);
  readonly busy = signal(false);

  readonly vi = computed(() => this.lang() === 'vi');
  readonly conversations = this.chat.conversations;

  /** Toan bo nguoi trong danh ba, tru chinh minh. */
  readonly people = computed<Person[]>(() => {
    const data = this.dir.data();
    const me = this.chat.me();
    if (!data) return [];
    const out: Person[] = [];
    for (const d of data.departments) {
      for (const c of d.contacts) {
        if (c.username && c.username.toLowerCase() !== me.toLowerCase()) {
          out.push({ username: c.username, name: c.name, title: c.title, dept: d.name });
        }
      }
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  });

  readonly found = computed(() => {
    const q = fold(this.query().trim());
    const list = this.people();
    if (!q) return list.slice(0, 40);
    return list.filter((p) => fold(p.name + ' ' + p.username + ' ' + p.title + ' ' + p.dept).includes(q)).slice(0, 40);
  });

  readonly canCreateGroup = computed(
    () => this.groupTitle().trim().length > 0 && this.groupPicks().length > 0,
  );

  // ------------------------------------------------------------ hien thi --
  when(iso: string): string {
    return relTime(iso, this.lang());
  }

  /** Dong xem truoc duoi ten: "Bạn: ..." cho tin cua chinh minh. */
  preview(c: Conversation): string {
    if (!c.last) return this.vi() ? 'Chưa có tin nhắn' : 'No messages yet';
    const mine = c.last.sender === this.chat.me();
    const who = mine ? (this.vi() ? 'Bạn: ' : 'You: ') : c.kind === 'group' ? c.last.senderName + ': ' : '';
    const body = c.last.body || (c.last.image ? (this.vi() ? '📷 Ảnh' : '📷 Photo') : '');
    return who + body;
  }

  // -------------------------------------------------------------- hanh dong --
  open(c: Conversation): void {
    void this.chat.openConversation(c.id);
    this.picked.emit(c.id);
  }

  onQuery(e: Event): void {
    this.query.set((e.target as HTMLInputElement).value);
  }
  onGroupTitle(e: Event): void {
    this.groupTitle.set((e.target as HTMLInputElement).value);
  }

  async startDm(p: Person): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    const id = await this.chat.openDm(p.username);
    this.busy.set(false);
    if (id != null) {
      this.mode.set('list');
      this.query.set('');
      this.picked.emit(id);
    }
  }

  togglePick(p: Person): void {
    this.groupPicks.update((cur) =>
      cur.includes(p.username) ? cur.filter((u) => u !== p.username) : [...cur, p.username],
    );
  }

  isPicked(p: Person): boolean {
    return this.groupPicks().includes(p.username);
  }

  async createGroup(): Promise<void> {
    if (!this.canCreateGroup() || this.busy()) return;
    this.busy.set(true);
    const id = await this.chat.createGroup(this.groupTitle().trim(), this.groupPicks());
    this.busy.set(false);
    if (id != null) {
      this.mode.set('list');
      this.groupTitle.set('');
      this.groupPicks.set([]);
      this.query.set('');
      this.picked.emit(id);
    }
  }

  back(): void {
    this.mode.set('list');
    this.query.set('');
    this.groupPicks.set([]);
  }
}
