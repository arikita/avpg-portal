/**
 * Chu cai dau + mau nen cho anh dai dien.
 *
 * O day (shared) chu khong o features/news vi avatar gio dung ca o navbar,
 * danh ba va trang ho so. news.util.ts xuat lai hai ham nay nen cac import cu
 * van chay binh thuong.
 */

/** Chu cai dau (toi da 2) lam avatar chu. */
export function initials(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Mau avatar on dinh theo ten (chi de trang trong hon). */
export function avatarHue(name: string): number {
  let h = 0;
  for (const ch of name || '?') h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}
