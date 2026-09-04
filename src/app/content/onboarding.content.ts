/* ============================================================================
 *  ONBOARDING CONTENT — hướng dẫn nhân viên mới.
 *
 *  Từ 04/09/2026 hội nhập gồm NHIỀU PHÒNG BAN, mỗi phòng một trang riêng
 *  (/onboarding/<slug>). Trang /onboarding chỉ còn là trang trung tâm: danh
 *  sách việc cần làm + thẻ dẫn sang từng phòng.
 *
 *  THÊM MỘT PHÒNG = thêm một phần tử vào PHONG_BAN ở cuối file. Không phải
 *  sửa route, không phải sửa component — cả hai đều đọc từ danh sách đó.
 *
 *  MỖI PHÒNG KHAI RÕ `module` + tên khoá của mình thay vì suy ra theo quy
 *  ước: nội dung IT đã nằm sẵn trong DB dưới module `onboarding` với khoá
 *  `ONBOARDING_INTRO`/`SECTIONS` từ trước, đổi tên khoá là bản trong DB và
 *  bản dự phòng trong bundle lệch nhau ngay (luật số 1 trong CLAUDE.md).
 *
 *  Mỗi section gồm các "blocks": p | steps | bullets | callout | fields | table | links
 * ========================================================================== */
import { ChecklistItem, GuideSection, L } from '../core/models/content.models';

export const ONBOARDING_INTRO: L = {
  vi: 'Hành trình 8 bước giúp bạn sẵn sàng làm việc ngay trong ngày đầu tiên. Đánh dấu hoàn thành từng mục — tiến độ được lưu lại trên máy của bạn.',
  en: 'An 8-step journey to get you working from day one. Tick each item off — your progress is saved on your device.',
};

/** Checklist ngày đầu / tuần đầu (tương tác, lưu localStorage). */
export const CHECKLIST: ChecklistItem[] = [
  {
    id: 'account',
    text: { vi: 'Kích hoạt tài khoản & đăng nhập email công ty', en: 'Activate your account & sign in to company email' },
    hint: { vi: 'Đổi mật khẩu lần đầu', en: 'Change your password on first login' },
  },
  {
    id: 'outlook',
    text: { vi: 'Cài đặt Outlook trên máy tính và điện thoại', en: 'Set up Outlook on desktop and phone' },
  },
  {
    id: 'wifi',
    text: { vi: 'Kết nối Wi-Fi nhân viên', en: 'Connect to the staff Wi-Fi' },
  },
  {
    id: 'phone',
    text: { vi: 'Ghi lại số máy nhánh của bạn', en: 'Note your desk phone number' },
  },
  {
    id: 'workit',
    text: { vi: 'Đăng nhập WorkIT & thử đặt phòng họp', en: 'Log in to WorkIT & try booking a meeting room' },
  },
  {
    id: 'software',
    text: { vi: 'Cài các phần mềm cần thiết (qua IT)', en: 'Install required software (via IT)' },
  },
  {
    id: 'security',
    text: { vi: 'Đọc quy tắc bảo mật & khoá màn hình khi rời chỗ', en: 'Read the security rules & lock your screen when away' },
  },
  {
    id: 'support',
    text: { vi: 'Biết cách gửi yêu cầu hỗ trợ IT', en: 'Know how to open an IT support ticket' },
  },
];

