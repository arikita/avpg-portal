/** Chat noi bo — kieu du lieu dung chung giua service, khung noi va trang /chat. */

export interface ChatMember {
  username: string;
  name: string;
}

export interface ChatLast {
  sender: string;
  senderName: string;
  body: string;
  image: string;
  at: string;
}

export interface Conversation {
  id: number;
  kind: 'dm' | 'group';
  title: string;
  /** Ten hien ra: ten doi phuong (1-1) hoac ten phong (nhom). */
  name: string;
  /** Username doi phuong, rong voi phong nhom. */
  peer: string;
  members: ChatMember[];
  online: boolean;
  lastAt: string;
  last: ChatLast | null;
  unread: number;
}

/** Mot dong nguoi trong danh sach chatbox — toan bo nhan vien AD. */
export interface ChatPerson {
  username: string;
  name: string;
  title: string;
  dept: string;
  online: boolean;
}

export interface ChatMessage {
  id: number;
  sender: string;
  senderName: string;
  body: string;
  image: string;
  at: string;
  deleted: boolean;
}

/** Su kien day xuong tu WebSocket. */
export interface ChatEvent {
  type: 'ready' | 'pong' | 'msg' | 'typing' | 'read' | 'presence' | 'conv';
  convId?: number;
  message?: ChatMessage;
  user?: string;
  name?: string;
  online?: boolean;
}
