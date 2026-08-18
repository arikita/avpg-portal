/** Tuong ca nhan tren trang ho so. */

export interface WallFace {
  name: string;
  username: string;
  emoji: string;
}

export interface WallReactions {
  counts: Record<string, number>;
  /** Cam xuc cua chinh nguoi dang xem, null neu chua tha. */
  mine: string | null;
  total: number;
  faces: WallFace[];
}

export interface WallComment {
  id: number;
  author: string;
  authorName: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
  canDelete: boolean;
}

export interface WallPost {
  id: number;
  owner: string;
  author: string;
  authorName: string;
  body: string;
  image: string;
  createdAt: string;
  editedAt: string | null;
  reactions: WallReactions;
  /** Chi 3 binh luan MOI NHAT — server khong tra het (xem wall.py COMMENT_PREVIEW). */
  comments: WallComment[];
  /** Tong so binh luan that, de hien dem va tinh "Xem them N binh luan". */
  commentTotal: number;
  canEdit: boolean;
  canDelete: boolean;
}

export interface WallPage {
  owner: string;
  posts: WallPost[];
  more: boolean;
  total: number;
  emojis: string[];
  /** Chi chu ho so dang duoc len tuong cua minh. */
  canPost: boolean;
  /** Bang tin: pham vi that su duoc dung ('all' khi khong xac dinh phong ban). */
  scope?: 'all' | 'dept';
}