export const SECTIONS: GuideSection[] = [
  /* -------------------------------------------------------------- welcome -- */
  {
    id: 'welcome',
    icon: 'sparkles',
    eyebrow: { vi: 'Bắt đầu', en: 'Get started' },
    title: { vi: 'Chào mừng đến với An Việt Phát', en: 'Welcome to An Viet Phat' },
    intro: {
      vi: 'Rất vui được đón bạn! Dưới đây là những điều cơ bản để bạn hoà nhập nhanh và tự tin.',
      en: 'So glad to have you! Here are the essentials to help you settle in quickly and confidently.',
    },
    readMin: 2,
    blocks: [
      {
        kind: 'p',
        text: {
          vi: 'Trong tuần đầu tiên, hãy tập trung vào việc thiết lập công cụ làm việc và làm quen với đồng nghiệp. Đừng ngại đặt câu hỏi — mọi người luôn sẵn sàng giúp đỡ.',
          en: 'In your first week, focus on setting up your tools and getting to know your colleagues. Never hesitate to ask questions — everyone is happy to help.',
        },
      },
      {
        kind: 'callout',
        tone: 'tip',
        title: { vi: 'Mẹo', en: 'Tip' },
        text: {
          vi: 'Lưu trang này vào mục yêu thích của trình duyệt. Bạn quay lại tra cứu bất cứ lúc nào.',
          en: 'Bookmark this page. Come back any time for a quick reference.',
        },
      },
    ],
  },

  /* ------------------------------------------------------- account & email -- */
  {
    id: 'account',
    icon: 'at-sign',
    eyebrow: { vi: 'Danh tính số', en: 'Digital identity' },
    title: { vi: 'Tài khoản & Email', en: 'Account & Email' },
    intro: {
      vi: 'Tài khoản công ty là chìa khoá cho email, máy tính, Wi-Fi và các hệ thống nội bộ.',
      en: 'Your company account is the key to email, your computer, Wi-Fi and internal systems.',
    },
    readMin: 3,
    blocks: [
      {
        kind: 'p',
        text: {
          vi: 'Phòng IT tạo tài khoản cho bạn theo họ tên và bàn giao ngay trong ngày đầu. Bạn chỉ có MỘT tài khoản duy nhất — dùng chung cho cả việc đăng nhập máy tính lẫn email.',
          en: 'IT creates your account from your full name and hands it over on day one. You have ONE account only — the same one for both your computer login and your email.',
        },
      },
      {
        kind: 'p',
        text: {
          vi: 'Quy tắc đặt tên: lấy TÊN (chữ cuối) + viết tắt HỌ và TÊN ĐỆM theo thứ tự. Ví dụ: “Trần Văn An” → an + t + v = antv.',
          en: 'Naming rule: take the GIVEN name (last word) + the initials of the family and middle names, in order. Example: “Trần Văn An” → an + t + v = antv.',
        },
      },
      {
        kind: 'fields',
        title: { vi: 'Tài khoản của bạn', en: 'Your account' },
        items: [
          { label: { vi: 'Ví dụ tên', en: 'Example name' }, value: 'Trần Văn An' },
          { label: { vi: 'Tài khoản đăng nhập', en: 'Login username' }, value: 'antv' },
          { label: { vi: 'Email', en: 'Email' }, value: 'antv@anvietenergy.com' },
        ],
      },
      {
        kind: 'callout',
        tone: 'info',
        title: { vi: 'Một mật khẩu cho tất cả', en: 'One password for everything' },
        text: {
          vi: 'Bạn chỉ cần ĐỔI MẬT KHẨU một lần trên máy tính — mật khẩu email cũng tự đổi theo. Không phải nhớ hai mật khẩu khác nhau.',
          en: 'You only change your password ONCE, on your computer — your email password changes with it. No need to remember two different passwords.',
        },
      },
      {
        kind: 'steps',
        items: [
          { vi: 'Nhận tài khoản + mật khẩu tạm từ IT/Nhân sự.', en: 'Receive your account + temporary password from IT/HR.' },
          { vi: 'Đăng nhập máy tính lần đầu, nhấn cùng lúc ba phím Ctrl + Alt + Delete rồi chọn “Change a password” (Đổi mật khẩu) để đặt mật khẩu riêng của bạn.', en: 'Log in to your PC, press Ctrl+Alt+Del → “Change a password” to set your own.' },
          { vi: 'Mật khẩu mới áp dụng luôn cho email — mở Outlook và đăng nhập lại nếu được hỏi.', en: 'The new password also applies to email — open Outlook and re-sign in if prompted.' },
          { vi: 'Gửi/nhận một email thử để kiểm tra.', en: 'Send and receive a test email to confirm.' },
        ],
      },
      {
        kind: 'callout',
        tone: 'warning',
        title: { vi: 'Mật khẩu mạnh', en: 'Strong passwords' },
        text: {
          vi: 'Tối thiểu 8–12 ký tự, có cả chữ hoa, chữ thường, số và ký tự đặc biệt (ví dụ @ # $ !). Không dùng chung mật khẩu với tài khoản cá nhân và không chia sẻ cho bất kỳ ai.',
          en: 'At least 8–12 characters with upper/lowercase, numbers and symbols. Never reuse personal passwords or share them with anyone.',
        },
      },
    ],
  },

  /* --------------------------------------------------------------- outlook -- */
  {
    id: 'outlook',
    icon: 'mail',
    eyebrow: { vi: 'Email', en: 'Email' },
    title: { vi: 'Sử dụng Outlook', en: 'Using Outlook' },
    intro: {
      vi: 'Outlook là email chính thức để trao đổi công việc, lịch họp và liên hệ nội bộ.',
      en: 'Outlook is the official tool for work email, calendars and internal contacts.',
    },
    readMin: 4,
    blocks: [
      {
        kind: 'steps',
        items: [
          { vi: 'Mở Outlook trên máy tính → nhập email công ty → làm theo hướng dẫn tự động.', en: 'Open Outlook on your PC → enter your company email → follow the automatic setup.' },
          { vi: 'Trên điện thoại: cài app “Microsoft Outlook”, đăng nhập bằng email công ty.', en: 'On mobile: install the “Microsoft Outlook” app and sign in with your company email.' },
        ],
      },
      {
        kind: 'callout',
        tone: 'info',
        text: {
          vi: 'Không có máy công ty bên cạnh? Bạn vẫn mở được email bằng trình duyệt web trên bất kỳ máy nào — xem đường dẫn ở trang Công cụ.',
          en: 'Access email from any browser via Outlook Web — see the link on the Tools page.',
        },
      },
      {
        kind: 'bullets',
        items: [
          { vi: 'Bật thông báo để không bỏ lỡ email quan trọng.', en: 'Enable notifications so you never miss important email.' },
          { vi: 'Gõ tên đồng nghiệp vào ô người nhận — Outlook tự gợi ý địa chỉ email nội bộ.', en: 'Start typing a colleague’s name — internal addresses auto-suggest.' },
        ],
      },
    ],
  },

  /* ---------------------------------------------------------------- phone --- */
  {
    id: 'phone',
    icon: 'phone',
    eyebrow: { vi: 'Liên lạc', en: 'Communication' },
    title: { vi: 'Điện thoại nội bộ', en: 'Desk Phone & Extensions' },
    intro: {
      vi: 'Mỗi chỗ ngồi có một số máy nhánh riêng — gọi nội bộ chỉ cần bấm vài chữ số thay vì cả số điện thoại.',
      en: 'Each desk has its own short extension number, so internal calls need just a few digits.',
    },
    readMin: 2,
    blocks: [
      {
        kind: 'bullets',
        items: [
          { vi: 'Gọi nội bộ: bấm số máy nhánh của người cần gặp (ví dụ 1234).', en: 'Internal call: dial the person’s extension (e.g. 1234).' },
          { vi: 'Gọi ra ngoài: bấm trực tiếp số cần gọi — không cần đầu số.', en: 'External call: just dial the number directly — no prefix needed.' },
        ],
      },
      {
        kind: 'callout',
        tone: 'tip',
        text: {
          vi: 'Xem toàn bộ số máy nhánh của các phòng ban trong mục Danh bạ.',
          en: 'Find every department extension in the Directory.',
        },
      },
    ],
  },

  /* ----------------------------------------------------------------- wifi --- */
  {
    id: 'wifi',
    icon: 'wifi',
    eyebrow: { vi: 'Kết nối', en: 'Connectivity' },
    title: { vi: 'Kết nối Wi-Fi', en: 'Connect to Wi-Fi' },
    intro: {
      vi: 'Có mạng riêng cho nhân viên và mạng cho khách. Dùng đúng mạng để đảm bảo bảo mật.',
      en: 'There is a staff network and a guest network. Use the right one for security.',
    },
    readMin: 2,
    blocks: [
      {
        kind: 'fields',
        title: { vi: 'Thông tin Wi-Fi', en: 'Wi-Fi details' },
        items: [
          { label: { vi: 'Tên mạng Wi-Fi nhân viên', en: 'Staff Wi-Fi network name' }, value: 'An Viet Phat', copy: true },
          { label: { vi: 'Tên mạng Wi-Fi khách', en: 'Guest Wi-Fi network name' }, value: 'An Viet Phat - Customer', copy: true },
          { label: { vi: 'Mật khẩu Wi-Fi khách', en: 'Guest Wi-Fi password' }, value: 'anvietphat', copy: true },
        ],
      },
      {
        kind: 'steps',
        items: [
          { vi: 'Nhân viên: chọn mạng “An Viet Phat”, rồi đăng nhập bằng chính tài khoản công ty của bạn — giống hệt lúc đăng nhập máy tính.', en: 'Staff: choose “An Viet Phat”, then sign in with your company account — exactly the one you use for your computer.' },
          { vi: 'Khách: chọn mạng “An Viet Phat - Customer”, nhập mật khẩu: anvietphat.', en: 'Guests: choose “An Viet Phat - Customer” and enter the password: anvietphat.' },
          { vi: 'Không kết nối được? Gửi yêu cầu hỗ trợ IT.', en: 'Can’t connect? Open an IT support ticket.' },
        ],
      },
      {
        kind: 'callout',
        tone: 'warning',
        text: {
          vi: 'Không đưa tài khoản Wi-Fi nhân viên cho khách. Hãy hướng khách dùng mạng “An Viet Phat - Customer”.',
          en: 'Don’t give your staff Wi-Fi account to visitors. Point guests to “An Viet Phat - Customer”.',
        },
      },
    ],
  },

  /* ---------------------------------------------------------------- workit -- */
  {
    id: 'workit',
    icon: 'briefcase',
    eyebrow: { vi: 'Hệ thống nội bộ', en: 'Internal system' },
    title: { vi: 'Sử dụng WorkIT', en: 'Using WorkIT' },
    intro: {
      vi: 'WorkIT là phần mềm văn phòng số nội bộ để gửi đề nghị, phê duyệt và đặt phòng họp.',
      en: 'WorkIT is the internal digital-office software for submitting requests, approvals and booking meeting rooms.',
    },
    readMin: 4,
    blocks: [
      {
        kind: 'fields',
        items: [
          { label: { vi: 'Địa chỉ WorkIT', en: 'WorkIT URL' }, value: 'https://anvietphatgroup.vn/' },
        ],
      },
      {
        kind: 'p',
        text: {
          vi: 'Ví dụ phổ biến nhất cho người mới: đặt phòng họp. Các bước như sau:',
          en: 'The most common task for newcomers is booking a meeting room. Here is how:',
        },
      },
      {
        kind: 'steps',
        items: [
          { vi: 'Đăng nhập WorkIT bằng tài khoản công ty.', en: 'Log in to WorkIT with your company account.' },
          { vi: 'Chọn “Đặt phòng họp” → chọn phòng, ngày và khung giờ.', en: 'Choose “Book meeting room” → pick a room, date and time.' },
          { vi: 'Nhập nội dung cuộc họp & danh sách người tham dự.', en: 'Enter the meeting topic & attendees.' },
          { vi: 'Gửi và chờ xác nhận — kiểm tra lịch Outlook của bạn.', en: 'Submit and wait for confirmation — check your Outlook calendar.' },
        ],
      },
      {
        kind: 'callout',
        tone: 'info',
        text: {
          vi: 'WorkIT còn dùng để gửi đề nghị mua sắm, nghỉ phép, công tác… Khám phá dần trong tuần đầu.',
          en: 'WorkIT is also used for purchase requests, leave, business trips and more. Explore it during your first week.',
        },
      },
    ],
  },

  /* -------------------------------------------------------------- software -- */
  {
    id: 'software',
    icon: 'download',
    eyebrow: { vi: 'Thiết bị', en: 'Devices' },
    title: { vi: 'Phần mềm & Thiết bị', en: 'Software & Devices' },
    intro: {
      vi: 'Cài đúng phần mềm cần thiết và kết nối máy in để sẵn sàng làm việc.',
      en: 'Install the right software and connect to a printer to be work-ready.',
    },
    readMin: 3,
    blocks: [
      {
        kind: 'bullets',
        items: [
          { vi: 'Bộ Office (Outlook, Word, Excel, PowerPoint).', en: 'Office suite (Outlook, Word, Excel, PowerPoint).' },
          { vi: 'Ứng dụng chat nội bộ (AVP Portal / Telegram).', en: 'Internal chat app (AVP Portal / Telegram).' },
          { vi: 'SAP — phần mềm quản trị của công ty (nếu công việc của bạn cần).', en: 'SAP GUI (if your role needs it).' },
          { vi: 'Phần mềm diệt virus và phần mềm kết nối từ xa (VPN) — IT cài sẵn, bạn không phải làm gì.', en: 'Antivirus and remote-access software (VPN) — IT sets these up for you.' },
        ],
      },
      {
        kind: 'callout',
        tone: 'danger',
        title: { vi: 'Quy định cài đặt phần mềm', en: 'Software install policy' },
        text: {
          vi: 'Chỉ cài phần mềm có bản quyền và được IT phê duyệt. Đừng tự tải phần mềm bẻ khoá hay tải từ nguồn không rõ — gửi yêu cầu để IT cài giúp.',
          en: 'Only install licensed, IT-approved software. Never download pirated apps — open a request and IT will install it for you.',
        },
      },
      {
        kind: 'steps',
        items: [
          { vi: 'Kết nối máy in: chọn máy in theo tầng/khu vực do IT cung cấp.', en: 'Connect a printer: select the floor/area printer provided by IT.' },
          { vi: 'In thử một trang để kiểm tra.', en: 'Print a test page to confirm.' },
          { vi: 'Cần phần mềm khác? Gửi yêu cầu hỗ trợ IT.', en: 'Need other software? Open an IT support ticket.' },
        ],
      },
    ],
  },

  /* -------------------------------------------------------------- security -- */
  {
    id: 'security',
    icon: 'shield-check',
    eyebrow: { vi: 'An toàn thông tin', en: 'Information security' },
    title: { vi: 'Bảo mật thông tin', en: 'Information Security' },
    intro: {
      vi: 'Vài thói quen nhỏ giúp bảo vệ bạn và công ty khỏi rủi ro an ninh mạng.',
      en: 'A few small habits protect you and the company from cyber risks.',
    },
    readMin: 3,
    blocks: [
      {
        kind: 'callout',
        tone: 'tip',
        title: { vi: '🔒 Khoá màn hình: Windows + L', en: '🔒 Lock your screen: Windows + L' },
        text: {
          vi: 'Mỗi khi rời chỗ ngồi — kể cả chỉ đi vài phút — hãy bấm cùng lúc phím Windows (phím có hình cửa sổ) và phím L. Thói quen nhỏ, an toàn lớn.',
          en: 'Press Windows + L whenever you step away — even for a few minutes. A small habit, big protection.',
        },
      },
      {
        kind: 'bullets',
        items: [
          { vi: 'USB ở chế độ CHỈ ĐỌC: đọc dữ liệu từ USB thì được, nhưng KHÔNG được sao chép dữ liệu RA USB (để bảo vệ dữ liệu công ty).', en: 'USB is READ-ONLY: you can read from a USB drive, but you CANNOT copy data ONTO USB (to protect company data).' },
          { vi: 'Cảnh giác email lạ, đường dẫn và tệp đính kèm đáng ngờ — đây là cách phổ biến nhất để kẻ xấu chiếm tài khoản của bạn.', en: 'Beware of unknown emails, suspicious links and attachments — this is the most common way attackers take over accounts.' },
          { vi: 'Không cắm USB/thiết bị lạ vào máy công ty.', en: 'Do not plug unknown USB drives/devices into company computers.' },
          { vi: 'Lưu tài liệu công việc lên ổ đĩa chung của công ty, đừng để riêng trên máy mình — máy hỏng là mất hết.', en: 'Store work files on company drives/systems, not just on your machine.' },
        ],
      },
      {
        kind: 'callout',
        tone: 'danger',
        title: { vi: 'Nghi ngờ bị tấn công?', en: 'Think you were targeted?' },
        text: {
          vi: 'Nếu bạn lỡ bấm vào link lạ hoặc nghi ngờ tài khoản bị lộ, báo ngay cho IT — càng sớm càng tốt.',
          en: 'If you clicked a suspicious link or suspect your account is compromised, report to IT immediately — the sooner the better.',
        },
      },
    ],
  },
];

