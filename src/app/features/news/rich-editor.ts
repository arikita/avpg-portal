import { ChangeDetectionStrategy, Component, ElementRef, ViewEncapsulation, computed, effect, inject, input, output, signal, viewChild } from '@angular/core';

import { LanguageService } from '../../core/services/language.service';
import { NewsService } from '../../core/services/news.service';
import { IconComponent } from '../../shared/components/icon/icon';
import { looksLikeHtml, safeHtml, safeNodes, toEmbedUrl } from '../../shared/util/html-safe';
import { textToNodes } from './rich-doc';

/** Mau chu / mau nen chon san (khong cho nhap tu do cho khoi loan bo cuc). */
export const COLORS = [
  { name: 'Đen', v: '#141a2e' }, { name: 'Xám', v: '#59617a' },
  { name: 'Đỏ', v: '#e11d48' }, { name: 'Cam', v: '#ea580c' },
  { name: 'Vàng', v: '#ca8a04' }, { name: 'Xanh lá', v: '#16a34a' },
  { name: 'Xanh dương', v: '#2563eb' }, { name: 'Tím', v: '#7c3aed' },
  { name: 'Hồng', v: '#db2777' }, { name: 'Nâu', v: '#78350f' },
];

export const SIZES = [
  { label: 'Rất nhỏ', px: 13 }, { label: 'Nhỏ', px: 15 }, { label: 'Thường', px: 17 },
  { label: 'Lớn', px: 20 }, { label: 'Rất lớn', px: 24 }, { label: 'Khổng lồ', px: 30 },
];

export const EMOJIS = ('😀 😄 😊 😍 🥰 😎 🤝 👍 👏 🙏 💪 🎉 🎊 🥳 ✨ 🔥 ⭐ ❤️ 💙 💚 ✅ ❌ ⚠️ 📌 📎 '
  + '📅 🕐 📢 📣 💡 🎯 🚀 🏆 🥇 ⚽ 🏅 🎁 🍀 ☕ 🍰 🌟 📊 📈 💼 🏢 🚗 ✈️ 🌸 🌈')
  .split(' ');

type Popover = 'color' | 'bg' | 'size' | 'emoji' | 'link' | 'video' | 'table' | null;

/**
 * O soan bai viet — go thay ngay (WYSIWYG).
 *
 * Noi dung luu duoi dang HTML, nhung MOI chuoi HTML deu di qua bo loc
 * html-safe.ts truoc khi gui len cha (va server con loc lai lan nua). O soan
 * thao dung chung class .rich-body voi trang xem bai nen soan sao hien vay.
 */
@Component({
  selector: 'app-rich-editor',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rich-editor.html',
  styleUrl: './rich-editor.scss',
  // Cac the trong vung soan thao do trinh duyet / code tao ra, khong mang
  // thuoc tinh cua template => style bi dong goi se KHONG an vao chung.
  // Moi rule trong file scss deu nam trong .rte nen tat dong goi khong ro ri.
  encapsulation: ViewEncapsulation.None,
})
export class RichEditor {
  private readonly svc = inject(NewsService);
  readonly lang = inject(LanguageService).lang;

  readonly text = input<string>('');
  readonly minHeight = input(380);
  readonly placeholder = input('');

  readonly textChange = output<string>();
  readonly busy = output<boolean>();
  readonly failed = output<string>();

  private readonly docRef = viewChild<ElementRef<HTMLElement>>('doc');

  readonly colors = COLORS;
  readonly sizes = SIZES;
  readonly emojis = EMOJIS;

  readonly uploading = signal(false);
  readonly empty = signal(true);
  readonly full = signal(false);
  readonly pop = signal<Popover>(null);
  readonly linkUrl = signal('');
  readonly linkText = signal('');
  readonly videoUrl = signal('');
  readonly videoErr = signal(false);
  readonly tableRows = signal(3);
  readonly tableCols = signal(3);
  readonly words = signal(0);

  /** O dang tro trong bang / dang chon anh -> hien thanh cong cu rieng. */
  readonly inTable = signal(false);
  readonly picked = signal<HTMLImageElement | null>(null);

  /** Chuoi vua gui len cha, de bo qua tieng vong cua chinh minh. */
  private echo = '';
  /** Vung chon luu lai truoc khi bam vao bang mau / o nhap (bam ra ngoai la mat). */
  private saved: Range | null = null;

