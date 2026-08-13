import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { Conversation } from '../../../core/models/chat.models';
import { ChatService } from '../../../core/services/chat.service';
import { LanguageService } from '../../../core/services/language.service';
import { AvatarComponent } from '../avatar/avatar';
import { ChatList } from '../chat/chat-list';
import { ChatThread } from '../chat/chat-thread';
import { IconComponent } from '../icon/icon';

/**
 * Khung chat noi goc phai — theo nguoi dung khap moi trang (kieu Messenger).
 *
 * Chi mo ket noi WebSocket khi nguoi ta THAT SU bam vao chat lan dau
 * (`chat.start()`), de trang nao khong dung chat thi khong ganh them ket noi.
 * Tu an khi dang o trang /chat — o do da co ban toan man hinh roi.
 */
@Component({
  selector: 'app-chat-dock',
  imports: [IconComponent, AvatarComponent, ChatList, ChatThread, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './chat-dock.html',
  styleUrl: './chat-dock.scss',
})
export class ChatDock {
  readonly chat = inject(ChatService);
  private readonly router = inject(Router);
  readonly lang = inject(LanguageService).lang;

  readonly open = signal(false);
  /** Trong khung hep: hoac danh sach, hoac mot cuoc tro chuyen. */
  readonly view = signal<'list' | 'thread'>('list');
  readonly onChatPage = signal(false);

  readonly vi = computed(() => this.lang() === 'vi');
  readonly unread = this.chat.totalUnread;
  readonly active = this.chat.active;

  /** Chong bong bong: cac cuoc dang thu nho. An khi khung dang mo — khung
      nam dung cho do, de ca hai se de len nhau. */
  readonly bubbles = computed<Conversation[]>(() => {
    if (this.open()) return [];
    const convs = this.chat.conversations();
    return this.chat
      .minimised()
      .map((id) => convs.find((c) => c.id === id))
      .filter((c): c is Conversation => !!c);
  });

  /** So tin chua doc cua CAC cuoc KHONG nam trong chong — khong dem trung. */
  readonly otherUnread = computed(() => {
    const inStack = this.bubbles().reduce((n, c) => n + (c.unread || 0), 0);
    return Math.max(0, this.unread() - inStack);
  });

  constructor() {
    this.onChatPage.set(this.router.url.startsWith('/chat'));
    this.router.events.subscribe((e) => {
      if (e instanceof NavigationEnd) {
        this.onChatPage.set(e.urlAfterRedirects.startsWith('/chat'));
        if (this.onChatPage()) this.open.set(false);
      }
    });
    // Van phai noi song ke ca khi chua mo khung, neu khong se khong biet
    // co tin moi de hien so tren bong chat.
    queueMicrotask(() => this.chat.start());
  }

  /** Nut chat chinh (duoi cung): mo DANH SACH. Dang mo thi thu nho lai —
      khong xoa cuoc tro chuyen dang do. */
  toggle(): void {
    if (this.open()) {
      this.minimize();
      return;
    }
    this.chat.start();
    this.view.set('list');
    this.open.set(true);
  }

  /** Bam mot bong bong: vao THANG cuoc do va nhac no khoi chong. */
  openBubble(c: Conversation): void {
    this.chat.start();
    this.chat.unminimise(c.id);
    void this.chat.openConversation(c.id);
    this.view.set('thread');
    this.open.set(true);
  }

  /** THU NHO: cat khung di, day cuoc dang mo vao chong bong bong. */
  minimize(): void {
    const id = this.chat.activeId();
    if (id != null) this.chat.minimise(id);
    this.open.set(false);
  }

  /** DONG: dong han — go khoi chong bong bong luon. */
  close(): void {
    const id = this.chat.activeId();
    if (id != null) this.chat.unminimise(id);
    this.open.set(false);
    this.view.set('list');
    this.chat.clearActive();
  }

  /** Sang trang /chat: nho duong ve de o do con thu nho / dong duoc. */
  toFullPage(): void {
    this.chat.returnUrl.set(this.router.url);
    this.open.set(false);
  }

  onPicked(): void {
    this.view.set('thread');
  }

  back(): void {
    this.view.set('list');
  }
}