/* ============================================================================
 *  NHÂN SỰ — nội dung do phòng Nhân sự gửi, IT cập nhật vào đây.
 * ========================================================================== */

export const HR_INTRO: L = {
  vi: 'Những việc về hồ sơ, hợp đồng, chấm công và phúc lợi bạn cần nắm trong tuần đầu.',
  en: 'Paperwork, contract, timekeeping and benefits you need to know in your first week.',
};

/** CHƯA CÓ NỘI DUNG — chờ phòng Nhân sự gửi. Trang tự hiện trạng thái
 *  "đang cập nhật" khi mảng này rỗng, không vỡ bố cục. */
export const HR_SECTIONS: GuideSection[] = [];

/* ============================================================================
 *  DANH SÁCH PHÒNG BAN
 * ========================================================================== */

export interface PhongBan {
  /** Đoạn đường dẫn: /onboarding/<slug>. KHÔNG được trùng RESERVED. */
  slug: string;
  icon: string;
  name: L;
  /** Một dòng mô tả trên thẻ ở trang trung tâm. */
  tagline: L;
  /** Module + khoá trong bảng `content` — xem ghi chú đầu file. */
  module: string;
  introKey: string;
  sectionsKey: string;
  intro: L;
  sections: GuideSection[];
  /** Bài kiểm tra sau buổi hội nhập của RIÊNG phòng này.
   *
   *  Đặt ở đây chứ không phải trang trung tâm: bài kiểm tra gắn với nội dung
   *  vừa đọc, nên nó phải nằm ngay dưới nội dung đó. Phòng nào chưa có bài thì
   *  bỏ trống, trang tự không hiện thẻ — hiện một thẻ dẫn tới bài của phòng
   *  khác còn tệ hơn là không có gì. */
  quiz?: { path: string; title: L; desc: L };

