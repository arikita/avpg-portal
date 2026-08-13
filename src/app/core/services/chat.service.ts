import { Injectable, computed, inject, signal } from '@angular/core';
import { ChatEvent, ChatMessage, Conversation } from '../models/chat.models';
import { UserService } from './user.service';

const PING_MS = 30_000;      // giu ket noi song + cap nhat trang thai online
const TYPING_MS = 4_000;     // bao "dang go" tu tat sau ngan nay
const MAX_BACKOFF = 20_000;
/** Toi da may bong bong thu nho — nhieu hon nua thi che mat man hinh. */
const MAX_MINIMISED = 4;

/**
 * Chat noi bo: trang thai + duong WebSocket.
 *
 * KET NOI: khong mo WebSocket bang Kerberos duoc (trinh duyet khong lam duoc
 * Negotiate tren ban bat tay), nen xin "ve" qua HTTP thuong roi mo socket kem
 * ve do — xem app/chat.py. Dut thi tu noi lai voi thoi gian cho tang dan, va
 * moi lan noi lai deu tai lai danh sach cho khoi lo tin trong luc mat song.
 */
@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly userSvc = inject(UserService);

  private ws: WebSocket | null = null;
  private backoff = 1000;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private typingTimers = new Map<number, ReturnType<typeof setTimeout>>();
  private lastTypingSent = 0;
  private started = false;

  readonly conversations = signal<Conversation[]>([]);
  readonly activeId = signal<number | null>(null);
  readonly messages = signal<Record<number, ChatMessage[]>>({});
  readonly hasOlder = signal<Record<number, boolean>>({});
  /** convId -> ten nguoi dang go (rong = khong ai). */
  readonly typing = signal<Record<number, string>>({});
  readonly connected = signal(false);
  readonly loading = signal(false);
  /** Trang truoc khi mo /chat, de bam thu nho / dong con biet ve dau. */
  readonly returnUrl = signal('/');
  /** Id cac cuoc tro chuyen dang THU NHO, cai vua thu nho dung dau (nam duoi
      cung trong chong bong bong). Qua MAX thi cuoc cu nhat rot ra. */
  readonly minimised = signal<number[]>([]);

  readonly me = computed(() => this.userSvc.username());
  readonly totalUnread = computed(() =>
    this.conversations().reduce((n, c) => n + (c.unread || 0), 0),
  );
  readonly active = computed(() => {
    const id = this.activeId();
    return id == null ? null : this.conversations().find((c) => c.id === id) ?? null;
  });
  readonly activeMessages = computed(() => {
    const id = this.activeId();
    return id == null ? [] : this.messages()[id] ?? [];
  });

  /** Goi mot lan khi co ai do that su mo chat (khong noi song ngay tu dau). */
  start(): void {
    if (this.started) return;
    this.started = true;
    void this.loadConversations();
    void this.connect();
    document.addEventListener('visibilitychange', () => {
      // Quay lai tab sau khi may ngu -> socket thuong da chet im lang.
      if (!document.hidden && this.ws?.readyState !== WebSocket.OPEN) void this.connect();
    });
  }

  // ------------------------------------------------------------ WebSocket --
  private async connect(): Promise<void> {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    let ticket = '';
    try {
      const res = await fetch('/api/chat/ws-ticket', { credentials: 'same-origin' });
      if (!res.ok) throw new Error('ticket');
      ticket = (await res.json()).ticket;
    } catch {
      this.retry();
      return;
    }
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/api/ws/chat?t=${encodeURIComponent(ticket)}`);
    this.ws = ws;

    ws.onopen = () => {
      this.connected.set(true);
      this.backoff = 1000;
      this.pingTimer = setInterval(() => this.sendRaw({ t: 'ping' }), PING_MS);
      // Noi lai sau khi mat song: tai lai cho khoi thieu tin.
      void this.loadConversations();
      const id = this.activeId();
      if (id != null) void this.openConversation(id, true);
    };
    ws.onmessage = (e) => this.onEvent(JSON.parse(e.data) as ChatEvent);
    ws.onclose = () => {
      this.connected.set(false);
      if (this.pingTimer) clearInterval(this.pingTimer);
      this.pingTimer = null;
      this.ws = null;
      this.retry();
    };
    ws.onerror = () => ws.close();
  }

  private retry(): void {
    setTimeout(() => void this.connect(), this.backoff);
    this.backoff = Math.min(this.backoff * 2, MAX_BACKOFF);
  }

  private sendRaw(obj: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(obj));
  }

  private onEvent(ev: ChatEvent): void {
    switch (ev.type) {
      case 'msg':
        this.onMessage(ev);
        break;
      case 'typing':
        if (ev.convId != null && ev.name) this.markTyping(ev.convId, ev.name);
        break;
      case 'presence':
        if (ev.user) {
          this.conversations.update((cs) =>
            cs.map((c) => (c.peer === ev.user ? { ...c, online: !!ev.online } : c)),
          );
        }
        break;
      case 'conv':
        void this.loadConversations();
        break;
    }
  }

  private onMessage(ev: ChatEvent): void {
    const id = ev.convId;
    const msg = ev.message;
    if (id == null || !msg) return;

    this.messages.update((all) => {
      const cur = all[id] ?? [];
      const at = cur.findIndex((m) => m.id === msg.id);
      // Nguoi gui cung nhan lai tin cua chinh minh (de dong bo nhieu tab)
      // => phai thay the theo id, khong duoc them lan hai.
      const next = at >= 0 ? cur.map((m) => (m.id === msg.id ? msg : m)) : [...cur, msg];
      return { ...all, [id]: next };
    });
    this.clearTyping(id);

    const mine = msg.sender === this.me();
    const isActive = this.activeId() === id && !document.hidden;
    this.conversations.update((cs) => {
      const hit = cs.find((c) => c.id === id);
      if (!hit) {
        void this.loadConversations();       // cuoc tro chuyen moi tinh
        return cs;
      }
      const upd: Conversation = {
        ...hit,
        lastAt: msg.at,
        last: { sender: msg.sender, senderName: msg.senderName, body: msg.body, image: msg.image, at: msg.at },
        unread: mine || isActive ? hit.unread : hit.unread + 1,
      };
      return [upd, ...cs.filter((c) => c.id !== id)];
    });

    if (isActive) void this.markRead(id);
    else if (!mine) this.toast(msg);
  }

  /** Bao ngoai man hinh khi tab dang an — chat khong ai doc thi coi nhu khong co. */
  private toast(msg: ChatMessage): void {
    if (!document.hidden) return;
    try {
      if (Notification?.permission !== 'granted') return;
      const n = new Notification(msg.senderName, {
        body: msg.body || (msg.image ? '📷 Đã gửi một ảnh' : ''),
        icon: '/img/brand/icon-192.png',
        tag: `avp-chat-${msg.sender}`,
      });
      n.onclick = () => {
        window.focus();
        n.close();
      };
    } catch {
      /* trinh duyet chan thi thoi */
    }
  }

  private markTyping(convId: number, name: string): void {
    this.typing.update((t) => ({ ...t, [convId]: name }));
    const old = this.typingTimers.get(convId);
    if (old) clearTimeout(old);
    this.typingTimers.set(convId, setTimeout(() => this.clearTyping(convId), TYPING_MS));
  }

  private clearTyping(convId: number): void {
    const t = this.typingTimers.get(convId);
    if (t) clearTimeout(t);
    this.typingTimers.delete(convId);
    this.typing.update((cur) => {
      if (!(convId in cur)) return cur;
      const next = { ...cur };
      delete next[convId];
      return next;
    });
  }

  /** Bao dang go — nhieu nhat mot lan moi 2 giay, khong ban lien tuc theo phim. */
  notifyTyping(convId: number): void {
    const now = Date.now();
    if (now - this.lastTypingSent < 2000) return;
    this.lastTypingSent = now;
    this.sendRaw({ t: 'typing', conv: convId });
  }

  // --------------------------------------------------------------- du lieu --
  async loadConversations(): Promise<void> {
    const data = await this.json<{ conversations: Conversation[] }>('/api/chat/conversations');
    if (data) this.conversations.set(data.conversations);
  }

  async openConversation(id: number, silent = false): Promise<void> {
    this.activeId.set(id);
    if (!silent) this.loading.set(true);
    const data = await this.json<{ messages: ChatMessage[]; more: boolean }>(
      `/api/chat/${id}/messages`,
    );
    this.loading.set(false);
    if (!data) return;
    this.messages.update((all) => ({ ...all, [id]: data.messages }));
    this.hasOlder.update((h) => ({ ...h, [id]: data.more }));
    void this.markRead(id);
  }

  async loadOlder(id: number): Promise<void> {
    const cur = this.messages()[id] ?? [];
    if (!cur.length) return;
    const data = await this.json<{ messages: ChatMessage[]; more: boolean }>(
      `/api/chat/${id}/messages?before=${cur[0].id}`,
    );
    if (!data) return;
    this.messages.update((all) => ({ ...all, [id]: [...data.messages, ...(all[id] ?? [])] }));
    this.hasOlder.update((h) => ({ ...h, [id]: data.more }));
  }

  /** Bo cuoc tro chuyen dang mo — dung cho nut ĐÓNG (khac nut thu nho). */
  clearActive(): void {
    this.activeId.set(null);
  }

  /** Thu nho mot cuoc: them vao chong bong bong (khong trung, khong qua han). */
  minimise(id: number): void {
    this.minimised.update((cur) => [id, ...cur.filter((x) => x !== id)].slice(0, MAX_MINIMISED));
  }

  /** Bo khoi chong bong bong (mo lai, hoac dong han). */
  unminimise(id: number): void {
    this.minimised.update((cur) => cur.filter((x) => x !== id));
  }

  async markRead(id: number): Promise<void> {
    this.conversations.update((cs) => cs.map((c) => (c.id === id ? { ...c, unread: 0 } : c)));
    await this.json(`/api/chat/${id}/read`, 'POST');
  }

  async send(id: number, body: string, image = ''): Promise<boolean> {
    const res = await this.json<{ message: ChatMessage }>(`/api/chat/${id}/messages`, 'POST', {
      body,
      image,
    });
    // Khong tu them vao danh sach: su kien WebSocket se mang tin ve, va
    // onMessage() thay the theo id nen khong bao gio nhan doi.
    return !!res;
  }

  async openDm(username: string): Promise<number | null> {
    const res = await this.json<{ id: number; conversations: Conversation[] }>(
      '/api/chat/dm',
      'POST',
      { username },
    );
    if (!res) return null;
    this.conversations.set(res.conversations);
    await this.openConversation(res.id);
    return res.id;
  }

  async createGroup(title: string, members: string[]): Promise<number | null> {
    const res = await this.json<{ id: number; conversations: Conversation[] }>(
      '/api/chat/group',
      'POST',
      { title, members },
    );
    if (!res) return null;
    this.conversations.set(res.conversations);
    await this.openConversation(res.id);
    return res.id;
  }

  async addMember(id: number, username: string): Promise<boolean> {
    const res = await this.json<{ conversations: Conversation[] }>(
      `/api/chat/${id}/members`,
      'POST',
      { username },
    );
    if (res) this.conversations.set(res.conversations);
    return !!res;
  }

  async leave(id: number): Promise<void> {
    const res = await this.json<{ conversations: Conversation[] }>(
      `/api/chat/${id}/members/me`,
      'DELETE',
    );
    if (res) this.conversations.set(res.conversations);
    if (this.activeId() === id) this.activeId.set(null);
  }

  async recall(messageId: number): Promise<void> {
    await this.json(`/api/chat/message/${messageId}`, 'DELETE');
  }

  async uploadImage(file: File): Promise<{ url: string } | { error: string }> {
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await fetch('/api/chat/image', {
        method: 'POST',
        credentials: 'same-origin',
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { error: (data as { detail?: string }).detail || 'không gửi được ảnh' };
      return { url: (data as { url: string }).url };
    } catch {
      return { error: 'không kết nối được máy chủ' };
    }
  }

  private async json<T>(url: string, method = 'GET', body?: unknown): Promise<T | null> {
    try {
      const res = await fetch(url, {
        credentials: 'same-origin',
        method,
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch {
      return null;
    }
  }
}
