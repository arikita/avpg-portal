/* ============================================================================
 *  PORTAL CONTENT — cổng công cụ, thông báo, tài liệu tải về.
 *  TODO: thay các url '#' và địa chỉ mẫu bằng liên kết THẬT của hệ thống nội bộ.
 * ========================================================================== */
import { L, PortalLink } from '../core/models/content.models';

export interface PortalGroup {
  title: L;
  links: PortalLink[];
}
export interface Announcement {
  title: L;
  date: string;
  tag?: L;
  body?: L;
}
export interface DownloadItem {
  label: L;
  type: string;
  note?: L;
  url: string;
}

export const PORTAL_GROUPS: PortalGroup[] = [
  {
    title: { vi: 'Công cụ chính', en: 'Core tools' },
    links: [
      { label: { vi: 'Outlook Web', en: 'Outlook Web' }, desc: { vi: 'Email trên trình duyệt', en: 'Email in your browser' }, url: 'https://outlook.office.com', icon: 'mail', tone: 'brand', external: true },
      { label: { vi: 'WorkIT', en: 'WorkIT' }, desc: { vi: 'Đề nghị, phê duyệt, đặt phòng họp', en: 'Requests, approvals, room booking' }, url: 'https://anvietphatgroup.vn/', icon: 'briefcase', tone: 'teal', external: true },
      { label: { vi: 'Helpdesk / Ticket', en: 'Helpdesk / Ticket' }, desc: { vi: 'Gửi yêu cầu hỗ trợ IT', en: 'Open an IT support ticket' }, url: '/help', icon: 'life-buoy', tone: 'coral' },
      { label: { vi: 'SAP', en: 'SAP' }, desc: { vi: 'Hệ thống ERP', en: 'ERP system' }, url: 'https://sap.anvietphatgroup.com', icon: 'grid', tone: 'violet', external: true },
    ],
  },
  {
    title: { vi: 'Hệ thống & Tài nguyên', en: 'Systems & Resources' },
    links: [
      { label: { vi: 'Cổng Nhân sự (HR)', en: 'HR Portal' }, desc: { vi: 'Chấm công, nghỉ phép, phiếu lương', en: 'Attendance, leave, payslips' }, url: '#', icon: 'users', tone: 'brand', external: true },
      { label: { vi: 'Ổ mạng / SynologyDrive', en: 'Network Drive' }, desc: { vi: 'Lưu trữ tài liệu chung', en: 'Shared document storage' }, url: '#', icon: 'folder', tone: 'teal', external: true },
      { label: { vi: 'Website công ty', en: 'Company website' }, desc: { vi: 'avpgroup.vn', en: 'avpgroup.vn' }, url: 'https://avpgroup.vn', icon: 'globe', tone: 'violet', external: true },
      { label: { vi: 'Sơ đồ tổ chức', en: 'Org chart' }, desc: { vi: 'Cơ cấu phòng ban', en: 'Departments & structure' }, url: '#', icon: 'building', tone: 'coral', external: true },
    ],
  },
];

export const ANNOUNCEMENTS: Announcement[] = [
  { tag: { vi: 'Nhân sự', en: 'HR' }, date: '01/08/2026', title: { vi: 'Chào mừng các thành viên mới tháng 8', en: 'Welcome to our new August joiners' }, body: { vi: 'Gặp gỡ và cùng chào đón các đồng nghiệp mới nhé!', en: 'Meet and warmly welcome our newest colleagues!' } },
  { tag: { vi: 'IT', en: 'IT' }, date: '28/07/2026', title: { vi: 'Bảo trì hệ thống email cuối tuần', en: 'Email maintenance this weekend' }, body: { vi: 'Email có thể gián đoạn ngắn vào Chủ nhật. Cảm ơn sự thông cảm của bạn.', en: 'Email may be briefly interrupted on Sunday. Thanks for your patience.' } },
  { tag: { vi: 'Sự kiện', en: 'Event' }, date: '20/07/2026', title: { vi: 'Team building quý 3 đã mở đăng ký', en: 'Q3 team building — registration open' }, body: { vi: 'Đăng ký qua WorkIT trước ngày 15/08.', en: 'Register via WorkIT before Aug 15.' } },
];

export const DOWNLOADS: DownloadItem[] = [
  { label: { vi: 'Mẫu chữ ký email', en: 'Email signature template' }, type: 'DOCX', url: '#' },
  { label: { vi: 'Checklist onboarding', en: 'Onboarding checklist' }, type: 'PDF', url: '#' },
  { label: { vi: 'Biểu mẫu yêu cầu IT', en: 'IT request form' }, type: 'PDF', url: '#' },
  { label: { vi: 'Bộ nhận diện thương hiệu', en: 'Brand assets' }, type: 'ZIP', url: '#' },
];