  /** Có phải ký cam kết bảo mật sau khi đọc xong phần này không.
   *
   *  Chỉ IT bật: mọi nhân viên mới đều đi qua phần hội nhập của IT (tài khoản,
   *  email, Wi-Fi) bất kể họ thuộc phòng nào, nên đó là chỗ duy nhất chắc chắn
   *  ai cũng thấy. */
  camKet?: boolean;

  /** Danh sách việc cần làm của RIÊNG phòng này — hiện ngay trên trang phòng.
   *  Việc cần làm thuộc về phòng đặt ra nó, không phải thứ chung của cả hành
   *  trình: 8 mục hiện có đều là việc của IT (kích hoạt tài khoản, Wi-Fi,
   *  WorkIT…), để ở trang trung tâm là bắt Nhân sự phải nhìn việc của IT.
   *  Phòng nào chưa có thì bỏ trống, trang tự không hiện khối này. */
  checklist?: ChecklistItem[];
  checklistKey?: string;
}

/** Đường dẫn con của /onboarding đã có chủ — không phòng nào được chiếm.
 *  Thiếu danh sách này thì một phòng đặt slug `kiem-tra` sẽ nuốt mất trang
 *  bài kiểm tra, và Angular không báo gì cả. */
export const RESERVED = ['kiem-tra', 'cam-ket'] as const;

