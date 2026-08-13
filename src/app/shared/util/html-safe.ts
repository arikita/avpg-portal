/* ===========================================================================
 *  BO LOC HTML — TANG 1 (trinh duyet)
 *
 *  Bai viet luu duoi dang HTML de co bang / mau chu / co chu. Vi vay MOI
 *  chuoi HTML — dan tu Word, tu web, hay lay tu API ve — deu phai di qua day
 *  truoc khi hien ra man hinh hoac truoc khi gui len server.
 *
 *  Cach lam: KHONG "don dep" chuoi HTML cu (kieu do rat de bi qua mat), ma
 *  DUNG LAI cay DOM tu dau: doc chuoi bang DOMParser (tao ra tai lieu tro,
 *  khong chay script, khong tai anh), roi chi chep sang nhung the / thuoc
 *  tinh / thuoc tinh CSS nam trong danh sach cho phep. Thu gi khong biet thi
 *  bo the, giu lai phan chu ben trong.
 *
 *  Server con mot lop loc nua (nh3) khi ghi vao DB — hong mot lop van con lop kia.
 * ========================================================================= */

/** The duoc phep giu lai. */
const TAGS = new Set([
  'p', 'br', 'hr', 'h2', 'h3', 'h4',
  'b', 'strong', 'i', 'em', 'u', 's', 'del', 'mark', 'sub', 'sup',
  'code', 'pre', 'blockquote',
  'ul', 'ol', 'li',
  'a', 'img', 'figure', 'figcaption',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
  'span', 'div', 'iframe',
]);

/** The chi lam nen (bo the, giu chu ben trong). */
const UNWRAP = new Set(['font', 'small', 'big', 'center', 'section', 'article', 'main',
  'header', 'footer', 'label', 'form', 'html', 'body', 'tt', 'abbr', 'cite', 'time']);

/** Thuoc tinh cho phep theo tung the. */
const ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'title']),
  img: new Set(['src', 'alt', 'title', 'width', 'height']),
  td: new Set(['colspan', 'rowspan']),
  th: new Set(['colspan', 'rowspan']),
  iframe: new Set(['src', 'width', 'height']),
};

/** Lop CSS cho phep (dung cho anh / video / bang — khong cho tu do). */
const CLASSES = new Set(['video', 'fig', 'fig-left', 'fig-center', 'fig-right', 'att', 'tbl']);

/** Thuoc tinh CSS cho phep trong style="".
 *  CHI cac thuoc tinh TRANG TRI vo hai (mau, chu, khung, khoang cach, bong,
 *  bo goc, nen/gradient). KHONG cho position/top/left/z-index/float/opacity
 *  (tranh phu de/clickjacking) va url() bi chan rieng o STYLE_BAD. */
const STYLES = new Set([
  'color', 'background-color', 'background', 'text-align', 'font-size', 'line-height',
  'font-weight', 'font-style', 'font-family', 'text-decoration', 'text-transform',
  'letter-spacing', 'text-shadow',
  'width', 'max-width', 'min-width', 'height', 'max-height',
  'margin', 'margin-left', 'margin-right', 'margin-top', 'margin-bottom',
  'padding', 'padding-left', 'padding-right', 'padding-top', 'padding-bottom',
  'border', 'border-color', 'border-width', 'border-style', 'border-radius',
  'border-top', 'border-bottom', 'border-left', 'border-right', 'box-shadow',
  'vertical-align', 'display', 'white-space',
]);

/** Gia tri CSS: chan url() (anh/js ngoai), expression(), \ va bieu thuc la. */
const STYLE_VALUE = /^[a-z0-9 .,%#()/_'"+-]{1,240}$/i;
const STYLE_BAD = /url\(|expression|javascript:|@import|<|\\|position|fixed|sticky|absolute/i;

/** Chi cho nhung dia chi vo hai. */
const SAFE_URL = /^(https?:\/\/|mailto:|\/(?!\/))/i;

/** Nhung noi duy nhat duoc phep nhung khung video. */
const EMBED_HOSTS = [
  /^https:\/\/www\.youtube(-nocookie)?\.com\/embed\/[\w-]{6,20}(\?[\w=&%.-]*)?$/i,
  /^https:\/\/player\.vimeo\.com\/video\/\d{5,15}(\?[\w=&%.-]*)?$/i,
];

/** Dia chi YouTube/Vimeo nguoi dung dan vao -> dia chi nhung duoc. */
export function toEmbedUrl(raw: string): string | null {
  const u = (raw || '').trim();
  let m = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|live\/)|youtu\.be\/)([\w-]{6,20})/i);
  if (m) return `https://www.youtube.com/embed/${m[1]}`;
  m = u.match(/vimeo\.com\/(?:video\/)?(\d{5,15})/i);
  if (m) return `https://player.vimeo.com/video/${m[1]}`;
  return null;
}

