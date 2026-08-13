import { ChangeDetectionStrategy, Component, ElementRef, ViewEncapsulation, effect, inject, input } from '@angular/core';

import { textToNodes } from '../../../features/news/rich-doc';
import { looksLikeHtml, safeNodes } from '../../util/html-safe';

/**
 * Ve noi dung bai viet.
 *
 * Bai moi luu duoi dang HTML, nhung KHONG BAO GIO gan thang bang innerHTML:
 * chuoi HTML duoc doc bang DOMParser (tai lieu tro) roi DUNG LAI tung the
 * theo danh sach cho phep (xem html-safe.ts) truoc khi gan vao trang.
 *
 * Bai cu (van ban thuan co dau ** va ##) van doc duoc: nhan ra thi chuyen
 * sang node qua rich-doc.ts.
 *
 * ViewEncapsulation.None la BAT BUOC: cac the o day do code tao ra chu khong
 * phai tu template, nen khong mang thuoc tinh _ngcontent — style bi dong goi
 * se khong an vao chung.
 */
@Component({
  selector: 'app-rich-body',
  template: '',
  styleUrl: './rich-body.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'rich-body' },
})
export class RichBody {
  readonly text = input<string>('');
  private readonly host = inject(ElementRef<HTMLElement>);

  constructor() {
    effect(() => {
      const t = this.text() || '';
      const nodes = looksLikeHtml(t) ? safeNodes(t, document) : textToNodes(t, document);
      this.host.nativeElement.replaceChildren(...nodes);
    });
  }
}
