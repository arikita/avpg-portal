/** Mot mau chu; co `href` thi ve thanh the <a>. */
export interface TextSeg {
  text: string;
  href?: string;
}

const URL_RE = /(https?:\/\/[^\s<>"')]+)|(\bwww\.[^\s<>"')]+)/g;
const TRAIL_RE = /[.,;:!?)\]]+$/;

/**
 * Tach van ban THUAN thanh cac mau chu, dia chi web thanh link.
 *
 * Lam o day chu KHONG chuyen sang HTML: bai tuong luu van ban thuan, giao dien
 * ve bang binding cua Angular (khong innerHTML) nen khong co duong nao chen
 * the la vao trang. Chi nhan http/https — `javascript:` khong bao gio khop.
 */
export function linkify(text: string): TextSeg[] {
  const out: TextSeg[] = [];
  const src = text || '';
  let last = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(URL_RE.source, 'g');
  while ((m = re.exec(src)) !== null) {
    if (m.index > last) out.push({ text: src.slice(last, m.index) });
    last = m.index + m[0].length;
    // Dau cau dinh cuoi dia chi thi tra lai cho phan chu.
    const trail = m[0].match(TRAIL_RE)?.[0] ?? '';
    const url = trail ? m[0].slice(0, -trail.length) : m[0];
    out.push({ text: url, href: url.startsWith('www.') ? `https://${url}` : url });
    if (trail) out.push({ text: trail });
  }
  if (last < src.length) out.push({ text: src.slice(last) });
  return out;
}
