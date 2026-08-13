import { Align, BodyBlock, Span, parseBody } from './news.util';

/* ===========================================================================
 *  CAU NOI GIUA O SOAN THAO (WYSIWYG) VA DINH DANG LUU TRU
 *
 *  O soan thao la mot vung contenteditable => noi dung la DOM that (in dam
 *  hien ra in dam ngay). Nhung thu LUU XUONG DB van la van ban thuan voi dau
 *  danh dau (**dam**, ## tieu de...) nhu truoc:
 *    - bai cu van doc duoc, khong phai chuyen doi du lieu;
 *    - trang xem bai van dung app-rich-body (khong innerHTML => khong XSS);
 *    - HTML nguoi dung dan vao KHONG bao gio duoc luu: no phai di qua bo
 *      chuyen doi duoi day, thu gi khong nam trong danh sach cho phep thi
 *      chi con lai phan chu.
 * ========================================================================= */

/** Dia chi vo hai moi cho qua. */
function safeHref(url: string): string | null {
  const u = (url || '').trim();
  return /^(https?:\/\/|mailto:|\/)/i.test(u) ? u : null;
}

/* ------------------------------------------------- DOM  ->  van ban thuan -- */

const WRAP: Array<[string, string]> = [
  ['B', '**'], ['STRONG', '**'],
  ['I', '*'], ['EM', '*'],
  ['U', '__'],
  ['S', '~~'], ['STRIKE', '~~'], ['DEL', '~~'],
  ['MARK', '=='],
];

function inlineText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.textContent || '').replace(/ /g, ' ');
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const el = node as HTMLElement;
  const tag = el.tagName;
  if (tag === 'BR') return '\n';
  if (tag === 'IMG') return '';                       // anh xu ly o muc khoi
  const inner = Array.from(el.childNodes).map(inlineText).join('');
  if (!inner.trim()) return inner;
  if (tag === 'CODE') return '`' + inner + '`';
  if (tag === 'A') {
    const href = safeHref(el.getAttribute('href') || '');
    return href ? `[${inner}](${href})` : inner;
  }
  const w = WRAP.find(([t]) => t === tag)?.[1];
  if (w) return w + inner + w;
  // SPAN/FONT... do trinh duyet tu sinh: doc theo style thay vi bo qua
  const st = el.style;
  let out = inner;
  if (st.fontWeight === 'bold' || +st.fontWeight >= 600) out = `**${out}**`;
  if (st.fontStyle === 'italic') out = `*${out}*`;
  if (st.textDecoration?.includes('underline')) out = `__${out}__`;
  if (st.textDecoration?.includes('line-through')) out = `~~${out}~~`;
  return out;
}

function alignOf(el: HTMLElement): string {
  const a = el.style.textAlign || el.getAttribute('align') || '';
  return a === 'center' || a === 'right' ? `::${a} ` : '';
}

function imagesIn(el: HTMLElement): string[] {
  return Array.from(el.querySelectorAll('img'))
    .map((im) => im.getAttribute('src') || '')
    .filter((s) => safeHref(s));
}

function blockText(el: HTMLElement, out: string[]): void {
  const tag = el.tagName;
  if (tag === 'HR') {
    out.push('---');
    return;
  }
  if (tag === 'IMG') {
    const src = safeHref(el.getAttribute('src') || '');
    if (src) out.push(src);
    return;
  }
  // Cac dong cua danh sach / trich dan phai DINH LIEN NHAU (mot khoi, cach
  // nhau dung mot dau xuong dong). Tach ra thanh nhieu khoi la khi doc lai
  // se thanh nhieu danh sach roi rac, moi cai mot muc.
  if (tag === 'UL' || tag === 'OL') {
    const lines = Array.from(el.children)
      .filter((c) => c.tagName === 'LI')
      .map((li, i) => {
        const line = inlineText(li).replace(/\n+/g, ' ').trim();
        return line ? (tag === 'UL' ? `- ${line}` : `${i + 1}. ${line}`) : '';
      })
      .filter(Boolean);
    if (lines.length) out.push(lines.join('\n'));
    return;
  }
  if (tag === 'BLOCKQUOTE') {
    const lines = inlineText(el).split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length) out.push(lines.map((l) => `> ${l}`).join('\n'));
    return;
  }
  // Anh nam trong doan thi tach ra thanh dong rieng (renderer doi vay).
  for (const src of imagesIn(el)) out.push(src);

  const head = /^H[1-6]$/.test(tag) ? (tag === 'H1' || tag === 'H2' ? '## ' : '### ') : '';
  const body = inlineText(el).replace(/\n{2,}/g, '\n').trim();
  if (body) out.push(alignOf(el) + head + body.split('\n').join('\n'));
}

/** Doc noi dung o soan thao ra van ban thuan de luu. */
export function docToText(root: HTMLElement): string {
  const out: string[] = [];
  for (const node of Array.from(root.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = (node.textContent || '').trim();
      if (t) out.push(t);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      blockText(node as HTMLElement, out);
    }
  }
  // Moi khoi cach nhau mot dong trong => parseBody doc lai dung nhu cu.
  return out.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
}

/* ------------------------------------------------- van ban thuan  ->  DOM -- */

function spanNodes(spans: Span[], d: Document): Node[] {
  return spans.map((s) => {
    let node: Node = d.createTextNode(s.text);
    const wrap = (tag: string) => {
      const el = d.createElement(tag);
      el.appendChild(node);
      node = el;
    };
    if (s.code) wrap('code');
    if (s.mk) wrap('mark');
    if (s.s) wrap('s');
    if (s.u) wrap('u');
    if (s.i) wrap('i');
    if (s.b) wrap('b');
    if (s.href) {
      const a = d.createElement('a');
      a.setAttribute('href', s.href);
      a.appendChild(node);
      node = a;
    }
    return node;
  });
}

function withAlign<T extends HTMLElement>(el: T, align: Align): T {
  if (align !== 'left') el.style.textAlign = align;
  return el;
}

/** Dung DOM tu van ban thuan (khong dung innerHTML). */
export function textToNodes(text: string, d: Document): Node[] {
  const nodes: Node[] = [];
  for (const b of parseBody(text) as BodyBlock[]) {
    switch (b.t) {
      case 'h': {
        const el = withAlign(d.createElement(b.level === 2 ? 'h2' : 'h3'), b.align);
        spanNodes(b.spans, d).forEach((n) => el.appendChild(n));
        nodes.push(el);
        break;
      }
      case 'ul':
      case 'ol': {
        const list = d.createElement(b.t);
        for (const item of b.items) {
          const li = d.createElement('li');
          spanNodes(item, d).forEach((n) => li.appendChild(n));
          list.appendChild(li);
        }
        nodes.push(list);
        break;
      }
      case 'quote': {
        const q = d.createElement('blockquote');
        spanNodes(b.spans, d).forEach((n) => q.appendChild(n));
        nodes.push(q);
        break;
      }
      case 'hr':
        nodes.push(d.createElement('hr'));
        break;
      case 'img': {
        const p = d.createElement('p');
        const im = d.createElement('img');
        im.setAttribute('src', b.src);
        im.setAttribute('alt', '');
        p.appendChild(im);
        nodes.push(p);
        break;
      }
      default: {
        const p = withAlign(d.createElement('p'), b.align);
        const parts = b.spans.length ? spanNodes(b.spans, d) : [d.createElement('br')];
        parts.forEach((n) => p.appendChild(n));
        nodes.push(p);
      }
    }
  }
  if (!nodes.length) {
    const p = d.createElement('p');
    p.appendChild(d.createElement('br'));
    nodes.push(p);
  }
  return nodes;
}
