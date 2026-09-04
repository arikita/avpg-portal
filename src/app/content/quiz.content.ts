/* ============================================================================
 *  QUIZ CONTENT — ngân hàng câu hỏi cho bài kiểm tra sau buổi hội nhập IT.
 *
 *  MỤC ĐÍCH: sau khi phòng IT training nhân viên mới, đây là cách biết họ có
 *  thật sự nắm được hay không — thay vì tin vào việc "đã ngồi nghe".
 *
 *  50 CÂU TRONG KHO, MỖI LƯỢT BỐC 10 (28/08/2026). Trước đó là 10 câu cố định
 *  chỉ trộn thứ tự — hai người ngồi cạnh nhau vẫn nhận đúng một đề, nên chép
 *  được. Kho 50 câu làm việc chép trở nên vô nghĩa: hai lượt bất kỳ trung bình
 *  chỉ trùng 2 câu.
 *
 *  Bốc theo CHỦ ĐỀ chứ không bốc bừa: mỗi lượt lấy 1 câu từ mỗi chủ đề (9 chủ
 *  đề) rồi bốc thêm 1 câu nữa cho đủ 10. Bốc bừa thì có lượt hỏi 4 câu về mật
 *  khẩu mà không hỏi câu nào về USB — mà USB là thứ ai cũng phải biết. Xem
 *  `bocDe()` trong `features/onboarding/quiz.ts`.
 *
 *  ⚠ FILE NÀY KHÔNG CHỨA ĐÁP ÁN, VÀ ĐỪNG BAO GIỜ THÊM VÀO.
 *  Mọi thứ trong này đi thẳng vào bundle JavaScript mà trình duyệt tải về —
 *  ai mở DevTools cũng đọc được. Đáp án nằm ở `ANSWERS` trong
 *  `server/app/quiz.py` và việc chấm điểm chạy Ở SERVER. Client chỉ gửi lên
 *  danh sách 10 câu đã bốc + các `optionId` đã chọn.
 *
 *  `server/tests/test_quiz.py` đọc chính file này rồi đối chiếu với server:
 *  thêm/xoá/đổi tên một câu hoặc một lựa chọn ở đây mà quên sửa bên kia là
 *  test đỏ ngay, không phải đợi tới lúc có người làm bài mới lộ.
 * ========================================================================== */
import { L } from '../core/models/content.models';

/** Chủ đề dùng để bốc đề CÂN — xem ghi chú đầu file. */
export type QuizTopic =
  | 'tai-khoan'
  | 'email'
  | 'mang'
  | 'thiet-bi'
  | 'phan-mem'
  | 'bao-mat'
  | 'du-lieu'
  | 'ho-tro'
  | 'quy-dinh';

/** Nhãn chủ đề — dùng ở bảng thống kê trong /admin/quiz. */
export const QUIZ_TOPICS: { id: QuizTopic; label: L }[] = [
  { id: 'tai-khoan', label: { vi: 'Tài khoản & mật khẩu', en: 'Accounts & passwords' } },
  { id: 'email', label: { vi: 'Email', en: 'Email' } },
  { id: 'mang', label: { vi: 'Mạng & điện thoại', en: 'Network & phone' } },
  { id: 'thiet-bi', label: { vi: 'Thiết bị', en: 'Devices' } },
  { id: 'phan-mem', label: { vi: 'Phần mềm', en: 'Software' } },
  { id: 'bao-mat', label: { vi: 'Bảo mật', en: 'Security' } },
  { id: 'du-lieu', label: { vi: 'Dữ liệu', en: 'Data' } },
  { id: 'ho-tro', label: { vi: 'Hỗ trợ IT', en: 'IT support' } },
  { id: 'quy-dinh', label: { vi: 'Quy định chung', en: 'General rules' } },
];

export interface QuizOption {
  /** Định danh ỔN ĐỊNH — thứ được gửi lên server để chấm. Đổi chuỗi này là
   *  đổi luôn ý nghĩa của mọi bài đã làm trước đó, nên đừng đổi. */
  id: string;
  text: L;
}

export interface QuizQuestion {
  id: string;
  topic: QuizTopic;
  q: L;
  options: QuizOption[];
  /** Trả lời sai thì chỉ thẳng chỗ đọc lại — một bài test không nói cho người
   *  ta biết phải học lại ở đâu thì chỉ là một cái sàng lọc. */
  ref: { path: string; frag: string; label: L };
}

/** Số câu mỗi lượt làm. */
export const QUIZ_DRAW = 10;

/** Số câu đúng tối thiểu để đạt. Server là nguồn chân lý (`PASS` trong
 *  quiz.py); ở đây chỉ để hiện trước khi làm. Test khoá hai giá trị bằng nhau. */
export const QUIZ_PASS = 8;

export const QUIZ_INTRO: L = {
  vi: 'Bài kiểm tra ngắn sau buổi hội nhập IT: 10 câu bốc ngẫu nhiên từ ngân hàng 50 câu, khoảng 5 phút. Đúng từ 8/10 là đạt. Làm lại được nếu chưa đạt — mục tiêu là bạn nhớ, không phải để loại ai.',
  en: 'A short check after your IT induction: 10 questions drawn at random from a bank of 50, about 5 minutes. 8 out of 10 to pass. You can retake it — the goal is for you to remember, not to fail anyone.',
};

