import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { ChatPerson, Conversation } from '../../../core/models/chat.models';
import { ChatService } from '../../../core/services/chat.service';
import { LanguageService } from '../../../core/services/language.service';
import { fold } from '../../util/fold';
import { AvatarComponent } from '../avatar/avatar';
import { IconComponent } from '../icon/icon';

/** Hoi lai trang thai online — su kien WebSocket chi den nguoi chung cuoc tro
    chuyen, nguoi con lai phai hoi. PRESENCE_TTL o server la 75 giay. */
const REFRESH_MS = 60_000;

/** Mot dong trong danh sach: mot dong nghiep, hoac mot phong nhom. */
interface Row {
  key: string;
  kind: 'dm' | 'group';
  /** Da tung nhan tin thi co san id; chua thi null -> bam moi mo cuoc moi. */
  convId: number | null;
  username: string;
  name: string;
  /** Dong nho duoi ten: chuc danh / phong ban, hoac "N thanh vien". */
  sub: string;
  online: boolean;
  unread: number;
  /** Thoi diem tin cuoi, de xep — rong voi nguoi chua nhan bao gio. */
  at: string;
}

/**
 * Cot trai cua chat: MOT danh sach phang gom toan bo nhan vien.
 *
 * Mo len la thay het moi nguoi (`/api/chat/people` — moi tai khoan that trong
 * AD, khong doi phai co so may le nhu trang Danh ba), ai dang online co cham
 * xanh va duoc dua len tren. Bam mot dong la vao thang cuoc tro chuyen voi
 * nguoi do. KHONG hien noi dung tin nhan o day — mo hoi thoai moi doc.
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
  readonly lang = inject(LanguageService).lang;

  /** Bao ra ngoai khi da chon xong (khung noi doi sang man hinh hoi thoai). */
  readonly picked = output<number>();

  readonly mode = signal<'list' | 'group'>('list');
  readonly query = signal('');
  readonly groupTitle = signal('');
  readonly groupPicks = signal<string[]>([]);
  readonly busy = signal(false);

  readonly vi = computed(() => this.lang() === 'vi');
  readonly people = this.chat.people;

  constructor() {
    void this.chat.loadPeople();
    const timer = setInterval(() => void this.chat.loadPeople(), REFRESH_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  // ------------------------------------------------------------ danh sach --
  /** Gop nhan vien + phong nhom thanh mot danh sach, online len tren. */
  readonly rows = computed<Row[]>(() => {
    const me = this.chat.me().toLowerCase();
    const vi = this.vi();
    const out: Row[] = [];
    const dmByPeer = new Map<string, Conversation>();

    for (const c of this.chat.conversations()) {
      if (c.kind === 'group') {
        out.push({
          key: 'g' + c.id,
          kind: 'group',
          convId: c.id,
          username: '',
          name: c.name,
          sub: `${c.members.length} ${vi ? 'thành viên' : 'members'}`,
          online: c.online,
          unread: c.unread,
          at: c.lastAt,
        });
      } else if (c.peer) {
        dmByPeer.set(c.peer.toLowerCase(), c);
      }
    }

    const seen = new Set<string>();
    for (const p of this.people()) {
      const key = p.username.toLowerCase();
      if (!key || key === me) continue;
      seen.add(key);
      const c = dmByPeer.get(key);
      out.push({
        key: 'u' + key,
        kind: 'dm',
        convId: c?.id ?? null,
        username: p.username,
        name: p.name || p.username,
        sub: p.title || p.dept,
        online: p.online,
        unread: c?.unread ?? 0,
        at: c?.lastAt ?? '',
      });
    }
    // Da tung nhan tin nhung nguoi do khong con trong AD (nghi viec, tai khoan
    // dung chung): van phai giu lai, khong duoc lam mat cuoc tro chuyen cu.
    for (const [key, c] of dmByPeer) {
      if (seen.has(key)) continue;
      out.push({
        key: 'u' + key,
        kind: 'dm',
        convId: c.id,
        username: c.peer,
        name: c.name,
        sub: '',
        online: c.online,
        unread: c.unread,
        at: c.lastAt,
      });
    }

    // Online truoc, roi den ai dang co tin chua doc, roi ai nhan gan day nhat.
    out.sort((a, b) => {
      if (a.online !== b.online) return a.online ? -1 : 1;
      if (!a.unread !== !b.unread) return a.unread ? -1 : 1;
      if (a.at !== b.at) return a.at > b.at ? -1 : 1;
      return a.name.localeCompare(b.name, 'vi');
    });
    return out;
  });

  readonly found = computed(() => {
    const q = fold(this.query().trim());
    const list = this.rows();
    if (!q) return list;
    return list.filter((r) => fold(r.name + ' ' + r.username + ' ' + r.sub).includes(q));
  });

  readonly onlineCount = computed(() => this.rows().filter((r) => r.online).length);

  /** Nguoi de tich vao phong nhom — cung nguon voi danh sach chinh. */
  readonly foundPeople = computed<ChatPerson[]>(() => {
    const q = fold(this.query().trim());
    const list = this.people();
    if (!q) return list;
    return list.filter((p) => fold(p.name + ' ' + p.username + ' ' + p.title + ' ' + p.dept).includes(q));
  });

  readonly canCreateGroup = computed(
    () => this.groupTitle().trim().length > 0 && this.groupPicks().length > 0,
  );

  // -------------------------------------------------------------- hanh dong --
  /** Bam mot dong: co san cuoc thi mo, chua co thi tao cuoc 1-1 moi. */
  async open(r: Row): Promise<void> {
    if (r.convId != null) {
      void this.chat.openConversation(r.convId);
      this.picked.emit(r.convId);
      return;
    }
    if (this.busy() || !r.username) return;
    this.busy.set(true);
    const id = await this.chat.openDm(r.username);
    this.busy.set(false);
    if (id != null) this.picked.emit(id);
  }

  isActive(r: Row): boolean {
    return r.convId != null && this.chat.activeId() === r.convId;
  }

  onQuery(e: Event): void {
    this.query.set((e.target as HTMLInputElement).value);
  }
  onGroupTitle(e: Event): void {
    this.groupTitle.set((e.target as HTMLInputElement).value);
  }

  togglePick(p: ChatPerson): void {
    this.groupPicks.update((cur) =>
      cur.includes(p.username) ? cur.filter((u) => u !== p.username) : [...cur, p.username],
    );
  }

  isPicked(p: ChatPerson): boolean {
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
