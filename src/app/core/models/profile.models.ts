import { L } from './content.models';

/** Huy hieu suy ra tu du lieu that (tham nien, so bai, luot tuong tac). */
export interface Badge {
  id: string;
  icon: string;
  tone: string;
  label: L;
}

/** Mot muc tren dong thoi gian hoat dong. */
export interface Activity {
  kind: 'post' | 'comment' | 'reaction';
  postId: number;
  title: string;
  snippet: string;
  emoji: string;
  at: string;
}

export interface ProfileStats {
  posts: number;
  viewsReceived: number;
  reactionsReceived: number;
  commentsReceived: number;
  comments: number;
  reactionsGiven: number;
}

export interface Colleague {
  username: string;
  name: string;
  title: string;
}

/** Mot dong ho so nhan su tu Workit; nhan do chinh cau SQL dat ra. */
export interface EmploymentField {
  label: L;
  value: string;
}

export interface Profile {
  username: string;
  isMe: boolean;
  fullName: string;
  title: string;
  department: string;
  mail: string;
  ext: string;
  mobile: string;
  office: string;
  joinedAt: string;
  tenureYears: number | null;
  headline: string;
  bio: string;
  avatar: string;
  cover: string;
  accent: string;
  interests: string[];
  stats: ProfileStats;
  badges: Badge[];
  colleagues: Colleague[];
  activity: Activity[];
  activityMore: boolean;
  /** null = chua cau hinh lop Workit (an han khoi hien). */
  employment: EmploymentField[] | null;
}

/** Cac tong mau ho so duoc chon. Phai KHOP voi ACCENTS trong app/profile.py. */
export const ACCENTS = [
  { id: 'brand', label: { vi: 'Tím AVP', en: 'AVP violet' } },
  { id: 'teal', label: { vi: 'Xanh ngọc', en: 'Teal' } },
  { id: 'violet', label: { vi: 'Tím hoa cà', en: 'Violet' } },
  { id: 'coral', label: { vi: 'San hô', en: 'Coral' } },
  { id: 'amber', label: { vi: 'Hổ phách', en: 'Amber' } },
  { id: 'green', label: { vi: 'Xanh lá', en: 'Green' } },
  { id: 'cyan', label: { vi: 'Xanh biển', en: 'Cyan' } },
  { id: 'rose', label: { vi: 'Hồng', en: 'Rose' } },
] as const;
