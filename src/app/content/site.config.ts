/* ============================================================================
 *  SITE CONFIG — chỉnh sửa thông tin chung ở đây / edit global info here.
 *  Tất cả chuỗi song ngữ có dạng { vi: '...', en: '...' }.
 * ========================================================================== */
import { L, NavItem } from '../core/models/content.models';

export const SITE = {
  short: 'AVP',
  company: 'An Việt Phát',
  companyFull: {
    vi: 'Tập đoàn An Việt Phát (AVP Group)',
    en: 'An Viet Phat Group (AVP Group)',
  } as L,
  portalName: {
    vi: 'Cổng nội bộ & Onboarding',
    en: 'Internal Portal & Onboarding',
  } as L,
  /** Khẩu hiệu tập đoàn — giữ nguyên tiếng Anh cho cả hai ngôn ngữ,
   *  không dịch (hiện ở hero trang chủ, chân trang và trang đăng nhập). */
  slogan: 'Together growing strong and success',
  tagline: {
    vi: 'Mọi thứ bạn cần cho ngày đầu tiên tại An Việt Phát — gọn gàng trong một nơi.',
    en: 'Everything you need for your first day at An Viet Phat — all in one place.',
  } as L,
  // Helpdesk chạy trên Spiceworks — gửi email để tạo ticket
  itEmail: 'help@avp.on.spiceworks.com',
  itHotline: '1718', // IT Team Leader ext (Nguyễn Hữu Tùng)
  year: 2026,
};

/** Thanh điều hướng chính / main navigation.
 *  Chỗ chứa là `.container` khoá cứng 1180px — 8 mục là vừa, thêm nữa thì
 *  nhóm nút bên phải (chuông, VI/EN…) sẽ nuốt mất mục cuối. Mục ít dùng để
 *  ở NAV_MORE bên dưới (Quy định IT rút xuống 18/08/2026 vì đã có ở chân trang). */
export const NAV: NavItem[] = [
  { id: 'news', label: { vi: 'Tin tức', en: 'News' }, path: '/news', icon: 'newspaper' },
  { id: 'feed', label: { vi: 'Đời sống', en: 'Life' }, path: '/feed', icon: 'message' },
  { id: 'onboarding', label: { vi: 'Hội nhập', en: 'Onboarding' }, path: '/onboarding', icon: 'compass' },
  { id: 'gallery', label: { vi: 'Hình ảnh', en: 'Gallery' }, path: '/gallery', icon: 'images' },
  // Tạm ẩn 20/08/2026 (theo yêu cầu): rút khỏi menu + chân trang + menu điện thoại.
  // Route /portal vẫn còn nên link cũ / bookmark không gãy. Bỏ comment để hiện lại.
  // { id: 'portal', label: { vi: 'Công cụ', en: 'Tools' }, path: '/portal', icon: 'grid' },
  { id: 'directory', label: { vi: 'Liên hệ', en: 'Contact' }, path: '/directory', icon: 'users' },
  { id: 'help', label: { vi: 'Hỗ trợ', en: 'Help' }, path: '/help', icon: 'life-buoy' },
];

/** Mục phụ: KHÔNG lên thanh menu, chỉ nằm ở chân trang + menu điện thoại.
 *  Route vẫn giữ nguyên nên link cũ / bookmark không gãy. */
export const NAV_MORE: NavItem[] = [
  { id: 'policies', label: { vi: 'Chính sách', en: 'Policies' }, path: '/policies', icon: 'shield' },
  { id: 'regulations', label: { vi: 'Quy định IT', en: 'IT Rules' }, path: '/regulations', icon: 'lock' },
  { id: 'faq', label: { vi: 'FAQ', en: 'FAQ' }, path: '/faq', icon: 'help' },
];