/** Đường dẫn đọc lại, gom sẵn để 50 câu khỏi lặp chữ. */
const R = {
  account: { path: '/onboarding', frag: 'account', label: { vi: 'Hội nhập → Tài khoản & Email', en: 'Onboarding → Account & Email' } },
  outlook: { path: '/onboarding', frag: 'outlook', label: { vi: 'Hội nhập → Sử dụng Outlook', en: 'Onboarding → Using Outlook' } },
  phone: { path: '/onboarding', frag: 'phone', label: { vi: 'Hội nhập → Điện thoại nội bộ', en: 'Onboarding → Desk Phone' } },
  wifi: { path: '/onboarding', frag: 'wifi', label: { vi: 'Hội nhập → Kết nối Wi-Fi', en: 'Onboarding → Connect to Wi-Fi' } },
  workit: { path: '/onboarding', frag: 'workit', label: { vi: 'Hội nhập → Sử dụng WorkIT', en: 'Onboarding → Using WorkIT' } },
  onbSoftware: { path: '/onboarding', frag: 'software', label: { vi: 'Hội nhập → Phần mềm & Thiết bị', en: 'Onboarding → Software & Devices' } },
  onbSecurity: { path: '/onboarding', frag: 'security', label: { vi: 'Hội nhập → Bảo mật thông tin', en: 'Onboarding → Information Security' } },
  regPersonal: { path: '/regulations', frag: 'personal-use', label: { vi: 'Quy định IT → Sử dụng cá nhân', en: 'IT Regulations → Personal use' } },
  regHardware: { path: '/regulations', frag: 'hardware', label: { vi: 'Quy định IT → Phần cứng', en: 'IT Regulations → Hardware' } },
  regSoftware: { path: '/regulations', frag: 'software', label: { vi: 'Quy định IT → Phần mềm', en: 'IT Regulations → Software' } },
  regData: { path: '/regulations', frag: 'data-ownership', label: { vi: 'Quy định IT → Quyền sở hữu dữ liệu', en: 'IT Regulations → Data ownership' } },
  regSecurity: { path: '/regulations', frag: 'security', label: { vi: 'Quy định IT → An ninh & bảo mật', en: 'IT Regulations → Security' } },
  regCrypto: { path: '/regulations', frag: 'encryption', label: { vi: 'Quy định IT → Mã hoá', en: 'IT Regulations → Encryption' } },
  regPass: { path: '/regulations', frag: 'passwords', label: { vi: 'Quy định IT → Tài khoản & mật khẩu', en: 'IT Regulations → Accounts & passwords' } },
  regBackup: { path: '/regulations', frag: 'backup', label: { vi: 'Quy định IT → Sao lưu & khôi phục', en: 'IT Regulations → Backup & recovery' } },
  regNet: { path: '/regulations', frag: 'internet-email', label: { vi: 'Quy định IT → Internet & Email', en: 'IT Regulations → Internet & email' } },
  regViolation: { path: '/regulations', frag: 'violations', label: { vi: 'Quy định IT → Xử lý vi phạm', en: 'IT Regulations → Handling violations' } },
  helpHow: { path: '/help', frag: 'how', label: { vi: 'Hỗ trợ → Gửi email yêu cầu', en: 'Support → Send a request email' } },
  helpInfo: { path: '/help', frag: 'info', label: { vi: 'Hỗ trợ → Thông tin nên cung cấp', en: 'Support → What to include' } },
  helpSla: { path: '/help', frag: 'sla', label: { vi: 'Hỗ trợ → Thời gian phản hồi', en: 'Support → Response times' } },
};

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  /* ============================================== TÀI KHOẢN & MẬT KHẨU (7) */
  {
    id: 'mot-mat-khau',
    topic: 'tai-khoan',
    q: {
      vi: 'Bạn vừa đổi mật khẩu đăng nhập máy tính. Điều gì xảy ra với email Outlook của bạn?',
      en: 'You have just changed your Windows login password. What happens to your Outlook email?',
    },
    options: [
      { id: 'doi-theo', text: { vi: 'Đổi theo luôn — máy tính và email dùng chung một tài khoản', en: 'It changes too — your computer and email share one account' } },
      { id: 'khong-lien-quan', text: { vi: 'Không liên quan — email có mật khẩu riêng', en: 'Unaffected — email has its own separate password' } },
      { id: 'bao-it-doi', text: { vi: 'Phải báo IT đổi giúp mật khẩu email', en: 'You must ask IT to change the email password for you' } },
      { id: 'cai-lai-outlook', text: { vi: 'Phải gỡ và cài lại Outlook', en: 'You must uninstall and reinstall Outlook' } },
    ],
    ref: R.account,
  },
  {
    id: 'muon-tai-khoan',
    topic: 'tai-khoan',
    q: {
      vi: 'Đồng nghiệp đang đi công tác nhắn nhờ bạn cho mượn tài khoản để lấy gấp một tệp. Bạn làm gì?',
      en: 'A colleague on a business trip asks to borrow your account to grab an urgent file. What do you do?',
    },
    options: [
      { id: 'cho-muon', text: { vi: 'Cho mượn, vì là đồng nghiệp cùng phòng', en: 'Lend it — they are on your own team' } },
      { id: 'cho-muon-doi-mk', text: { vi: 'Cho mượn rồi đổi mật khẩu sau khi họ dùng xong', en: 'Lend it, then change your password afterwards' } },
      { id: 'tu-choi', text: { vi: 'Từ chối — không cho ai mượn tài khoản/mật khẩu; nhờ IT hoặc người giữ dữ liệu cấp quyền đúng cách', en: 'Refuse — never share an account or password; ask IT or the data owner to grant proper access' } },
      { id: 'ghi-giay', text: { vi: 'Ghi mật khẩu ra giấy để lại trên bàn cho họ', en: 'Write the password on a note and leave it on the desk for them' } },
    ],
    ref: R.regPass,
  },
  {
    id: 'ten-tai-khoan',
    topic: 'tai-khoan',
    q: {
      vi: 'Theo quy tắc đặt tên của công ty, nhân viên tên “Trần Văn An” sẽ có tài khoản đăng nhập là gì?',
      en: 'Under the company naming rule, what login username does an employee named “Trần Văn An” get?',
    },
    options: [
      { id: 'antv', text: { vi: 'antv', en: 'antv' } },
      { id: 'tvan', text: { vi: 'tvan', en: 'tvan' } },
      { id: 'trananvan', text: { vi: 'trananvan', en: 'trananvan' } },
      { id: 'anvt', text: { vi: 'anvt', en: 'anvt' } },
    ],
    ref: R.account,
  },
  {
    id: 'mat-khau-manh',
    topic: 'tai-khoan',
    q: {
      vi: 'Mật khẩu nào dưới đây đáp ứng yêu cầu của công ty?',
      en: 'Which of these passwords meets the company requirement?',
    },
    options: [
      { id: 'avp-manh', text: { vi: 'Avp@2026#Kt', en: 'Avp@2026#Kt' } },
      { id: 'anviet2026', text: { vi: 'anviet2026', en: 'anviet2026' } },
      { id: 'so-lien', text: { vi: '12345678', en: '12345678' } },
      { id: 'ten-minh', text: { vi: 'tranvanan', en: 'tranvanan' } },
    ],
    ref: R.account,
  },
  {
    id: 'doi-mat-khau-lan-dau',
    topic: 'tai-khoan',
    q: {
      vi: 'Đăng nhập máy tính lần đầu bằng mật khẩu tạm IT cấp, bạn đặt mật khẩu riêng bằng cách nào?',
      en: 'After first logging in with the temporary password from IT, how do you set your own password?',
    },
    options: [
      { id: 'ctrl-alt-del', text: { vi: 'Nhấn Ctrl + Alt + Del → “Change a password”', en: 'Press Ctrl + Alt + Del → “Change a password”' } },
      { id: 'trong-outlook', text: { vi: 'Vào phần cài đặt trong Outlook để đổi', en: 'Change it in Outlook settings' } },
      { id: 'nho-it-doi', text: { vi: 'Gửi ticket nhờ IT đặt hộ mật khẩu mới', en: 'Open a ticket and ask IT to set a new one for you' } },
      { id: 'khong-can-doi', text: { vi: 'Không cần đổi, dùng luôn mật khẩu tạm', en: 'No need — keep using the temporary password' } },
    ],
    ref: R.account,
  },
  {
    id: 'ghi-mat-khau',
    topic: 'tai-khoan',
    q: {
      vi: 'Cách giữ mật khẩu nào dưới đây VI PHẠM quy định?',
      en: 'Which way of keeping your password BREAKS the rules?',
    },
    options: [
      { id: 'dan-man-hinh', text: { vi: 'Ghi ra giấy dán cạnh màn hình cho khỏi quên', en: 'Write it on a note stuck to your monitor so you do not forget' } },
      { id: 'tu-nho', text: { vi: 'Tự nhớ, không ghi ra đâu cả', en: 'Memorise it and write it nowhere' } },
      { id: 'doi-dinh-ky', text: { vi: 'Đổi mật khẩu định kỳ theo hướng dẫn của IT', en: 'Change it periodically as IT instructs' } },
      { id: 'khong-cho-muon', text: { vi: 'Không cho ai mượn, kể cả quản lý trực tiếp', en: 'Never lend it to anyone, including your line manager' } },
    ],
    ref: R.regPass,
  },
  {
    id: 'dung-tai-khoan-nguoi-khac',
    topic: 'tai-khoan',
    q: {
      vi: 'Máy của bạn đang lỗi, đồng nghiệp đã đăng nhập sẵn máy bên cạnh và bảo bạn cứ dùng. Đúng hay sai?',
      en: 'Your PC is broken; a colleague is already logged in on the next machine and tells you to just use it. Right or wrong?',
    },
    options: [
      { id: 'khong-duoc', text: { vi: 'Không được — không dùng tài khoản của người khác để đăng nhập/làm việc', en: 'Wrong — never work under someone else’s account' } },
      { id: 'duoc-neu-gap', text: { vi: 'Được, nếu công việc đang gấp', en: 'Fine, if the work is urgent' } },
      { id: 'duoc-neu-cung-phong', text: { vi: 'Được, miễn là cùng phòng ban', en: 'Fine, as long as you are in the same department' } },
      { id: 'duoc-neu-bao-sau', text: { vi: 'Được, chỉ cần báo IT lại sau', en: 'Fine, just tell IT afterwards' } },
    ],
    ref: R.regSecurity,
  },

  /* ================================================================ EMAIL (5) */
  {
    id: 'dung-luong-dinh-kem',
    topic: 'email',
    q: {
      vi: 'Tệp đính kèm trong email công ty được phép tối đa bao nhiêu, nếu lớn hơn thì phải làm gì?',
      en: 'What is the maximum size for a company email attachment, and what if the file is bigger?',
    },
    options: [
      { id: '20mb', text: { vi: 'Tối đa 20 MB; lớn hơn phải được IT cho phép', en: 'Max 20 MB; anything larger needs IT approval' } },
      { id: '5mb', text: { vi: 'Tối đa 5 MB; lớn hơn thì chia nhỏ ra gửi nhiều lần', en: 'Max 5 MB; split larger files across several emails' } },
      { id: '100mb', text: { vi: 'Tối đa 100 MB, không cần hỏi ai', en: 'Max 100 MB, no approval needed' } },
      { id: 'khong-gioi-han', text: { vi: 'Không giới hạn, gửi được là được', en: 'No limit — if it sends, it is fine' } },
    ],
    ref: R.regSecurity,
  },
  {
    id: 'email-cong-cong',
    topic: 'email',
    q: {
      vi: 'Email công ty đang chậm, bạn có được dùng Gmail cá nhân để gửi tài liệu cho khách hàng không?',
      en: 'Company email is slow — may you use your personal Gmail to send documents to a customer?',
    },
    options: [
      { id: 'khong-duoc', text: { vi: 'Không — quy định cấm dùng email công cộng (Gmail, Yahoo…) để trao đổi thông tin công việc', en: 'No — using public email (Gmail, Yahoo…) for work information is prohibited' } },
      { id: 'duoc-neu-gap', text: { vi: 'Được, nếu việc gấp và khách đang chờ', en: 'Yes, if it is urgent and the customer is waiting' } },
      { id: 'duoc-neu-cc', text: { vi: 'Được, miễn là CC lại vào email công ty', en: 'Yes, as long as you CC your company address' } },
      { id: 'duoc-neu-khong-mat', text: { vi: 'Được, nếu tài liệu không thuộc loại mật', en: 'Yes, if the document is not confidential' } },
    ],
    ref: R.regSecurity,
  },
  {
    id: 'email-nac-danh',
    topic: 'email',
    q: {
      vi: 'Việc nào sau đây bị CẤM khi dùng email công ty?',
      en: 'Which of the following is PROHIBITED when using company email?',
    },
    options: [
      { id: 'gia-mao', text: { vi: 'Gửi email nặc danh hoặc giả mạo địa chỉ người gửi', en: 'Sending anonymous email or spoofing the sender address' } },
      { id: 'gui-noi-bo', text: { vi: 'Gửi email cho đồng nghiệp phòng khác', en: 'Emailing a colleague in another department' } },
      { id: 'dat-chu-ky', text: { vi: 'Đặt chữ ký email theo mẫu công ty', en: 'Setting the standard company signature' } },
      { id: 'gui-loi-moi-hop', text: { vi: 'Gửi lời mời họp qua Lịch Outlook', en: 'Sending a meeting invite via Outlook Calendar' } },
    ],
    ref: R.regSecurity,
  },
  {
    id: 'chuyen-tiep-tai-lieu',
    topic: 'email',
    q: {
      vi: 'Bạn nhận được một tài liệu nội bộ hữu ích và muốn chuyển tiếp cho một người bạn ở công ty khác. Được không?',
      en: 'You receive a useful internal document and want to forward it to a friend at another company. May you?',
    },
    options: [
      { id: 'khong-duoc', text: { vi: 'Không — không sao chép, sửa hay chuyển tiếp tài liệu khi chưa được chủ sở hữu cho phép', en: 'No — never copy, edit or forward a document without the owner’s permission' } },
      { id: 'duoc-neu-xoa-logo', text: { vi: 'Được, nếu xoá logo và tên công ty đi', en: 'Yes, if you remove the logo and company name' } },
      { id: 'duoc-neu-khong-mat', text: { vi: 'Được, nếu tài liệu không đóng dấu “Mật”', en: 'Yes, if the document is not stamped “Confidential”' } },
      { id: 'duoc-neu-ban-than', text: { vi: 'Được, vì đó là bạn thân của bạn', en: 'Yes, because they are a close friend' } },
    ],
    ref: R.regSecurity,
  },
  {
    id: 'chu-ky-email',
    topic: 'email',
    q: {
      vi: 'Bạn muốn cài chữ ký email đúng chuẩn công ty. Lấy mẫu ở đâu?',
      en: 'You want to set up the standard company email signature. Where do you get the template?',
    },
    options: [
      { id: 'trang-cong-cu', text: { vi: 'Tải mẫu ở trang Công cụ, mục Tải về, rồi dán vào phần Chữ ký trong Outlook', en: 'Download it from the Tools page → Downloads, then paste it into Outlook’s Signature settings' } },
      { id: 'tu-soan', text: { vi: 'Tự soạn theo ý mình cho khác biệt', en: 'Write your own so it stands out' } },
      { id: 'chep-cua-sep', text: { vi: 'Chép lại chữ ký của sếp và sửa tên', en: 'Copy your manager’s signature and change the name' } },
      { id: 'khong-can', text: { vi: 'Không cần chữ ký, email nội bộ ai cũng biết nhau', en: 'No signature needed — everyone knows each other internally' } },
    ],
    ref: R.outlook,
  },

  /* ==================================================== MẠNG & ĐIỆN THOẠI (4) */
  {
    id: 'wifi-khach',
    topic: 'mang',
    q: {
      vi: 'Một khách hàng đến họp và xin Wi-Fi. Bạn đưa gì cho họ?',
      en: 'A customer visiting for a meeting asks for Wi-Fi. What do you give them?',
    },
    options: [
      { id: 'wifi-khach', text: { vi: 'Mạng Wi-Fi dành cho khách, kèm mật khẩu Wi-Fi khách', en: 'The guest Wi-Fi network and its guest password' } },
      { id: 'wifi-nhan-vien', text: { vi: 'Tài khoản Wi-Fi nhân viên của bạn', en: 'Your own staff Wi-Fi account' } },
      { id: 'tao-tk-moi', text: { vi: 'Nhờ IT tạo cho khách một tài khoản trong hệ thống', en: 'Ask IT to create a domain account for the visitor' } },
      { id: 'phat-4g', text: { vi: 'Phát 4G từ điện thoại cá nhân của bạn', en: 'Share 4G from your personal phone' } },
    ],
    ref: R.wifi,
  },
  {
    id: 'wifi-nhan-vien-dang-nhap',
    topic: 'mang',
    q: {
      vi: 'Kết nối Wi-Fi nhân viên thì đăng nhập bằng gì?',
      en: 'What do you sign in with to join the staff Wi-Fi?',
    },
    options: [
      { id: 'tai-khoan-ad', text: { vi: 'Tài khoản công ty, giống hệt tài khoản đăng nhập máy tính', en: 'Your company account — the same one you use to log in to your PC' } },
      { id: 'mat-khau-chung', text: { vi: 'Một mật khẩu chung mà cả công ty dùng', en: 'A single shared password used by everyone' } },
      { id: 'so-dien-thoai', text: { vi: 'Số điện thoại cá nhân của bạn', en: 'Your personal phone number' } },
      { id: 'khong-can', text: { vi: 'Không cần gì, mạng nhân viên để mở', en: 'Nothing — the staff network is open' } },
    ],
    ref: R.wifi,
  },
  {
    id: 'so-may-nhanh',
    topic: 'mang',
    q: {
      vi: 'Bạn cần gọi tới quầy lễ tân / tổng đài từ điện thoại bàn. Bấm số nào?',
      en: 'You need to call reception / the switchboard from your desk phone. What do you dial?',
    },
    options: [
      { id: 'bam-0', text: { vi: 'Bấm 0', en: 'Dial 0' } },
      { id: 'bam-9', text: { vi: 'Bấm 9 rồi chờ tín hiệu', en: 'Dial 9 and wait for a tone' } },
      { id: 'bam-100', text: { vi: 'Bấm 100', en: 'Dial 100' } },
      { id: 'goi-di-dong', text: { vi: 'Phải gọi bằng điện thoại di động', en: 'You must use a mobile phone' } },
    ],
    ref: R.phone,
  },
  {
    id: 'pha-hoai-mang',
    topic: 'mang',
    q: {
      vi: 'Hành vi nào sau đây bị quy định IT cấm?',
      en: 'Which of these does the IT policy prohibit?',
    },
    options: [
      { id: 'thay-doi-mang', text: { vi: 'Tự ý thay đổi, vô hiệu hoá hoặc gây gián đoạn hệ thống mạng công ty', en: 'Altering, disabling or disrupting the company network on your own' } },
      { id: 'bao-mang-cham', text: { vi: 'Báo IT khi thấy mạng chậm bất thường', en: 'Telling IT when the network is unusually slow' } },
      { id: 'dung-wifi-nv', text: { vi: 'Dùng Wi-Fi nhân viên bằng tài khoản của mình', en: 'Using the staff Wi-Fi with your own account' } },
      { id: 'cam-day-mang', text: { vi: 'Cắm lại dây mạng vào máy sau khi bị tuột', en: 'Plugging your network cable back in after it comes loose' } },
    ],
    ref: R.regPersonal,
  },

  /* ============================================================= THIẾT BỊ (6) */
  {
    id: 'thao-lap-may',
    topic: 'thiet-bi',
    q: {
      vi: 'Máy tính của bạn chạy chậm, bạn nghĩ nên lắp thêm RAM. Cách làm đúng?',
      en: 'Your PC is slow and you think it needs more RAM. What is the correct way?',
    },
    options: [
      { id: 'gui-yeu-cau', text: { vi: 'Gửi yêu cầu để IT xử lý — mọi thao tác phần cứng phải do IT làm', en: 'Open a request so IT handles it — all hardware work must be done by IT' } },
      { id: 'tu-thao', text: { vi: 'Tự tháo máy lắp thêm RAM mua ngoài', en: 'Open the case and fit RAM you bought yourself' } },
      { id: 'nho-ban', text: { vi: 'Nhờ một đồng nghiệp rành máy tính lắp giúp', en: 'Ask a tech-savvy colleague to fit it for you' } },
      { id: 'doi-may-khac', text: { vi: 'Tự đổi sang dùng máy trống ở bàn bên cạnh', en: 'Move yourself to an unused PC at the next desk' } },
    ],
    ref: R.regHardware,
  },
  {
    id: 'may-ca-nhan',
    topic: 'thiet-bi',
    q: {
      vi: 'Bạn muốn mang laptop cá nhân vào công ty để làm việc. Quy định là gì?',
      en: 'You want to bring your personal laptop to work. What does the policy say?',
    },
    options: [
      { id: 'phai-xin-phep', text: { vi: 'Phải được Trưởng bộ phận và phòng IT đồng ý, và đăng ký với bảo vệ', en: 'You need Dept Head and IT approval, and must register it with security' } },
      { id: 'thoai-mai', text: { vi: 'Thoải mái, miễn là không cắm vào mạng công ty', en: 'Freely, as long as you do not plug into the company network' } },
      { id: 'chi-bao-it', text: { vi: 'Chỉ cần báo miệng cho IT biết', en: 'Just tell IT verbally' } },
      { id: 'chi-gio-nghi', text: { vi: 'Chỉ được dùng trong giờ nghỉ trưa', en: 'Only during the lunch break' } },
    ],
    ref: R.regHardware,
  },
  {
    id: 'dien-thoai-khoa-ma',
    topic: 'thiet-bi',
    q: {
      vi: 'Bạn cài email công ty lên điện thoại riêng. Yêu cầu bắt buộc là gì?',
      en: 'You set up company email on your personal phone. What is mandatory?',
    },
    options: [
      { id: 'khoa-ma', text: { vi: 'Điện thoại phải được khoá mã (passcode)', en: 'The phone must have a passcode lock' } },
      { id: 'dien-thoai-moi', text: { vi: 'Phải là điện thoại mua trong 1 năm gần đây', en: 'The phone must be less than a year old' } },
      { id: 'chi-android', text: { vi: 'Chỉ được dùng điện thoại Android', en: 'Only Android phones are allowed' } },
      { id: 'khong-yeu-cau', text: { vi: 'Không có yêu cầu gì, cài là dùng', en: 'No requirement — just install and go' } },
    ],
    ref: R.regHardware,
  },
  {
    id: 'laptop-ngoai-gio',
    topic: 'thiet-bi',
    q: {
      vi: 'Hết giờ làm, bạn để laptop công ty ở đâu là đúng quy định?',
      en: 'At the end of the day, where should you leave your company laptop?',
    },
    options: [
      { id: 'cat-di', text: { vi: 'Cất đi — không để laptop trên bàn hay nơi dễ thấy ngoài giờ làm việc', en: 'Put it away — never leave it on the desk or in plain sight after hours' } },
      { id: 'de-tren-ban', text: { vi: 'Để trên bàn, đã có bảo vệ toà nhà', en: 'On the desk — the building has security' } },
      { id: 'phu-khan', text: { vi: 'Để trên bàn nhưng phủ khăn lên', en: 'On the desk but covered with a cloth' } },
      { id: 'gui-le-tan', text: { vi: 'Gửi ở quầy lễ tân mỗi tối', en: 'Leave it at the reception desk every evening' } },
    ],
    ref: R.regHardware,
  },
  {
    id: 'laptop-ben-ngoai',
    topic: 'thiet-bi',
    q: {
      vi: 'Dùng laptop công ty khi đi công tác, yêu cầu nào KHÔNG đúng?',
      en: 'When using a company laptop on a trip, which requirement is NOT correct?',
    },
    options: [
      { id: 'mo-chia-se', text: { vi: 'Nên bật chia sẻ file và truy cập từ xa cho tiện làm việc', en: 'Turn on file sharing and remote access for convenience' } },
      { id: 'khoa-bios', text: { vi: 'Laptop phải được khoá mã BIOS', en: 'The laptop must be BIOS-locked' } },
      { id: 'cai-av', text: { vi: 'Phải cài phần mềm diệt virus', en: 'It must run antivirus software' } },
      { id: 'bao-quan', text: { vi: 'Phải bảo quản cẩn thận, tránh mất mát', en: 'It must be looked after carefully to avoid loss' } },
    ],
    ref: R.regSecurity,
  },
  {
    id: 'may-in',
    topic: 'thiet-bi',
    q: {
      vi: 'Bạn bấm in nhưng không thấy bản in ra. Việc nên làm đầu tiên?',
      en: 'You hit print but nothing comes out. What should you do first?',
    },
    options: [
      { id: 'kiem-may-in', text: { vi: 'Kiểm tra xem đã chọn đúng máy in theo khu vực chưa; vẫn lỗi thì gửi ticket kèm tên máy in', en: 'Check you selected the correct area printer; if it still fails, open a ticket with the printer name' } },
      { id: 'in-lai-nhieu-lan', text: { vi: 'Bấm in lại vài lần cho chắc', en: 'Hit print several more times to be sure' } },
      { id: 'cai-driver', text: { vi: 'Tự tải driver máy in trên mạng về cài lại', en: 'Download a printer driver online and reinstall it yourself' } },
      { id: 'tat-may-in', text: { vi: 'Tắt máy in rồi bật lại', en: 'Switch the printer off and on again' } },
    ],
    ref: R.onbSoftware,
  },

  /* ============================================================= PHẦN MỀM (5) */
  {
    id: 'cai-phan-mem',
    topic: 'phan-mem',
    q: {
      vi: 'Bạn cần một phần mềm chưa có sẵn trên máy. Cách làm ĐÚNG là gì?',
      en: 'You need software that is not installed on your machine. What is the CORRECT way?',
    },
    options: [
      { id: 'gui-yeu-cau-it', text: { vi: 'Gửi yêu cầu Helpdesk nêu rõ phần mềm và mục đích, để IT cài bản có bản quyền', en: 'Open a Helpdesk ticket stating the software and why you need it, so IT installs a licensed copy' } },
      { id: 'tu-tai-tu-cai', text: { vi: 'Tự tìm bản cài trên mạng và cài, miễn là máy chạy được', en: 'Find an installer online and install it yourself, as long as it works' } },
      { id: 'muon-admin', text: { vi: 'Mượn tài khoản quản trị của đồng nghiệp để cài', en: 'Borrow a colleague’s admin account to install it' } },
      { id: 'dung-ban-crack', text: { vi: 'Dùng tạm bản crack, khi nào công ty mua thì cài lại', en: 'Use a cracked copy for now and reinstall when the company buys a licence' } },
    ],
    ref: R.regSoftware,
  },
  {
    id: 'phan-mem-lau',
    topic: 'phan-mem',
    q: {
      vi: 'Theo quy định, những phần mềm nào được phép chạy trên máy công ty?',
      en: 'Under the policy, which software may run on a company computer?',
    },
    options: [
      { id: 'da-dang-ky', text: { vi: 'Chỉ phần mềm do công ty cài đặt và đã đăng ký', en: 'Only software installed by the company and registered' } },
      { id: 'mien-phi-la-duoc', text: { vi: 'Phần mềm nào miễn phí thì đều được', en: 'Anything that is free to download' } },
      { id: 'khong-virus', text: { vi: 'Phần mềm nào quét không thấy virus thì được', en: 'Anything that passes an antivirus scan' } },
      { id: 'sep-dong-y', text: { vi: 'Phần mềm nào quản lý trực tiếp đồng ý miệng là được', en: 'Anything your line manager verbally approves' } },
    ],
    ref: R.regSoftware,
  },
  {
    id: 'choi-game',
    topic: 'phan-mem',
    q: {
      vi: 'Chơi game trên máy tính công ty trong giờ nghỉ thì sao?',
      en: 'What about playing games on your company computer during a break?',
    },
    options: [
      { id: 'bi-cam', text: { vi: 'Bị cấm — chơi game nằm trong danh sách hành vi cấm của quy định IT', en: 'Prohibited — playing games is on the IT policy’s banned list' } },
      { id: 'duoc-gio-nghi', text: { vi: 'Được, miễn là trong giờ nghỉ trưa', en: 'Allowed, as long as it is during the lunch break' } },
      { id: 'duoc-neu-online', text: { vi: 'Được, nếu là game trên trình duyệt không cần cài', en: 'Allowed, if it is a browser game with nothing to install' } },
      { id: 'duoc-neu-may-rieng', text: { vi: 'Được, nếu là máy chỉ mình bạn dùng', en: 'Allowed, if nobody else uses that PC' } },
    ],
    ref: R.regPersonal,
  },
  {
    id: 'diet-virus',
    topic: 'phan-mem',
    q: {
      vi: 'Phần mềm diệt virus trên máy bạn báo có bản cập nhật. Bạn nên làm gì?',
      en: 'Your antivirus reports an available update. What should you do?',
    },
    options: [
      { id: 'cap-nhat', text: { vi: 'Cập nhật — quy định yêu cầu cài và cập nhật thường xuyên theo hướng dẫn của IT', en: 'Update it — the policy requires antivirus to be installed and kept updated per IT guidance' } },
      { id: 'bo-qua', text: { vi: 'Bỏ qua, cập nhật làm máy chậm', en: 'Skip it — updates slow the machine down' } },
      { id: 'go-di', text: { vi: 'Gỡ phần mềm diệt virus cho nhẹ máy', en: 'Uninstall the antivirus to free up resources' } },
      { id: 'doi-it-lam', text: { vi: 'Chờ tới khi IT xuống tận nơi làm giúp', en: 'Wait until IT comes to your desk to do it' } },
    ],
    ref: R.regSecurity,
  },
  {
    id: 'ban-quyen',
    topic: 'phan-mem',
    q: {
      vi: 'Bạn sao chép phần mềm có bản quyền của công ty về cài cho máy ở nhà. Hậu quả theo quy định?',
      en: 'You copy the company’s licensed software to install on your home PC. What does the policy say?',
    },
    options: [
      { id: 'co-the-sa-thai', text: { vi: 'Vi phạm thoả thuận bản quyền — có thể bị kỷ luật, kể cả sa thải', en: 'It breaches the licence agreement — discipline up to dismissal is possible' } },
      { id: 'khong-sao', text: { vi: 'Không sao, vì vẫn phục vụ công việc', en: 'Fine, since it is still for work' } },
      { id: 'chi-nhac-nho', text: { vi: 'Chỉ bị nhắc nhở, không có chế tài', en: 'Just a reminder — no real consequence' } },
      { id: 'duoc-neu-mot-may', text: { vi: 'Được, miễn là chỉ cài trên một máy', en: 'Fine, as long as it is only on one machine' } },
    ],
    ref: R.regSoftware,
  },

  /* ============================================================== BẢO MẬT (8) */
  {
    id: 'khoa-man-hinh',
    topic: 'bao-mat',
    q: {
      vi: 'Bạn rời chỗ ngồi đi họp khoảng 10 phút. Phải làm gì với máy tính?',
      en: 'You leave your desk for a 10-minute meeting. What should you do with your computer?',
    },
    options: [
      { id: 'win-l', text: { vi: 'Nhấn Windows + L để khoá màn hình', en: 'Press Windows + L to lock the screen' } },
      { id: 'tat-man-hinh', text: { vi: 'Tắt màn hình cho tiết kiệm điện', en: 'Turn the monitor off to save power' } },
      { id: 'dang-xuat', text: { vi: 'Đăng xuất Windows rồi tắt hẳn máy', en: 'Sign out of Windows and shut the PC down' } },
      { id: 'khong-can', text: { vi: 'Không cần làm gì — trong văn phòng đã có bảo vệ', en: 'Nothing — the office already has security guards' } },
    ],
    ref: R.onbSecurity,
  },
  {
    id: 'usb',
    topic: 'bao-mat',
    q: {
      vi: 'Cổng USB trên máy tính nhân viên được công ty cấu hình như thế nào?',
      en: 'How does the company configure USB ports on staff computers?',
    },
    options: [
      { id: 'chi-doc', text: { vi: 'Chỉ đọc — đọc dữ liệu từ USB thì được, nhưng không sao chép dữ liệu ra USB', en: 'Read-only — you may read from a USB drive, but not copy data onto one' } },
      { id: 'chan-han', text: { vi: 'Chặn hẳn — cắm USB vào máy không nhận', en: 'Fully blocked — a USB drive is not recognised at all' } },
      { id: 'tu-do', text: { vi: 'Tự do — muốn chép ra hay chép vào đều được', en: 'Unrestricted — copy in or out as you like' } },
      { id: 'xin-phep-moi-lan', text: { vi: 'Tự do, nhưng phải xin phép IT mỗi lần cắm', en: 'Unrestricted, but you must ask IT each time you plug one in' } },
    ],
    ref: R.regSecurity,
  },
  {
    id: 'phishing',
    topic: 'bao-mat',
    q: {
      vi: 'Bạn lỡ bấm vào đường link trong một email lạ và đã nhập tài khoản công ty vào đó. Việc ĐẦU TIÊN cần làm?',
      en: 'You clicked a link in a suspicious email and entered your company credentials. What is the FIRST thing to do?',
    },
    options: [
      { id: 'bao-it-ngay', text: { vi: 'Báo IT ngay lập tức và đổi mật khẩu', en: 'Report it to IT immediately and change your password' } },
      { id: 'im-lang', text: { vi: 'Im lặng theo dõi, nếu vài hôm không thấy gì bất thường thì thôi', en: 'Say nothing and watch — if nothing odd happens in a few days, let it go' } },
      { id: 'tat-may', text: { vi: 'Tắt máy vài hôm cho an toàn', en: 'Shut the computer down for a few days to be safe' } },
      { id: 'xoa-email', text: { vi: 'Xoá email đó đi để không ai biết', en: 'Delete the email so nobody finds out' } },
    ],
    ref: R.onbSecurity,
  },
  {
    id: 'usb-la',
    topic: 'bao-mat',
    q: {
      vi: 'Bạn nhặt được một chiếc USB ở sảnh công ty. Nên làm gì?',
      en: 'You find a USB stick in the company lobby. What should you do?',
    },
    options: [
      { id: 'giao-it', text: { vi: 'Không cắm vào máy công ty — giao cho IT hoặc lễ tân xử lý', en: 'Do not plug it into a company PC — hand it to IT or reception' } },
      { id: 'cam-xem-cua-ai', text: { vi: 'Cắm vào máy xem của ai để trả lại', en: 'Plug it in to see whose it is so you can return it' } },
      { id: 'cam-may-nha', text: { vi: 'Mang về cắm máy ở nhà cho an toàn', en: 'Take it home and plug it into your own PC instead' } },
      { id: 'quet-virus-roi-cam', text: { vi: 'Quét virus xong rồi cắm vào máy công ty là được', en: 'Scan it for viruses, then it is fine to use at work' } },
    ],
    ref: R.onbSecurity,
  },
  {
    id: 'gui-tai-lieu-nhay-cam',
    topic: 'bao-mat',
    q: {
      vi: 'Bạn phải gửi một tệp nhạy cảm (bảng lương, báo cáo tài chính) ra ngoài mạng nội bộ. Cách làm đúng quy định?',
      en: 'You must send a sensitive file (payroll, financial report) outside the internal network. What does the policy require?',
    },
    options: [
      { id: 'ma-hoa-kenh-khac', text: { vi: 'Gửi qua email công ty, đặt mật khẩu cho tệp và báo mật khẩu qua một kênh khác (tin nhắn, chat)', en: 'Send via company email, password-protect the file and share the password through a separate channel (SMS, chat)' } },
      { id: 'gmail-ca-nhan', text: { vi: 'Gửi bằng Gmail cá nhân cho nhanh', en: 'Send it from your personal Gmail — it is quicker' } },
      { id: 'drive-cong-khai', text: { vi: 'Tải lên ổ đám mây cá nhân rồi gửi link ai có link cũng xem được', en: 'Upload to personal cloud storage and send an “anyone with the link” URL' } },
      { id: 'chep-usb', text: { vi: 'Chép ra USB đưa tận tay, khỏi cần mã hoá', en: 'Copy it to a USB stick and hand it over — no encryption needed' } },
    ],
    ref: R.regCrypto,
  },
  {
    id: 'kenh-gui-mat-khau',
    topic: 'bao-mat',
    q: {
      vi: 'Bạn đã nén và đặt mật khẩu cho tệp. Gửi mật khẩu cho người nhận bằng cách nào?',
      en: 'You have zipped and password-protected a file. How do you send the password to the recipient?',
    },
    options: [
      { id: 'kenh-khac', text: { vi: 'Qua một kênh khác với email chứa tệp — ví dụ tin nhắn hoặc chat', en: 'Through a channel separate from the email carrying the file — SMS or chat, for example' } },
      { id: 'cung-email', text: { vi: 'Ghi ngay trong nội dung email gửi kèm tệp', en: 'In the body of the same email as the attachment' } },
      { id: 'ten-file', text: { vi: 'Đặt luôn mật khẩu làm tên tệp cho dễ nhớ', en: 'Use the password as the file name so it is easy to remember' } },
      { id: 'email-thu-hai', text: { vi: 'Gửi email thứ hai từ chính hộp thư đó', en: 'Send a second email from the same mailbox' } },
    ],
    ref: R.regCrypto,
  },
  {
    id: 'tai-lieu-bat-buoc-ma-hoa',
    topic: 'bao-mat',
    q: {
      vi: 'Nhóm tài liệu nào dưới đây BẮT BUỘC phải mã hoá khi trao đổi?',
      en: 'Which group of documents MUST be encrypted when exchanged?',
    },
    options: [
      { id: 'luong-tai-chinh', text: { vi: 'Báo cáo tài chính, số liệu chuyển ngân hàng, thông tin lương/thưởng, thông tin quản trị hệ thống', en: 'Financial reports, bank-transfer data, salary/bonus information, system-admin information' } },
      { id: 'thong-bao-noi-bo', text: { vi: 'Thông báo nghỉ lễ và lịch họp nội bộ', en: 'Holiday notices and internal meeting schedules' } },
      { id: 'anh-team-building', text: { vi: 'Ảnh team building và hoạt động phong trào', en: 'Team-building and social-event photos' } },
      { id: 'menu-can-tin', text: { vi: 'Thực đơn căn tin hằng tuần', en: 'The weekly canteen menu' } },
    ],
    ref: R.regCrypto,
  },
  {
    id: 'xam-nhap',
    topic: 'bao-mat',
    q: {
      vi: 'Bạn phát hiện một thư mục trên ổ mạng vô tình mở quyền cho tất cả mọi người, trong đó có dữ liệu phòng khác. Nên làm gì?',
      en: 'You find a network folder accidentally open to everyone, containing another department’s data. What should you do?',
    },
    options: [
      { id: 'bao-it', text: { vi: 'Không mở xem — báo IT để chỉnh lại quyền', en: 'Do not browse it — report it to IT so the permissions get fixed' } },
      { id: 'xem-thu', text: { vi: 'Mở xem thử vì hệ thống đã cho phép', en: 'Have a look, since the system allows it' } },
      { id: 'copy-de-danh', text: { vi: 'Sao chép về máy mình để phòng khi cần', en: 'Copy it to your machine just in case' } },
      { id: 'bao-dong-nghiep', text: { vi: 'Báo cho vài đồng nghiệp cùng vào xem', en: 'Tell a few colleagues so they can look too' } },
    ],
    ref: R.regSecurity,
  },

  /* =============================================================== DỮ LIỆU (5) */
  {
    id: 'so-huu-du-lieu',
    topic: 'du-lieu',
    q: {
      vi: 'Email và dữ liệu bạn tạo ra trên hệ thống công ty thuộc về ai?',
      en: 'Who owns the email and data you create on company systems?',
    },
    options: [
      { id: 'cong-ty', text: { vi: 'Công ty — công ty sở hữu toàn bộ dữ liệu và email gửi/nhận trên hệ thống của mình', en: 'The company — it owns all data and email sent or received on its systems' } },
      { id: 'ca-nhan', text: { vi: 'Cá nhân bạn, vì bạn là người viết ra', en: 'You personally, since you wrote it' } },
      { id: 'phong-ban', text: { vi: 'Phòng ban của bạn', en: 'Your department' } },
      { id: 'chia-doi', text: { vi: 'Chia đôi giữa bạn và công ty', en: 'Shared equally between you and the company' } },
    ],
    ref: R.regData,
  },
  {
    id: 'kiem-tra-thu-muc',
    topic: 'du-lieu',
    q: {
      vi: 'Công ty có quyền kiểm tra dữ liệu trong thư mục cá nhân của bạn trên ổ mạng không?',
      en: 'May the company inspect the data in your personal folder on the network drive?',
    },
    options: [
      { id: 'co-quyen', text: { vi: 'Có — công ty được kiểm tra để đảm bảo tuân thủ chính sách', en: 'Yes — the company may inspect it to ensure policy compliance' } },
      { id: 'khong-bao-gio', text: { vi: 'Không bao giờ, đó là dữ liệu riêng tư', en: 'Never — that is private data' } },
      { id: 'phai-xin-phep', text: { vi: 'Chỉ khi bạn đồng ý bằng văn bản', en: 'Only with your written consent' } },
      { id: 'chi-khi-nghi-viec', text: { vi: 'Chỉ khi bạn đã nghỉ việc', en: 'Only after you leave the company' } },
    ],
    ref: R.regData,
  },
  {
    id: 'may-nguoi-khac',
    topic: 'du-lieu',
    q: {
      vi: 'Đồng nghiệp nghỉ phép, sếp cần gấp một file trong máy của người đó. Bạn tự mở máy họ ra tìm được không?',
      en: 'A colleague is on leave and your manager urgently needs a file from their PC. May you open it yourself?',
    },
    options: [
      { id: 'khong-duoc', text: { vi: 'Không — không truy cập máy tính, dữ liệu hay email của người khác khi chưa được phép', en: 'No — never access another person’s computer, data or email without permission' } },
      { id: 'duoc-vi-sep', text: { vi: 'Được, vì sếp là người yêu cầu', en: 'Yes, because your manager asked' } },
      { id: 'duoc-neu-cung-phong', text: { vi: 'Được, nếu cùng phòng ban', en: 'Yes, if you are in the same department' } },
      { id: 'duoc-neu-khong-khoa', text: { vi: 'Được, nếu máy đó không khoá màn hình', en: 'Yes, if their screen is not locked' } },
    ],
    ref: R.regData,
  },
  {
    id: 'luu-tai-lieu',
    topic: 'du-lieu',
    q: {
      vi: 'Tài liệu công việc nên được lưu ở đâu?',
      en: 'Where should work documents be stored?',
    },
    options: [
      { id: 'o-mang', text: { vi: 'Trên ổ mạng / hệ thống của công ty, không chỉ để riêng trên máy của bạn', en: 'On the company network drive or systems — not only on your own machine' } },
      { id: 'desktop', text: { vi: 'Ngay trên Desktop cho nhanh', en: 'Right on your Desktop for quick access' } },
      { id: 'usb-rieng', text: { vi: 'Trên USB riêng của bạn để mang đi đâu cũng có', en: 'On your own USB stick so you can carry it anywhere' } },
      { id: 'mail-cho-minh', text: { vi: 'Tự gửi email cho chính mình để lưu', en: 'Email them to yourself as a backup' } },
    ],
    ref: R.onbSecurity,
  },
  {
    id: 'file-ca-nhan-tai-ve',
    topic: 'du-lieu',
    q: {
      vi: 'Bạn tải phim và nhạc cá nhân từ Internet rồi lưu vào ổ cứng máy công ty. Quy định nói gì?',
      en: 'You download personal films and music and save them on your company PC. What does the policy say?',
    },
    options: [
      { id: 'khong-duoc-luu', text: { vi: 'Không được — không lưu file cá nhân tải từ Internet lên ổ cứng PC hay server mạng', en: 'Not allowed — do not store personal downloads on your PC drive or the network server' } },
      { id: 'duoc-neu-it-dung-luong', text: { vi: 'Được, nếu dung lượng nhỏ', en: 'Allowed, if the files are small' } },
      { id: 'duoc-neu-ngoai-gio', text: { vi: 'Được, nếu tải ngoài giờ làm việc', en: 'Allowed, if you download outside working hours' } },
      { id: 'duoc-neu-o-d', text: { vi: 'Được, nếu để ở ổ D chứ không phải ổ C', en: 'Allowed, if you keep them on drive D rather than C' } },
    ],
    ref: R.regNet,
  },

  /* ============================================================ HỖ TRỢ IT (6) */
  {
    id: 'helpdesk',
    topic: 'ho-tro',
    q: {
      vi: 'Máy in ở khu vực của bạn không in được. Kênh ĐÚNG để báo IT là gì?',
      en: 'The printer in your area is not working. What is the CORRECT way to report it to IT?',
    },
    options: [
      { id: 'email-helpdesk', text: { vi: 'Gửi email tới hệ thống Helpdesk: tiêu đề nêu rõ sự cố, nội dung mô tả chi tiết kèm ảnh chụp lỗi', en: 'Email the Helpdesk: a clear subject line, a detailed description and a screenshot of the error' } },
      { id: 'nhan-tin-rieng', text: { vi: 'Nhắn tin riêng cho một bạn IT quen', en: 'Send a private message to an IT colleague you know' } },
      { id: 'len-phong-it', text: { vi: 'Đi thẳng lên phòng IT nói miệng', en: 'Walk up to the IT room and tell them in person' } },
      { id: 'cho-tu-het', text: { vi: 'Chờ vài hôm xem có tự hết không', en: 'Wait a few days to see if it fixes itself' } },
    ],
    ref: R.helpHow,
  },
  {
    id: 'thong-tin-ticket',
    topic: 'ho-tro',
    q: {
      vi: 'Thông tin nào giúp IT xử lý ticket của bạn nhanh nhất?',
      en: 'What information helps IT resolve your ticket fastest?',
    },
    options: [
      { id: 'day-du', text: { vi: 'Thiết bị gặp lỗi, mô tả lỗi, thời điểm bắt đầu và ảnh chụp màn hình thông báo lỗi', en: 'The affected device, a description, when it started, and a screenshot of the error message' } },
      { id: 'chi-noi-hong', text: { vi: 'Chỉ cần viết “máy hỏng, xuống xem giúp”', en: 'Just “my PC is broken, please come and look”' } },
      { id: 'goi-nhieu-lan', text: { vi: 'Gửi nhiều ticket liên tiếp cho được ưu tiên', en: 'Send several tickets in a row to get priority' } },
      { id: 'cc-ca-phong', text: { vi: 'CC toàn bộ phòng ban vào email', en: 'CC your whole department on the email' } },
    ],
    ref: R.helpInfo,
  },
  {
    id: 'ad-nhan-dien',
    topic: 'ho-tro',
    q: {
      vi: 'Khi bạn gửi ticket, hệ thống Helpdesk nhận diện bạn bằng cách nào?',
      en: 'When you open a ticket, how does the Helpdesk identify you?',
    },
    options: [
      { id: 'tu-dong-ad', text: { vi: 'Tự động qua Active Directory — không cần khai lại tên, phòng ban hay email', en: 'Automatically via Active Directory — no need to re-enter your name, department or email' } },
      { id: 'khai-tay', text: { vi: 'Bạn phải khai đầy đủ tên, phòng ban, email trong mỗi ticket', en: 'You must type your name, department and email into every ticket' } },
      { id: 'ma-nhan-vien', text: { vi: 'Bạn phải đính kèm mã số nhân viên', en: 'You must attach your employee number' } },
      { id: 'goi-xac-nhan', text: { vi: 'IT gọi điện xác nhận danh tính trước khi mở ticket', en: 'IT phones you to confirm your identity before opening a ticket' } },
    ],
    ref: R.helpHow,
  },
  {
    id: 'sla-khan-cap',
    topic: 'ho-tro',
    q: {
      vi: 'Cả phòng mất mạng. Theo bảng thời gian phản hồi, IT phản hồi trong khoảng bao lâu?',
      en: 'A whole floor loses network. Per the response-time table, how soon does IT respond?',
    },
    options: [
      { id: '30-phut', text: { vi: 'Khoảng 30 phút — đây là mức Khẩn cấp', en: 'Around 30 minutes — this is Critical priority' } },
      { id: '2-gio', text: { vi: 'Khoảng 2 giờ', en: 'Around 2 hours' } },
      { id: '1-ngay', text: { vi: 'Trong 1 ngày làm việc', en: 'Within 1 business day' } },
      { id: '3-ngay', text: { vi: 'Trong 3 ngày làm việc', en: 'Within 3 business days' } },
    ],
    ref: R.helpSla,
  },
  {
    id: 'quen-mat-khau',
    topic: 'ho-tro',
    q: {
      vi: 'Bạn quên mật khẩu email và không đăng nhập được. Làm gì?',
      en: 'You forgot your email password and cannot log in. What do you do?',
    },
    options: [
      { id: 'gui-ticket', text: { vi: 'Gửi yêu cầu Helpdesk hoặc gọi số máy nhánh IT; IT đặt lại và hướng dẫn bạn đổi mật khẩu mới', en: 'Open a Helpdesk ticket or call the IT extension; IT resets it and guides you to set a new one' } },
      { id: 'muon-may-ban', text: { vi: 'Mượn tài khoản đồng nghiệp dùng tạm vài hôm', en: 'Borrow a colleague’s account for a few days' } },
      { id: 'tu-doan', text: { vi: 'Thử đoán mật khẩu tới khi vào được', en: 'Keep guessing until it works' } },
      { id: 'lap-mail-moi', text: { vi: 'Lập một email cá nhân mới để dùng cho công việc', en: 'Create a new personal email to use for work instead' } },
    ],
    ref: R.helpHow,
  },
  {
    id: 'portal-ghi-log',
    topic: 'ho-tro',
    q: {
      vi: 'Khi portal gặp lỗi kỹ thuật, hệ thống ghi lại những gì?',
      en: 'When the portal hits a technical error, what does it record?',
    },
    options: [
      { id: 'ten-trang-thao-tac', text: { vi: 'Tên đăng nhập, trang đang xem và 20 thao tác gần nhất — KHÔNG ghi nội dung tin nhắn hay chữ bạn đang gõ', en: 'Your username, the page you were on and your last 20 actions — message content and what you type are NOT recorded' } },
      { id: 'ghi-het', text: { vi: 'Ghi lại toàn bộ nội dung tin nhắn và mọi ký tự bạn gõ', en: 'Everything you type, including message content' } },
      { id: 'khong-ghi-gi', text: { vi: 'Không ghi lại gì cả', en: 'Nothing at all' } },
      { id: 'ghi-mat-khau', text: { vi: 'Ghi cả mật khẩu để IT kiểm tra giúp', en: 'Your password too, so IT can check it for you' } },
    ],
    ref: R.helpHow,
  },

  /* ========================================================= QUY ĐỊNH CHUNG (4) */
  {
    id: 'gio-nghi-trua',
    topic: 'quy-dinh',
    q: {
      vi: 'Dùng Internet hoặc email cá nhân ở công ty — quy định cho phép tới đâu?',
      en: 'Personal Internet or email use at work — what does the policy allow?',
    },
    options: [
      { id: 'gio-nghi-trua', text: { vi: 'Được dùng trong giờ nghỉ trưa, miễn là không làm phiền người khác và không vi phạm quy định bảo mật', en: 'Allowed during the lunch break, as long as it does not disturb others or breach data-security rules' } },
      { id: 'cam-hoan-toan', text: { vi: 'Cấm hoàn toàn trong mọi thời điểm', en: 'Completely prohibited at all times' } },
      { id: 'thoai-mai', text: { vi: 'Thoải mái cả ngày, miễn là hoàn thành công việc', en: 'Any time of day, as long as your work is done' } },
      { id: 'xin-phep-truoc', text: { vi: 'Phải xin phép quản lý trước mỗi lần dùng', en: 'You must ask your manager before each use' } },
    ],
    ref: R.regPersonal,
  },
  {
    id: 'che-tai',
    topic: 'quy-dinh',
    q: {
      vi: 'Vi phạm quy định về sử dụng máy tính và tài nguyên IT có thể dẫn tới hậu quả gì?',
      en: 'What can breaching the rules on computers and IT resources lead to?',
    },
    options: [
      { id: 'toi-truy-to', text: { vi: 'Từ khiển trách, cảnh cáo cho tới buộc thôi việc, và có thể bị truy tố trước pháp luật', en: 'From reprimand and warning up to dismissal, and possible legal prosecution' } },
      { id: 'chi-nhac-nho', text: { vi: 'Chỉ bị nhắc nhở trong cuộc họp phòng', en: 'Only a reminder at the department meeting' } },
      { id: 'tru-luong', text: { vi: 'Chỉ bị trừ lương tháng đó', en: 'Only a deduction from that month’s salary' } },
      { id: 'khong-che-tai', text: { vi: 'Không có chế tài cụ thể', en: 'No specific consequence' } },
    ],
    ref: R.regViolation,
  },
  {
    id: 'hanh-vi-cam',
    topic: 'quy-dinh',
    q: {
      vi: 'Hành vi nào KHÔNG nằm trong danh sách bị cấm của quy định IT?',
      en: 'Which of these is NOT on the IT policy’s prohibited list?',
    },
    options: [
      { id: 'dat-phong-hop', text: { vi: 'Dùng WorkIT để đặt phòng họp cho nhóm', en: 'Using WorkIT to book a meeting room for your team' } },
      { id: 'web-khieu-dam', text: { vi: 'Truy cập website khiêu dâm', en: 'Accessing pornographic websites' } },
      { id: 'phat-tan-virus', text: { vi: 'Cố ý phát tán virus, phần mềm gián điệp', en: 'Deliberately spreading viruses or spyware' } },
      { id: 'kinh-doanh-rieng', text: { vi: 'Dùng máy công ty đăng ký tài khoản trên website thương mại để kinh doanh riêng', en: 'Using a company PC to register on commercial sites for your own business' } },
    ],
    ref: R.regPersonal,
  },
  {
    id: 'workit-dat-phong',
    topic: 'quy-dinh',
    q: {
      vi: 'Bạn cần đặt phòng họp cho buổi chiều mai. Dùng hệ thống nào?',
      en: 'You need to book a meeting room for tomorrow afternoon. Which system do you use?',
    },
    options: [
      { id: 'workit', text: { vi: 'WorkIT — chọn “Đặt phòng họp”, chọn phòng, ngày giờ và người tham dự rồi gửi', en: 'WorkIT — choose “Book meeting room”, pick the room, date, time and attendees, then submit' } },
      { id: 'gui-ticket-it', text: { vi: 'Gửi ticket cho phòng IT nhờ đặt hộ', en: 'Open an IT ticket and ask them to book it' } },
      { id: 'ghi-bang', text: { vi: 'Ghi tên lên bảng trước cửa phòng họp', en: 'Write your name on the whiteboard outside the room' } },
      { id: 'hoi-le-tan', text: { vi: 'Gọi lễ tân giữ phòng giúp', en: 'Call reception to hold the room for you' } },
    ],
    ref: R.workit,
  },
];
