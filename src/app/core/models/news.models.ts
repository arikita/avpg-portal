/** Tin tuc noi bo — kieu du lieu dung chung giua service, feed, detail, editor. */
import { L } from './content.models';

/** 'scheduled' = da hen gio, den gio server tu chuyen sang 'published'. */
export type NewsStatus = 'draft' | 'published' | 'hidden' | 'scheduled';

export interface ReactionFace {
  name: string;
  emoji: string;
  /** De mo ho so nguoi do + lay anh dai dien that. */
  username: string;
}

export interface NewsReactions {
  /** So luot theo tung emoji, vd { '👍': 3, '❤️': 1 }. */
  counts: Record<string, number>;
  /** Emoji cua chinh nguoi dang xem, null neu chua react. */
  mine: string | null;
  total: number;
  /** Vai nguoi react gan nhat, de lam facepile tren the. */
  faces: ReactionFace[];
}

export interface NewsReactor {
  username: string;
  name: string;
  emoji: string;
}

export interface PollOption {
  id: number;
  label: string;
  votes: number;
  mine: boolean;
  /** Ai them phuong an nay (neu do nguoi binh chon tu them). */
  addedBy?: string | null;
  /** Ten nhung nguoi da chon — rong khi binh chon an danh. */
  voters?: string[];
}

export interface Poll {
  id: number;
  question: string;
  multi: boolean;
  options: PollOption[];
  totalVoters: number;
  totalVotes: number;
  voted: boolean;
  /** Cho nguoi binh chon tu them phuong an. */
  allowAdd: boolean;
  /** Khong hien ai da chon gi. */
  anonymous: boolean;
  /** Han chot (ISO) va da qua han chua. */
  closesAt: string | null;
  closed: boolean;
}

/** Mot cau hoi luc dang soan (chua co id). */
export interface PollQOption {
  /** Co id = phuong an da co trong DB (sua thi giu nguyen phieu da bo). */
  id?: number;
  label: string;
  votes?: number;
}

export interface PollQ {
  id?: number;
  question: string;
  multi: boolean;
  allowAdd: boolean;
  options: PollQOption[];
}

/** Poll khi soan bai (chua co id). */
export interface PollDraft {
  question: string;
  multi: boolean;
  options: string[];
  allowAdd?: boolean;
  anonymous?: boolean;
  closesAt?: string | null;
}

export type NotifType = 'comment' | 'reply' | 'reaction' | 'wall_comment' | 'wall_reaction'
  | 'post_published';

export interface Notification {
  /** Duong dan rieng (bai tuong ca nhan); rong = dan toi /news/<postId>. */
  url?: string;
  id: number;
  type: NotifType;
  actor: string;
  actorName: string;
  postId: number | null;
  commentId: number | null;
  snippet: string;
  createdAt: string;
  read: boolean;
  /** So nguoi (chi cho type 'reaction' da gop): "X và N người khác". */
  count?: number;
}

export interface NotifFeed {
  items: Notification[];
  unread: number;
  unseenNews: number;
}

export interface NewsComment {
  id: number;
  parentId: number | null;
  author: string;
  authorName: string;
  body: string;
  deleted: boolean;
  createdAt: string;
  editedAt: string | null;
  replies: NewsComment[];
}

export interface NewsPost {
  id: number;
  title: L;
  summary: L;
  /** Chi co trong trang chi tiet; feed lam nhe nen bo body. */
  body?: L;
  cover: string;
  category: string;
  status: NewsStatus;
  pinned: boolean;
  author: string;
  authorName: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  /** Gio hen dang (chi khac null khi status = 'scheduled'). */
  scheduledAt?: string | null;
  reactions: NewsReactions;
  commentCount?: number;
  views?: number;
  hasPoll?: boolean;
  /** Cho phep binh luan hay khong; false = tat (van hien binh luan cu). */
  commentsEnabled?: boolean;
  comments?: NewsComment[];
  reactors?: NewsReactor[];
  poll?: Poll | null;
  /** Nhieu cau hoi tren mot bai. */
  polls?: Poll[];
  emojis?: string[];
  canEdit?: boolean;
  canModerate?: boolean;
}

export interface NewsFeed {
  posts: NewsPost[];
  emojis: string[];
  canPost: boolean;
}

/** Du lieu gui len khi tao / sua bai. */
export interface NewsDraft {
  title: L;
  summary: L;
  body: L;
  cover: string;
  category: string;
  status: NewsStatus;
  /** Gio hen dang (ISO) — bat buoc khi status = 'scheduled'. */
  scheduledAt?: string | null;
  /** false = tat binh luan cho bai nay. */
  commentsEnabled?: boolean;
  /** Kem poll khi tao bai (chi tao moi, chua ho tro sua poll da co). */
  poll?: PollDraft;
  polls?: PollDraft[];
}

export interface NewsCategory {
  id: string;
  label: L;
  icon: string;
}

/** Danh muc co dinh — hien o chip loc va o chon khi soan bai. */
export const NEWS_CATEGORIES: NewsCategory[] = [
  { id: 'announcement', label: { vi: 'Thông báo', en: 'Announcement' }, icon: 'sparkles' },
  { id: 'event', label: { vi: 'Sự kiện', en: 'Event' }, icon: 'calendar' },
  { id: 'hr', label: { vi: 'Nhân sự', en: 'HR' }, icon: 'users' },
  { id: 'marketing', label: { vi: 'Truyền thông', en: 'Marketing' }, icon: 'rocket' },
  { id: 'welfare', label: { vi: 'Phúc lợi', en: 'Welfare' }, icon: 'gift' },
];