function safeUrl(url: string | null): string | null {
  // Bo ky tu dieu khien: "java\nscript:..." la chieu qua mat bo loc kinh dien.
  const u = (url || '').replace(/[\u0000-\u0020\u007F]/g, '');
  return SAFE_URL.test(u) ? u : null;
}

function cleanStyle(value: string): string {
  const out: string[] = [];
  for (const part of (value || '').split(';')) {
    const i = part.indexOf(':');
    if (i < 0) continue;
    const prop = part.slice(0, i).trim().toLowerCase();
    const val = part.slice(i + 1).trim();
    if (!STYLES.has(prop) || !val) continue;
    if (STYLE_BAD.test(val) || !STYLE_VALUE.test(val)) continue;
    out.push(`${prop}: ${val}`);
  }
  return out.join('; ');
}

function cleanClass(value: string): string {
  return (value || '').split(/\s+/).filter((c) => CLASSES.has(c)).join(' ');
}

function copyAttrs(src: Element, dst: Element, tag: string): boolean {
  for (const attr of Array.from(src.attributes)) {
    const name = attr.name.toLowerCase();
    const value = attr.value;
    if (name === 'style') {
      const s = cleanStyle(value);
      if (s) dst.setAttribute('style', s);
      continue;
    }
    if (name === 'class') {
      const c = cleanClass(value);
      if (c) dst.setAttribute('class', c);
      continue;
    }
    if (!ATTRS[tag]?.has(name)) continue;      // on*, srcset, data-*, ... bi bo
    if (name === 'href' || name === 'src') {
      const u = safeUrl(value);
      if (!u) return false;                    // dia chi la => bo han the nay
      dst.setAttribute(name, u);
      continue;
    }
    if ((name === 'width' || name === 'height' || name === 'colspan' || name === 'rowspan')
        && !/^\d{1,4}$/.test(value)) continue;
    dst.setAttribute(name, value);
  }
  return true;
}

function convert(node: Node, doc: Document, out: Node[]): void {
  if (node.nodeType === 3) {                   // chu
    out.push(doc.createTextNode(node.textContent || ''));
    return;
  }
  if (node.nodeType !== 1) return;             // binh luan, CDATA... bo het
  const el = node as Element;
  const tag = el.tagName.toLowerCase();

  // script/style/noscript...: bo CA phan chu ben trong.
  if (tag === 'script' || tag === 'style' || tag === 'noscript' || tag === 'template'
      || tag === 'object' || tag === 'embed' || tag === 'svg' || tag === 'math'
      || tag === 'link' || tag === 'meta' || tag === 'base' || tag === 'title') {
    return;
  }

  if (tag === 'iframe') {
    const src = safeUrl(el.getAttribute('src'));
    if (!src || !EMBED_HOSTS.some((re) => re.test(src))) return;   // chi YouTube/Vimeo
    const fig = doc.createElement('figure');
    fig.setAttribute('class', 'video');
    const frame = doc.createElement('iframe');
    frame.setAttribute('src', src);
    frame.setAttribute('loading', 'lazy');
    frame.setAttribute('allowfullscreen', '');
    frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    frame.setAttribute('allow', 'accelerometer; clipboard-write; encrypted-media; picture-in-picture');
    fig.appendChild(frame);
    out.push(fig);
    return;
  }

  const kids: Node[] = [];
  for (const child of Array.from(el.childNodes)) convert(child, doc, kids);

  if (!TAGS.has(tag) || UNWRAP.has(tag)) {     // the la: giu chu, bo the
    out.push(...kids);
    return;
  }

  const copy = doc.createElement(tag);
  if (!copyAttrs(el, copy, tag)) {             // dia chi la => bo the, giu chu
    out.push(...kids);
    return;
  }
  if (tag === 'a') {
    copy.setAttribute('target', '_blank');
    copy.setAttribute('rel', 'noopener noreferrer');
  }
  if (tag === 'img') copy.setAttribute('loading', 'lazy');
  kids.forEach((k) => copy.appendChild(k));
  out.push(copy);
}

/** Doc chuoi HTML thanh cac node AN TOAN trong tai lieu dang dung. */
export function safeNodes(html: string, doc: Document): Node[] {
  const parsed = new DOMParser().parseFromString(`<body>${html || ''}</body>`, 'text/html');
  const out: Node[] = [];
  for (const child of Array.from(parsed.body.childNodes)) convert(child, doc, out);
  return out;
}

/** Loc mot chuoi HTML, tra ve chuoi HTML da sach (dung truoc khi gui len server). */
export function safeHtml(html: string, doc: Document): string {
  const box = doc.createElement('div');
  safeNodes(html, doc).forEach((n) => box.appendChild(n));
  return box.innerHTML;
}

/** Bai viet co phai HTML khong (bai cu la van ban thuan). */
export function looksLikeHtml(s: string): boolean {
  return /<(p|div|h2|h3|h4|ul|ol|li|table|img|figure|blockquote|br|span|b|strong|i|em|a)\b/i.test(s || '');
}
