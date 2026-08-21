import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ChatService } from '../../core/services/chat.service';
import { LanguageService } from '../../core/services/language.service';
import { AvatarComponent } from '../../shared/components/avatar/avatar';
import { ChatList } from '../../shared/components/chat/chat-list';
import { ChatThread } from '../../shared/components/chat/chat-thread';
import { IconComponent } from '../../shared/components/icon/icon';
import { fold } from '../../shared/util/fold';

/**
 * Trang chat toan man hinh: danh sach ben trai, hoi thoai ben phai.
 *
 * Dung LAI `app-chat-list` va `app-chat-thread` cua khung noi — cung mot
 * ChatService nen ket noi WebSocket, tin nhan, so chua doc luon khop nhau
 * du dang mo o khung noi hay o trang nay.
 */
@Component({
  selector: 'app-chat-page',
  imports: [IconComponent, AvatarComponent, ChatList, ChatThread],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './chat.html',
  styleUrl: './chat.scss',
})
export class Chat {
  readonly chat = inject(ChatService);
  private readonly router = inject(Router);
  readonly lang = inject(LanguageService).lang;

  readonly vi = computed(() => this.lang() === 'vi');
  readonly active = this.chat.active;
  /** Man hinh hep: dang xem danh sach hay dang xem hoi thoai. */
  readonly mobileThread = signal(false);
  readonly adding = signal(false);
  readonly addQuery = signal('');

  constructor() {
    this.chat.start();
  }

  onPicked(): void {
    this.mobileThread.set(true);
  }

  /** THU NHO: ve trang truoc, day cuoc dang mo vao chong bong bong. */
  minimize(): void {
    const id = this.chat.activeId();
    if (id != null) this.chat.minimise(id);
    void this.router.navigateByUrl(this.chat.returnUrl() || '/');
  }

  /** DONG: ve trang truoc, bo cuoc dang mo khoi ca chong lan khung. */
  closeChat(): void {
    const id = this.chat.activeId();
    if (id != null) this.chat.unminimise(id);
    this.chat.clearActive();
    void this.router.navigateByUrl(this.chat.returnUrl() || '/');
  }

  backToList(): void {
    this.mobileThread.set(false);
  }

  onAddQuery(e: Event): void {
    this.addQuery.set((e.target as HTMLInputElement).value);
  }

  /** Nhan vien chua co trong phong — de moi them. Cung nguon voi danh sach
      chinh cua chatbox (`/api/chat/people`), khong phai danh ba may le. */
  readonly addable = computed(() => {
    const c = this.active();
    if (!c || c.kind !== 'group') return [];
    const inRoom = new Set(c.members.map((m) => m.username.toLowerCase()));
    const q = fold(this.addQuery().trim());
    return this.chat
      .people()
      .filter((p) => {
        if (!p.username || inRoom.has(p.username.toLowerCase())) return false;
        return !q || fold(p.name + ' ' + p.username + ' ' + p.title + ' ' + p.dept).includes(q);
      })
      .slice(0, 30);
  });

  async add(username: string): Promise<void> {
    const c = this.active();
    if (!c) return;
    await this.chat.addMember(c.id, username);
    this.addQuery.set('');
  }

  async leave(): Promise<void> {
    const c = this.active();
    if (!c) return;
    const msg = this.vi()
      ? `Rời phòng “${c.name}”? Bạn sẽ không đọc được tin trong phòng nữa.`
      : `Leave “${c.name}”? You will lose access to its messages.`;
    if (!confirm(msg)) return;
    await this.chat.leave(c.id);
    this.adding.set(false);
    this.mobileThread.set(false);
  }
}