  readonly canCaption = computed(() => !!this.picked());

  constructor() {
    effect(() => {
      const next = this.text() || '';
      const el = this.docRef()?.nativeElement;
      if (!el || next === this.echo) return;
      this.echo = next;
      const nodes = looksLikeHtml(next) ? safeNodes(next, document) : textToNodes(next, document);
      el.replaceChildren(...nodes);
      if (!el.childNodes.length) el.appendChild(document.createElement('p'));
      this.after();
    });
  }

  private doc(): HTMLElement {
    return this.docRef()!.nativeElement;
  }

  /** Cap nhat cac chi so phu (con trong khong, dem chu). */
  private after(): void {
    const el = this.doc();
    const txt = (el.textContent || '').trim();
    this.empty.set(!txt && !el.querySelector('img, iframe, table'));
    this.words.set(txt ? txt.split(/\s+/).length : 0);
  }

  /** Doc noi dung, loc sach roi bao cho component cha. */
  private emit(): void {
    const html = safeHtml(this.doc().innerHTML, document);
    this.echo = html;
    this.after();
    this.textChange.emit(html);
  }

  onInput(): void {
    this.emit();
  }

  onDocClick(ev: MouseEvent): void {
    const t = ev.target as HTMLElement;
    this.picked.set(t?.tagName === 'IMG' ? (t as HTMLImageElement) : null);
    this.inTable.set(!!t?.closest?.('table'));
    this.pop.set(null);
  }

  onKeyup(): void {
    const sel = window.getSelection();
    const node = sel?.focusNode as HTMLElement | null;
    const el = node?.nodeType === 1 ? node : node?.parentElement ?? null;
    this.inTable.set(!!el?.closest('table'));
  }

  onKeydown(ev: KeyboardEvent): void {
    const ctrl = ev.ctrlKey || ev.metaKey;
    if (ctrl && !ev.altKey && ev.key.toLowerCase() === 'k') {
      ev.preventDefault();
      this.openPop('link');
    }
    // Trong bang: Tab nhay sang o ke tiep cho giong Word.
    if (ev.key === 'Tab' && this.inTable()) {
      const cell = this.currentCell();
      const next = cell && (ev.shiftKey ? this.prevCell(cell) : this.nextCell(cell));
      if (next) {
        ev.preventDefault();
        this.caretInto(next);
      }
    }
  }

  /* --------------------------------------------------------------- dan/keo -- */

  /** Dan tu Word/web: giu dinh dang nhung phai qua bo loc; anh trong clipboard
   *  (vd anh chup man hinh) thi tai len roi chen. */
  async onPaste(ev: ClipboardEvent): Promise<void> {
    const dt = ev.clipboardData;
    if (!dt) return;
    const file = Array.from(dt.files).find((f) => f.type.startsWith('image/'));
    if (file) {
      ev.preventDefault();
      await this.upload(file, true);
      return;
    }
    const html = dt.getData('text/html');
    ev.preventDefault();
    if (html) {
      this.exec('insertHTML', safeHtml(html, document));
    } else {
      this.exec('insertText', dt.getData('text/plain'));
    }
  }

  async onDrop(ev: DragEvent): Promise<void> {
    const files = Array.from(ev.dataTransfer?.files ?? []).filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;
    ev.preventDefault();
    for (const f of files) await this.upload(f, true);
  }

  /* -------------------------------------------------------------- thao tac -- */

  private exec(cmd: string, value?: string, css = false): void {
    this.doc().focus();
    document.execCommand('styleWithCSS', false, css ? 'true' : 'false');
    document.execCommand(cmd, false, value);
    this.emit();
  }

  fmt(kind: 'b' | 'i' | 'u' | 's' | 'sub' | 'sup' | 'clear'): void {
    const map = {
      b: 'bold', i: 'italic', u: 'underline', s: 'strikeThrough',
      sub: 'subscript', sup: 'superscript', clear: 'removeFormat',
    } as const;
    this.exec(map[kind]);
  }

  mark(): void {
    this.wrapTag('mark');
  }
  codeSpan(): void {
    this.wrapTag('code');
  }

