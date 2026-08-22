/* ============================================================================
 *  HELP CONTENT — hướng dẫn gửi yêu cầu hỗ trợ IT (Helpdesk qua email/Spiceworks).
 *  Nguồn: infographic "Hệ thống Helpdesk IT — Mục đích & Hướng dẫn sử dụng".
 * ========================================================================== */
import { Contact, GuideSection, L } from '../core/models/content.models';

/** Địa chỉ Helpdesk (Spiceworks) — TODO: cập nhật nếu đổi hệ thống. */
export const HELPDESK_EMAIL = 'help@avp.on.spiceworks.com';

/** URL cổng end-user của Spiceworks (mở tab mới — Spiceworks chặn nhúng iframe). */
export const HELPDESK_PORTAL_URL = 'https://avp.on.spiceworks.com/portal';

/** Ghi chú: ticket tự nhận diện qua Active Directory. */
export const AD_NOTE: L = {
  vi: 'Ticket của bạn được tự nhận diện qua Active Directory — không cần khai lại tên, phòng ban hay email.',
  en: 'Your ticket is auto-recognized via Active Directory — no need to re-enter your name, department or email.',
};

export const HELP_LEAD: L = {
  vi: 'Gặp trục trặc về máy tính, email, mạng hay phần mềm? Chỉ cần gửi một email tới hệ thống Helpdesk — yêu cầu sẽ được tiếp nhận, phân loại và xử lý theo thứ tự.',
  en: 'Trouble with your computer, email, network or software? Just send one email to the Helpdesk — your request is logged, triaged and handled in order.',
};

export const HELP_SECTIONS: GuideSection[] = [
  {
    id: 'purpose',
    icon: 'info',
    title: { vi: 'Vì sao dùng Helpdesk?', en: 'Why use the Helpdesk?' },
    blocks: [
      {
        kind: 'bullets',
        items: [
          { vi: 'Kết nối nhanh chóng giữa bạn và bộ phận CNTT.', en: 'A fast connection between you and the IT department.' },
          { vi: 'Tránh sai sót — hạn chế quên hoặc bỏ lỡ yêu cầu.', en: 'Fewer mistakes — requests won’t be forgotten or missed.' },
          { vi: 'Đảm bảo thứ tự — xử lý minh bạch, ưu tiên kịp thời.', en: 'Order guaranteed — transparent handling with timely priority.' },
        ],
      },
    ],
  },
  {
    id: 'how',
    icon: 'send',
    title: { vi: 'Bước 1 — Gửi email yêu cầu', en: 'Step 1 — Send a request email' },
    intro: {
      vi: 'Soạn một email theo đúng định dạng dưới đây và gửi tới Helpdesk:',
      en: 'Compose an email in the format below and send it to the Helpdesk:',
    },
    blocks: [
      {
        kind: 'fields',
        items: [
          { label: { vi: 'To (Gửi tới)', en: 'To' }, value: HELPDESK_EMAIL, copy: true },
          { label: { vi: 'Subject (Tiêu đề)', en: 'Subject' }, value: '[Tên sự cố / Vấn đề]' },
          { label: { vi: 'Body (Nội dung)', en: 'Body' }, value: 'Mô tả chi tiết sự cố + đính kèm ảnh lỗi' },
        ],
      },
      {
        kind: 'callout',
        tone: 'tip',
        title: { vi: 'Mẹo xử lý nhanh hơn', en: 'For a faster fix' },
        text: {
          vi: 'Tiêu đề rõ ràng và ảnh chụp màn hình lỗi giúp IT xử lý nhanh hơn nhiều so với mô tả chung chung.',
          en: 'A clear subject line and an error screenshot get your issue solved far faster than a vague description.',
        },
      },
    ],
  },
  {
    id: 'process',
    icon: 'settings',
    title: { vi: 'Bước 2 — IT tiếp nhận & xử lý', en: 'Step 2 — IT receives & handles' },
    intro: {
      vi: 'Sau khi nhận email, phòng IT sẽ xử lý theo quy trình:',
      en: 'Once your email arrives, the IT team follows this process:',
    },
    blocks: [
      {
        kind: 'steps',
        items: [
          { vi: 'Tiếp nhận & đánh giá yêu cầu.', en: 'Receive & assess the request.' },
          { vi: 'Phân loại & điều phối tới đúng người xử lý.', en: 'Classify & dispatch to the right handler.' },
          { vi: 'Xử lý & phản hồi kịp thời cho bạn.', en: 'Resolve & respond to you promptly.' },
          { vi: 'Hoàn tất hỗ trợ.', en: 'Support completed.' },
        ],
      },
    ],
  },
  {
    id: 'info',
    icon: 'list-checks',
    title: { vi: 'Thông tin nên cung cấp', en: 'What to include' },
    blocks: [
      {
        kind: 'bullets',
        items: [
          { vi: 'Họ tên, phòng ban và số máy nhánh của bạn.', en: 'Your name, department and extension.' },
          { vi: 'Thiết bị gặp lỗi (mã máy/tên máy nếu có).', en: 'The affected device (asset tag/name if any).' },
          { vi: 'Mô tả lỗi và thời điểm bắt đầu xảy ra.', en: 'A description of the error and when it started.' },
          { vi: 'Ảnh chụp màn hình thông báo lỗi.', en: 'A screenshot of the error message.' },
        ],
      },
    ],
  },
  {
    id: 'sla',
    icon: 'clock',
    title: { vi: 'Thời gian phản hồi (tham khảo)', en: 'Response times (reference)' },
    blocks: [
      {
        kind: 'table',
        head: [
          { vi: 'Mức độ', en: 'Priority' },
          { vi: 'Ví dụ', en: 'Example' },
          { vi: 'Phản hồi', en: 'Response' },
        ],
        rows: [
          [
            { vi: 'Khẩn cấp', en: 'Critical' },
            { vi: 'Mất mạng cả phòng, sự cố hệ thống', en: 'Whole-floor outage, system down' },
            { vi: 'Trong ~30 phút', en: 'Within ~30 min' },
          ],
          [
            { vi: 'Cao', en: 'High' },
            { vi: 'Không đăng nhập được, không gửi email', en: 'Cannot log in, cannot send email' },
            { vi: 'Trong ~2 giờ', en: 'Within ~2 hours' },
          ],
          [
            { vi: 'Thường', en: 'Normal' },
            { vi: 'Cài phần mềm, cấp quyền, thiết bị', en: 'Install software, access, device' },
            { vi: 'Trong ~1 ngày làm việc', en: 'Within ~1 business day' },
          ],
        ],
      },
    ],
  },
];

