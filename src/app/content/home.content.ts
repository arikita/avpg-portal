/* ============================================================================
 *  HOME PAGE CONTENT — nội dung trang chủ.
 * ========================================================================== */
import { L, PortalLink, StatItem, ValueItem } from '../core/models/content.models';

/** KHONG con hien thi tren trang chu (user yeu cau bo 19/08/2026) — giu lai
 *  de doi xung voi ban ghi content.HOME_LEAD trong DB, du phong khi bat lai. */
export const HOME_LEAD: L = {
  vi: 'Chào mừng bạn gia nhập đại gia đình An Việt Phát! Trang này giúp bạn bắt nhịp thật nhanh — từ tài khoản, email, Wi-Fi đến WorkIT và hỗ trợ IT.',
  en: 'Welcome to the An Viet Phat family! This hub gets you up to speed fast — from accounts, email and Wi-Fi to WorkIT and IT support.',
};

/** Số liệu nổi bật (placeholder — cập nhật số thật). */
export const STATS: StatItem[] = [
  { num: '2014', label: { vi: 'Năm thành lập', en: 'Founded' } },
  { num: '1.000+', label: { vi: 'Nhân sự', en: 'Team members' } },
  { num: '10+', label: { vi: 'Công ty thành viên', en: 'Member companies' } },
  { num: '30+', label: { vi: 'Quốc gia xuất khẩu', en: 'Export markets' } },
];

/** Giá trị cốt lõi / văn hóa (placeholder — thay bằng giá trị thật của AVP). */
export const VALUES: ValueItem[] = [
  {
    icon: 'zap',
    title: { vi: 'Tốc độ & Hiệu quả', en: 'Speed & Efficiency' },
    text: {
      vi: 'Ra quyết định nhanh, hành động dứt khoát và luôn hướng đến kết quả.',
      en: 'Decide fast, act decisively, and always aim for results.',
    },
  },
  {
    icon: 'shield-check',
    title: { vi: 'Chính trực', en: 'Integrity' },
    text: {
      vi: 'Trung thực, minh bạch và giữ chữ tín trong mọi việc.',
      en: 'Honesty, transparency and keeping our word in everything.',
    },
  },
  {
    icon: 'users',
    title: { vi: 'Đồng đội', en: 'Teamwork' },
    text: {
      vi: 'Cùng nhau tiến xa — sẻ chia kiến thức và hỗ trợ lẫn nhau.',
      en: 'We go far together — sharing knowledge and supporting each other.',
    },
  },
  {
    icon: 'rocket',
    title: { vi: 'Đổi mới', en: 'Innovation' },
    text: {
      vi: 'Không ngừng học hỏi, cải tiến và ứng dụng công nghệ mới.',
      en: 'Constantly learning, improving and adopting new technology.',
    },
  },
];

/** Truy cập nhanh trên trang chủ. */
export const QUICK_LINKS: PortalLink[] = [
  {
    label: { vi: 'Bắt đầu Onboarding', en: 'Start Onboarding' },
    desc: { vi: 'Hướng dẫn từng bước cho người mới', en: 'Step-by-step guide for newcomers' },
    url: '/onboarding',
    icon: 'compass',
    tone: 'brand',
  },
  {
    label: { vi: 'Kết nối Wi-Fi', en: 'Connect Wi-Fi' },
    desc: { vi: 'SSID, mật khẩu & cách kết nối', en: 'SSID, password & how to connect' },
    url: '/onboarding#wifi',
    icon: 'wifi',
    tone: 'teal',
  },
  {
    label: { vi: 'Gửi yêu cầu hỗ trợ', en: 'Request IT Support' },
    desc: { vi: 'Tạo ticket cho bộ phận IT', en: 'Open a ticket with IT' },
    // Bam la sang thang cong Spiceworks (mo tab moi) — user chot 19/08/2026.
    url: 'https://avp.on.spiceworks.com/portal',
    icon: 'life-buoy',
    tone: 'coral',
  },
  {
    label: { vi: 'Liên hệ nội bộ', en: 'Internal Contacts' },
    desc: { vi: 'Số máy nhánh & đầu mối liên hệ', en: 'Extensions & key contacts' },
    url: '/directory',
    icon: 'users',
    tone: 'violet',
  },
];
