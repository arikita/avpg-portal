/** Chuan hoa so di dong lay tu Active Directory ve dang de doc cua Viet Nam.
 *
 *  Truong `mobile` trong AD duoc nhap tay nen moi kieu deu co: '912345678'
 *  (rung so 0 dau), '0912345678', '+84 912 345 678', '0912.345.678'.
 *  Quy uoc hien thi cua portal: 10 chu so, CO so 0 dau, cat 'xxxx xxx xxx'.
 *
 *  Khong dua ve duoc 10 so (so co dinh, so nuoc ngoai, so nhap sai) thi tra ve
 *  nguyen ban — hien tho con hon hien sai. */
export function formatMobile(raw: string): string {
  const v = (raw ?? '').trim();
  if (!v) return '';

  let d = v.replace(/\D/g, '');
  if (d.startsWith('0084')) d = d.slice(4);
  else if (d.startsWith('84') && d.length > 9) d = d.slice(2); // +84...
  if (d.length === 9) d = '0' + d;

  if (d.length !== 10 || !d.startsWith('0')) return v;
  return d.slice(0, 4) + ' ' + d.slice(4, 7) + ' ' + d.slice(7);
}
