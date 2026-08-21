import { L } from './content.models';
import { Poll } from './news.models';

/**
 * Du lieu hai cot ben cua trang Doi song (/feed), lay MOT lan tu /api/rail.
 * Phan nao khong lay duoc thi backend tra rong/null — o do khong hien, cot
 * van dung.
 */

export interface RailBadge {
  id: string;
  icon: string;
  tone: string;
  label: L;
}

export interface RailMe {
  username: string;
  fullName: string;
  title: string;
  department: string;
  avatar: string;
  cover: string;
  headline: string;
  joinedAt: string;
  tenureYears: number | null;
  badges: RailBadge[];
  /** Bai tin tuc + bai tuong cong lai. */
  posts: number;
  /** Cam xuc nguoi khac tha vao bai cua minh. */
  reactions: number;
}

export interface RailPhoto {
  thumb: string;
  full: string;
}

export interface RailPhotos {
  slug: string;
  title: L;
  count: number;
  photos: RailPhoto[];
}

export interface RailPerson {
  username: string;
  name: string;
  title: string;
  avatar: string;
}

export interface RailNews {
  id: number;
  title: L;
  cover: string;
  category: string;
  publishedAt: string;
}

export interface RailPoll {
  postId: number;
  postTitle: L;
  poll: Poll;
}

export interface RailNewcomer {
  username: string;
  name: string;
  title: string;
  department: string;
  joinedAt: string;
}

export interface RailData {
  me: RailMe | null;
  photos: RailPhotos | null;
  online: RailPerson[];
  news: RailNews[];
  poll: RailPoll | null;
  newcomers: RailNewcomer[];
  /** Sinh nhat — chua co nguon (cho login read-only ben Workit). */
  birthdays: RailPerson[];
}
