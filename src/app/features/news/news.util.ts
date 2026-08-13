import { Lang } from '../../core/models/content.models';

// initials/avatarHue da chuyen sang shared/util (navbar + danh ba + ho so cung
// dung). Xuat lai o day cho cac import cu khoi phai sua.
export { avatarHue, initials } from '../../shared/util/avatar.util';

/** Thoi gian tuong doi song ngu: "5 phút trước" / "5 min ago". */
export function relTime(iso: string, lang: Lang): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
  const vi = lang === 'vi';
  if (s < 45) return vi ? 'vừa xong' : 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return vi ? `${m} phút trước` : `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return vi ? `${h} giờ trước` : `${h} h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return vi ? `${d} ngày trước` : `${d} d ago`;
  return new Date(iso).toLocaleDateString(vi ? 'vi-VN' : 'en-GB',
    { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/* ===========================================================================
 *  NOI DUNG BAI VIET
 *  Tac gia go van ban thuan + danh dau don gian (thanh cong cu trong trinh
 *  soan thao tu chen cac dau nay). Renderer dung binding cua Angular chu
 *  KHONG dung innerHTML => khong co duong nao chen HTML/script vao trang.
 * ========================================================================= */

/** Mot doan chu cung dinh dang (in dam, nghieng, gach chan…). */
export interface Span {
  text: string;
  b?: boolean;    // **dam**
  i?: boolean;    // *nghieng*
  u?: boolean;    // __gach chan__
  s?: boolean;    // ~~gach ngang~~
  mk?: boolean;   // ==to sang==
  code?: boolean; // `ma`
  href?: string;  // [chu](dia-chi) hoac URL tran
}

export type Align = 'left' | 'center' | 'right';

/** Mot khoi noi dung an toan (render qua binding cua Angular, khong innerHTML). */
export type BodyBlock =
  | { t: 'p'; spans: Span[]; align: Align }
  | { t: 'h'; level: 2 | 3; spans: Span[]; align: Align }
  | { t: 'ul'; items: Span[][] }
  | { t: 'ol'; items: Span[][] }
  | { t: 'quote'; spans: Span[] }
  | { t: 'hr' }
  | { t: 'img'; src: string };

const IMG_RE = /^(\/media\/|https?:\/\/)\S+\.(png|jpe?g|gif|webp)$/i;
const ALIGN_RE = /^::(center|right|left)\s*/;
const HEAD_RE = /^(#{2,3})\s+(.*)$/;
const UL_RE = /^[-*]\s+(.*)$/;
const OL_RE = /^\d+[.)]\s+(.*)$/;
const QUOTE_RE = /^>\s?(.*)$/;
const HR_RE = /^(-{3,}|\*{3,}|_{3,})$/;

// Cac kieu inline, thu tu QUAN TRONG: '***' truoc '**' truoc '*', '__' truoc '_'.
const INLINE_RE = new RegExp(
  [
    /\*\*\*([\s\S]+?)\*\*\*/.source,      // 0 dam + nghieng
    // (?!\*) de "**dam *va nghieng***" khong dong som roi bo lai mot dau *
    /\*\*([\s\S]+?)\*\*(?!\*)/.source,    // 1 dam
    /__([\s\S]+?)__(?!_)/.source,         // 2 gach chan
    /~~([\s\S]+?)~~/.source,              // 3 gach ngang
    /==([\s\S]+?)==/.source,              // 4 to sang
    /`([^`\n]+)`/.source,                 // 5 ma
    /\[([^\]\n]+)\]\(([^)\s]+)\)/.source, // 6 chu, 7 dia chi
    /\*([^*\n]+)\*/.source,               // 8 nghieng (*)
    /(?<![\w\d])_([^_\n]+)_/.source,      // 9 nghieng (_) - bo qua ten_co_gach_duoi
    /(https?:\/\/[^\s<>"')]+)/.source,    // 10 URL tran
  ].join('|'),
  'g',
);

/** Chi cho phep dia chi vo hai; con lai tra ve chuoi thuong. */
function safeHref(url: string): string | null {
  const u = url.trim();
  return /^(https?:\/\/|mailto:|\/)/i.test(u) ? u : null;
}

function push(out: Span[], text: string, base: Span): void {
  if (text) out.push({ ...base, text });
}

/** Tach mot doan chu thanh cac span co dinh dang; long nhau duoc (dam + nghieng). */
export function parseInline(text: string, base: Span = { text: '' }): Span[] {
  const out: Span[] = [];
  const re = new RegExp(INLINE_RE.source, 'g');
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) push(out, text.slice(last, m.index), base);
    last = m.index + m[0].length;
    const [, bi, bold, und, strike, mark, code, linkText, linkHref, it1, it2, url] = m;
    if (bi !== undefined) out.push(...parseInline(bi, { ...base, b: true, i: true }));
    else if (bold !== undefined) out.push(...parseInline(bold, { ...base, b: true }));
    else if (und !== undefined) out.push(...parseInline(und, { ...base, u: true }));
    else if (strike !== undefined) out.push(...parseInline(strike, { ...base, s: true }));
    else if (mark !== undefined) out.push(...parseInline(mark, { ...base, mk: true }));
    else if (code !== undefined) push(out, code, { ...base, code: true });
    else if (linkText !== undefined) {
      const href = safeHref(linkHref);
      out.push(...parseInline(linkText, href ? { ...base, href } : base));
    } else if (it1 !== undefined) out.push(...parseInline(it1, { ...base, i: true }));
    else if (it2 !== undefined) out.push(...parseInline(it2, { ...base, i: true }));
    else if (url !== undefined) {
      // Dau cau dinh cuoi URL thi tra lai cho phan chu.
      const trail = url.match(/[.,;:!?]+$/)?.[0] ?? '';
      const clean = trail ? url.slice(0, -trail.length) : url;
      const href = safeHref(clean);
      push(out, clean, href ? { ...base, href } : base);
      push(out, trail, base);
    }
  }
  push(out, text.slice(last), base);
  return out;
}

/** Tach dau canh le "::center " dau dong. */
function takeAlign(line: string): { align: Align; rest: string } {
  const m = line.match(ALIGN_RE);
  return m ? { align: m[1] as Align, rest: line.slice(m[0].length) }
           : { align: 'left', rest: line };
}

/**
 * Bo cuc than thien khi soan: dong trong = ngat doan; "## "/"### " = tieu de;
 * "- " = gach dau dong; "1. " = danh sach so; "> " = trich dan; "---" = duong
 * ke ngang; "::center " = canh giua; dong chi chua URL anh = anh.
 */
export function parseBody(text: string): BodyBlock[] {
  const blocks: BodyBlock[] = [];
  const lines = (text || '').replace(/\r\n/g, '\n').split('\n');
  let para: string[] = [];
  let paraAlign: Align = 'left';
  let ul: Span[][] = [];
  let ol: Span[][] = [];
  let quote: string[] = [];

  const flushPara = () => {
    if (para.length) blocks.push({ t: 'p', spans: parseInline(para.join('\n')), align: paraAlign });
    para = [];
    paraAlign = 'left';
  };
  const flushUl = () => {
    if (ul.length) blocks.push({ t: 'ul', items: ul });
    ul = [];
  };
  const flushOl = () => {
    if (ol.length) blocks.push({ t: 'ol', items: ol });
    ol = [];
  };
  const flushQuote = () => {
    if (quote.length) blocks.push({ t: 'quote', spans: parseInline(quote.join('\n')) });
    quote = [];
  };
  const flushAll = () => {
    flushUl();
    flushOl();
    flushQuote();
    flushPara();
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushAll();
      continue;
    }
    if (HR_RE.test(line)) {
      flushAll();
      blocks.push({ t: 'hr' });
      continue;
    }
    if (IMG_RE.test(line)) {
      flushAll();
      blocks.push({ t: 'img', src: line });
      continue;
    }
    const { align, rest } = takeAlign(line);
    const head = rest.match(HEAD_RE);
    if (head) {
      flushAll();
      blocks.push({
        t: 'h',
        level: head[1].length === 2 ? 2 : 3,
        spans: parseInline(head[2].trim()),
        align,
      });
      continue;
    }
    const bullet = rest.match(UL_RE);
    if (bullet) {
      flushOl();
      flushQuote();
      flushPara();
      ul.push(parseInline(bullet[1].trim()));
      continue;
    }
    const num = rest.match(OL_RE);
    if (num) {
      flushUl();
      flushQuote();
      flushPara();
      ol.push(parseInline(num[1].trim()));
      continue;
    }
    const q = rest.match(QUOTE_RE);
    if (q) {
      flushUl();
      flushOl();
      flushPara();
      quote.push(q[1].trim());
      continue;
    }
    flushUl();
    flushOl();
    flushQuote();
    if (!para.length) paraAlign = align;
    para.push(rest);
  }
  flushAll();
  return blocks;
}