  private wrapTag(tag: 'mark' | 'code'): void {
    const el = this.doc();
    el.focus();
    const sel = window.getSelection();
    if (!sel?.rangeCount || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    if (!el.contains(range.commonAncestorContainer)) return;
    const parent = range.commonAncestorContainer.nodeType === 1
      ? (range.commonAncestorContainer as HTMLElement)
      : range.commonAncestorContainer.parentElement;
    const inside = parent?.closest(tag);
    if (inside) {
      inside.replaceWith(...Array.from(inside.childNodes));
    } else {
      const node = document.createElement(tag);
      node.appendChild(range.extractContents());
      range.insertNode(node);
    }
    this.emit();
  }

  block(tag: 'H2' | 'H3' | 'H4' | 'P' | 'BLOCKQUOTE' | 'PRE'): void {
    this.exec('formatBlock', `<${tag}>`);
  }

  list(ordered: boolean): void {
    this.exec(ordered ? 'insertOrderedList' : 'insertUnorderedList');
  }

  indent(out = false): void {
    this.exec(out ? 'outdent' : 'indent', undefined, true);
  }

  align(dir: 'Left' | 'Center' | 'Right' | 'Full'): void {
    this.exec(`justify${dir}`, undefined, true);
  }

  undo(): void {
    this.exec('undo');
  }
  redo(): void {
    this.exec('redo');
  }
  hr(): void {
    this.exec('insertHorizontalRule');
  }

  /* ------------------------------------------------------- mau / co / emoji -- */

  /** Nho vung dang chon truoc khi bam nut (bam ra ngoai o soan la mat vung chon). */
  private save(): void {
    const sel = window.getSelection();
    this.saved = sel?.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
  }

  private restore(): void {
    const sel = window.getSelection();
    this.doc().focus();
    if (this.saved && sel) {
      sel.removeAllRanges();
      sel.addRange(this.saved);
    }
  }

  openPop(p: Popover): void {
    this.save();
    if (p === 'link') {
      const sel = window.getSelection();
      this.linkText.set(sel?.toString() ?? '');
      this.linkUrl.set('');
    }
    if (p === 'video') {
      this.videoUrl.set('');
      this.videoErr.set(false);
    }
    this.pop.update((cur) => (cur === p ? null : p));
  }

  setColor(v: string, background = false): void {
    this.restore();
    this.exec(background ? 'hiliteColor' : 'foreColor', v, true);
    this.pop.set(null);
  }

  /** Co chu: execCommand chi cho 1..7 nen bam xong phai doi <font> thanh span. */
  setSize(px: number): void {
    this.restore();
    this.doc().focus();
    document.execCommand('styleWithCSS', false, 'false');
    document.execCommand('fontSize', false, '7');
    for (const f of Array.from(this.doc().querySelectorAll('font[size="7"]'))) {
      const span = document.createElement('span');
      span.style.fontSize = `${px}px`;
      span.append(...Array.from(f.childNodes));
      f.replaceWith(span);
    }
    this.emit();
    this.pop.set(null);
  }

  setLineHeight(v: string): void {
    this.restore();
    for (const b of this.selectedBlocks()) b.style.lineHeight = v;
    this.emit();
  }

  emoji(e: string): void {
    this.restore();
    this.exec('insertText', e);
    this.pop.set(null);
  }

  /** Cac khoi (p/h2/li...) dang nam trong vung chon. */
  private selectedBlocks(): HTMLElement[] {
    const el = this.doc();
    const sel = window.getSelection();
    if (!sel?.rangeCount) return [];
    const range = sel.getRangeAt(0);
    const blocks = Array.from(el.querySelectorAll('p,h2,h3,h4,li,blockquote,td,th,div'))
      .filter((b) => range.intersectsNode(b)) as HTMLElement[];
    if (blocks.length) return blocks;
    const node = range.startContainer;
    const one = (node.nodeType === 1 ? node : node.parentElement) as HTMLElement | null;
    return one && el.contains(one) ? [one] : [];
  }

  /* ---------------------------------------------------- lien ket / video ---- */

  applyLink(): void {
    const raw = this.linkUrl().trim();
    if (!raw) return;
    const href = /^(https?:\/\/|mailto:|\/)/i.test(raw) ? raw : `https://${raw}`;
    this.restore();
    const sel = window.getSelection();
    if (sel?.isCollapsed) {
      const label = this.linkText().trim() || href;
      const a = document.createElement('a');
      a.setAttribute('href', href);
      a.textContent = label;
      this.insertNode(a);
    } else {
      this.exec('createLink', href);
    }
    this.pop.set(null);
  }

  applyVideo(): void {
    const embed = toEmbedUrl(this.videoUrl());
    if (!embed) {
      this.videoErr.set(true);
      return;
    }
    const fig = document.createElement('figure');
    fig.className = 'video';
    const frame = document.createElement('iframe');
    frame.setAttribute('src', embed);
    frame.setAttribute('allowfullscreen', '');
    frame.setAttribute('loading', 'lazy');
    fig.appendChild(frame);
    this.restore();
    this.insertNode(fig, true);
    this.pop.set(null);
  }

  /** Chen mot the vao vi tri con tro (kem doan trong phia sau de con go tiep). */
  private insertNode(node: Node, block = false): void {
    const el = this.doc();
    el.focus();
    const sel = window.getSelection();
    let range = sel?.rangeCount ? sel.getRangeAt(0) : null;
    if (!range || !el.contains(range.commonAncestorContainer)) {
      range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
    }
    range.deleteContents();
    range.insertNode(node);
    if (block) {
      const p = document.createElement('p');
      p.appendChild(document.createElement('br'));
      node.parentNode?.insertBefore(p, node.nextSibling);
      this.caretInto(p);
    } else {
      range.setStartAfter(node);
      range.collapse(true);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
    this.emit();
  }

  private caretInto(el: Element): void {
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(true);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }

  /* ------------------------------------------------------------- anh / file -- */

  private async upload(file: File, image: boolean): Promise<void> {
    this.uploading.set(true);
    this.busy.emit(true);
    try {
      const res = await this.svc.uploadFile(file);
      if (image) {
        const img = document.createElement('img');
        img.setAttribute('src', res.url);
        img.setAttribute('alt', '');
        this.insertNode(img, true);
      } else {
        const a = document.createElement('a');
        a.className = 'att';
        a.setAttribute('href', res.url);
        a.textContent = res.name;
        this.insertNode(a);
      }
    } catch (e) {
      this.failed.emit((e as Error).message);
    } finally {
      this.uploading.set(false);
      this.busy.emit(false);
    }
  }

  async pickImage(ev: Event): Promise<void> {
    const el = ev.target as HTMLInputElement;
    for (const f of Array.from(el.files ?? [])) await this.upload(f, true);
    el.value = '';
  }

  async pickFile(ev: Event): Promise<void> {
    const el = ev.target as HTMLInputElement;
    for (const f of Array.from(el.files ?? [])) await this.upload(f, false);
    el.value = '';
  }

  /* --- chinh anh dang chon --- */
  imgWidth(pct: number): void {
    const img = this.picked();
    if (!img) return;
    img.style.width = `${pct}%`;
    this.emit();
  }

  imgAlign(side: 'left' | 'center' | 'right'): void {
    const img = this.picked();
    if (!img) return;
    const fig = this.figureOf(img);
    fig.className = `fig fig-${side}`;
    fig.style.textAlign = side;
    this.emit();
  }

  imgCaption(): void {
    const img = this.picked();
    if (!img) return;
    const fig = this.figureOf(img);
    let cap = fig.querySelector('figcaption');
    if (!cap) {
      cap = document.createElement('figcaption');
      cap.textContent = this.lang() === 'vi' ? 'Chú thích ảnh' : 'Caption';
      fig.appendChild(cap);
    }
    this.caretInto(cap);
    this.emit();
  }

  imgDelete(): void {
    const img = this.picked();
    if (!img) return;
    (img.closest('figure') ?? img).remove();
    this.picked.set(null);
    this.emit();
  }

  private figureOf(img: HTMLImageElement): HTMLElement {
    const cur = img.closest('figure');
    if (cur) return cur as HTMLElement;
    const fig = document.createElement('figure');
    fig.className = 'fig';
    img.replaceWith(fig);
    fig.appendChild(img);
    return fig;
  }

  /* ------------------------------------------------------------------ bang -- */

  insertTable(): void {
    const rows = Math.min(20, Math.max(1, this.tableRows()));
    const cols = Math.min(10, Math.max(1, this.tableCols()));
    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const htr = document.createElement('tr');
    for (let c = 0; c < cols; c++) {
      const th = document.createElement('th');
      th.appendChild(document.createElement('br'));
      htr.appendChild(th);
    }
    thead.appendChild(htr);
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    for (let r = 1; r < rows; r++) {
      const tr = document.createElement('tr');
      for (let c = 0; c < cols; c++) {
        const td = document.createElement('td');
        td.appendChild(document.createElement('br'));
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    this.restore();
    this.insertNode(table, true);
    this.pop.set(null);
    const first = table.querySelector('th');
    if (first) this.caretInto(first);
    this.inTable.set(true);
  }

  private currentCell(): HTMLTableCellElement | null {
    const sel = window.getSelection();
    const node = sel?.focusNode;
    const el = (node?.nodeType === 1 ? node : node?.parentElement) as HTMLElement | null;
    return (el?.closest('td,th') as HTMLTableCellElement) ?? null;
  }

  private cells(table: HTMLTableElement): HTMLTableCellElement[] {
    return Array.from(table.querySelectorAll('td,th'));
  }

  private nextCell(cell: HTMLTableCellElement): HTMLTableCellElement | null {
    const table = cell.closest('table') as HTMLTableElement;
    const all = this.cells(table);
    return all[all.indexOf(cell) + 1] ?? null;
  }

  private prevCell(cell: HTMLTableCellElement): HTMLTableCellElement | null {
    const table = cell.closest('table') as HTMLTableElement;
    const all = this.cells(table);
    return all[all.indexOf(cell) - 1] ?? null;
  }

  rowOp(op: 'above' | 'below' | 'del'): void {
    const cell = this.currentCell();
    const tr = cell?.closest('tr');
    if (!cell || !tr) return;
    if (op === 'del') {
      const table = tr.closest('table');
      tr.remove();
      if (table && !table.querySelector('tr')) table.remove();
    } else {
      const copy = document.createElement('tr');
      for (let i = 0; i < tr.children.length; i++) {
        const td = document.createElement('td');
        td.appendChild(document.createElement('br'));
        copy.appendChild(td);
      }
      tr.parentElement?.insertBefore(copy, op === 'above' ? tr : tr.nextSibling);
    }
    this.emit();
  }

  colOp(op: 'left' | 'right' | 'del'): void {
    const cell = this.currentCell();
    const table = cell?.closest('table');
    if (!cell || !table) return;
    const idx = Array.from(cell.parentElement!.children).indexOf(cell);
    for (const tr of Array.from(table.querySelectorAll('tr'))) {
      const target = tr.children[idx];
      if (op === 'del') {
        target?.remove();
        continue;
      }
      const isHead = tr.parentElement?.tagName === 'THEAD';
      const cellNew = document.createElement(isHead ? 'th' : 'td');
      cellNew.appendChild(document.createElement('br'));
      if (target) tr.insertBefore(cellNew, op === 'left' ? target : target.nextSibling);
      else tr.appendChild(cellNew);
    }
    if (!table.querySelector('td,th')) table.remove();
    this.emit();
  }

  merge(dir: 'right' | 'down'): void {
    const cell = this.currentCell();
    if (!cell) return;
    const tr = cell.closest('tr')!;
    const idx = Array.from(tr.children).indexOf(cell);
    const other = dir === 'right'
      ? (tr.children[idx + 1] as HTMLTableCellElement | undefined)
      : (this.rowAfter(tr)?.children[idx] as HTMLTableCellElement | undefined);
    if (!other) return;
    const span = dir === 'right' ? 'colSpan' : 'rowSpan';
    cell[span] = (cell[span] || 1) + (other[span] || 1);
    while (other.firstChild) cell.appendChild(other.firstChild);
    other.remove();
    this.emit();
  }

  private rowAfter(tr: HTMLTableRowElement): HTMLTableRowElement | null {
    const table = tr.closest('table') as HTMLTableElement;
    const rows = Array.from(table.querySelectorAll('tr'));
    return rows[rows.indexOf(tr) + 1] ?? null;
  }

  delTable(): void {
    this.currentCell()?.closest('table')?.remove();
    this.inTable.set(false);
    this.emit();
  }

  /* ------------------------------------------------------------ toan man hinh */
  toggleFull(): void {
    this.full.update((v) => !v);
    document.body.style.overflow = this.full() ? 'hidden' : '';
  }
}