export const IT_CONTACTS: Contact[] = [
  { name: 'IT Helpdesk (Spiceworks)', role: { vi: 'Gửi yêu cầu qua email', en: 'Email to open a ticket' }, email: HELPDESK_EMAIL },
  { name: 'Đường dây IT', role: { vi: 'Hỗ trợ trực tiếp', en: 'Direct support' }, ext: '1718' },
  { name: 'Đường dây IT', role: { vi: 'Hỗ trợ trực tiếp', en: 'Direct support' }, ext: '1789' },
];

/**
 * Minh bach voi nhan vien ve viec ghi log (quyet dinh D16, 22/08/2026).
 *
 * Portal co ghi lai loi ky thuat kem TEN DANG NHAP va 20 thao tac gan nhat de
 * IT tra nguoc duoc su co. Nguoi dung phai duoc biet dieu do — day la lua chon
 * co y thuc, khong phai mac dinh ky thuat.
 */
export const LOG_NOTICE: L = {
  vi:
    'Khi có lỗi kỹ thuật, portal tự ghi lại tên đăng nhập của bạn, trang bạn đang xem và ' +
    '20 thao tác gần nhất (bấm nút, chuyển trang, gọi dữ liệu) để bộ phận IT tra được nguyên nhân. ' +
    'Nội dung tin nhắn và chữ bạn đang gõ KHÔNG bao giờ được ghi lại. ' +
    'Chỉ nhóm Information System xem được, và dữ liệu này ở lại máy chủ nội bộ của công ty.',
  en:
    'When a technical error occurs, the portal records your username, the page you were on and ' +
    'your last 20 actions (clicks, navigation, data calls) so IT can trace the cause. ' +
    'Message content and text you are typing are NEVER recorded. ' +
    'Only the Information System team can view this, and the data stays on company servers.',
};
