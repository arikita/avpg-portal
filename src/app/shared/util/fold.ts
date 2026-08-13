/**
 * Bo dau tieng Viet + thuong hoa, de tim khong dau van ra ket qua co dau.
 *
 * PHAI ap cho CA hai ve — chuoi bi tim lan tu khoa — thi go "nhan su" moi ra
 * "Nhân sự". O shared vi ca danh ba lan chat deu dung.
 */
export function fold(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}