export const PHONG_BAN: PhongBan[] = [
  {
    slug: 'it',
    icon: 'monitor',
    name: { vi: 'Công nghệ thông tin', en: 'Information Technology' },
    tagline: { vi: 'Tài khoản, email, Wi-Fi, máy tính, phần mềm', en: 'Account, email, Wi-Fi, computer, software' },
    module: 'onboarding',
    introKey: 'ONBOARDING_INTRO',
    sectionsKey: 'SECTIONS',
    intro: ONBOARDING_INTRO,
    sections: SECTIONS,
    checklist: CHECKLIST,
    checklistKey: 'CHECKLIST',
    quiz: {
      path: '/onboarding/kiem-tra',
      title: { vi: 'Kiểm tra lại xem bạn nhớ được bao nhiêu', en: 'Check how much you remember' },
      desc: {
        vi: '10 câu trắc nghiệm, khoảng 5 phút. Làm sau khi phòng IT đã hướng dẫn bạn.',
        en: '10 questions, about 5 minutes. Take it after your IT induction session.',
      },
    },
    camKet: true,
  },
  {
    slug: 'nhan-su',
    icon: 'users',
    name: { vi: 'Nhân sự', en: 'Human Resources' },
    tagline: { vi: 'Hồ sơ, hợp đồng, chấm công, phúc lợi', en: 'Paperwork, contract, timekeeping, benefits' },
    module: 'onboarding_hr',
    introKey: 'INTRO',
    sectionsKey: 'SECTIONS',
    intro: HR_INTRO,
    sections: HR_SECTIONS,
  },
];
