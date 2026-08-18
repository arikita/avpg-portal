/* ============================================================================
 *  DIRECTORY CONTENT — danh bạ nội bộ (số máy nhánh).
 *  Sinh tự động từ 'Extension line.xlsx'. Có thể sửa trực tiếp bên dưới.
 * ========================================================================== */
import { Contact, L } from '../core/models/content.models';

/** Nhãn phòng ban song ngữ.
 *  AD chỉ lưu tên tiếng Anh; bảng này dịch sang tiếng Việt khi người dùng
 *  chọn ngôn ngữ VI. Phòng ban không có trong bảng sẽ hiện nguyên tên từ AD. */
export const DEPT_LABELS: Record<string, L> = {
  'BoD':                     { vi: 'Ban Giám đốc', en: 'Board of Directors' },
  'Accounting':              { vi: 'Kế toán', en: 'Accounting' },
  'Assistant Teams':         { vi: 'Trợ lý', en: 'Assistant Teams' },
  'Assistant Dept.':         { vi: 'Phòng Trợ lý', en: 'Assistant Dept.' },
  'Coal':                    { vi: 'Than đá', en: 'Coal' },
  'Finance':                 { vi: 'Tài chính', en: 'Finance' },
  'Human Resources':         { vi: 'Hành chính - Nhân sự', en: 'Human Resources' },
  'Imex Dept.':              { vi: 'Xuất nhập khẩu', en: 'Import - Export' },
  'Information System':      { vi: 'Công nghệ thông tin', en: 'Information System' },
  'Internal Control':        { vi: 'Kiểm soát nội bộ', en: 'Internal Control' },
  'International Relations': { vi: 'Quan hệ quốc tế', en: 'International Relations' },
  'Legal':                   { vi: 'Pháp chế', en: 'Legal' },
  'Marketing':               { vi: 'Marketing', en: 'Marketing' },
  'Material':                { vi: 'Nguyên liệu', en: 'Material' },
  'Paper':                   { vi: 'Giấy', en: 'Paper' },
  'Sustainability':          { vi: 'Phát triển bền vững', en: 'Sustainability' },
  'Technical':               { vi: 'Kỹ thuật', en: 'Technical' },
  'Transportation':          { vi: 'Vận tải', en: 'Transportation' },
  'Treasury':                { vi: 'Ngân quỹ', en: 'Treasury' },
  'Wood Pellets':            { vi: 'Viên nén gỗ', en: 'Wood Pellets' },
  'Woodchip':                { vi: 'Dăm gỗ', en: 'Woodchip' },
  'FSC':                     { vi: 'FSC - Chứng chỉ rừng', en: 'FSC' },
  'HSE':                     { vi: 'An toàn - Sức khỏe - Môi trường', en: 'HSE' },
  'Agribusiness':            { vi: 'Nông nghiệp', en: 'Agribusiness' },
  'Biomass':                 { vi: 'Sinh khối', en: 'Biomass' },
  'Construction':            { vi: 'Xây dựng', en: 'Construction' },
  'Furniture':               { vi: 'Nội thất', en: 'Furniture' },
  'Archives':                { vi: 'Lưu trữ', en: 'Archives' },
  'Quality Control':         { vi: 'Kiểm soát chất lượng', en: 'Quality Control' },
  'Warehouse':               { vi: 'Kho', en: 'Warehouse' },
  'Manager':                 { vi: 'Ban Quản lý', en: 'Manager' },
  'Dai Duong':               { vi: 'Đại Dương', en: 'Dai Duong' },
  'Factory':                 { vi: 'Nhà máy', en: 'Factory' },
  'Factory - Tay Son':       { vi: 'Nhà máy Tây Sơn', en: 'Factory - Tay Son' },
  'Factory - Ha Tinh':       { vi: 'Nhà máy Hà Tĩnh', en: 'Factory - Ha Tinh' },
  'Factory - Cu Chi':        { vi: 'Nhà máy Củ Chi', en: 'Factory - Cu Chi' },
  'Cu Chi':                  { vi: 'Củ Chi', en: 'Cu Chi' },
};


export const MEETING_ROOMS: Contact[] = [
  { name: "Phòng Họp Nhỏ - Tầng G", ext: "1010" },
  { name: "Phòng Họp Lớn - L3", ext: "1011" },
  { name: "Phòng Họp Nhỏ - L3", ext: "1012" },
];

/** Liên hệ khẩn cấp / emergency — TODO: cập nhật số thật nếu có. */
export const EMERGENCY: Contact[] = [
  // TODO: thêm số khẩn cấp thật (bảo vệ, y tế) nếu có
];
