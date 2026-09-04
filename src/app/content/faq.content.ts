/* ============================================================================
 *  FAQ CONTENT — câu hỏi thường gặp của người mới.
 * ========================================================================== */
import { FaqItem } from '../core/models/content.models';

export const FAQS: FaqItem[] = [
  {
    tag: { vi: 'Tài khoản', en: 'Account' },
    q: { vi: 'Tôi quên mật khẩu email thì làm sao?', en: 'I forgot my email password — what do I do?' },
    a: { vi: 'Gửi yêu cầu hỗ trợ IT hoặc gọi Helpdesk (số máy nhánh ở trang Danh bạ). IT sẽ đặt lại mật khẩu và hướng dẫn bạn đổi mật khẩu mới.', en: 'Open an IT support ticket or call the Helpdesk (extension on the Directory page). IT will reset it and guide you to set a new one.' },
  },
  {
    tag: { vi: 'Wi-Fi', en: 'Wi-Fi' },
    q: { vi: 'Điện thoại của tôi không kết nối được Wi-Fi nhân viên?', en: 'My phone won’t connect to the staff Wi-Fi?' },
    a: { vi: 'Kiểm tra bạn đã chọn đúng mạng “An Viet Phat”, và đăng nhập bằng chính tài khoản công ty của bạn — giống hệt lúc đăng nhập máy tính. Nếu vẫn không được, gửi yêu cầu hỗ trợ IT kèm tên thiết bị.', en: 'Check that you picked the “An Viet Phat” network and signed in with your company account — the same one you use for your computer. If it still fails, open a ticket and include your device name.' },
  },
  {
    tag: { vi: 'WorkIT', en: 'WorkIT' },
    q: { vi: 'Làm sao để đặt phòng họp?', en: 'How do I book a meeting room?' },
    a: { vi: 'Đăng nhập WorkIT → “Đặt phòng họp” → chọn phòng, thời gian và người tham dự → gửi. Xem chi tiết ở mục WorkIT trong trang Onboarding.', en: 'Log in to WorkIT → “Book meeting room” → pick room, time and attendees → submit. See the WorkIT section on the Onboarding page.' },
  },
  {
    tag: { vi: 'Phần mềm', en: 'Software' },
    q: { vi: 'Tôi cần cài một phần mềm nhưng không có quyền?', en: 'I need software but don’t have permission to install it?' },
    a: { vi: 'Vì lý do bảo mật, việc cài đặt do IT thực hiện. Hãy gửi yêu cầu hỗ trợ IT nêu rõ phần mềm và mục đích sử dụng.', en: 'For security, installations are done by IT. Open a ticket stating the software and why you need it.' },
  },
  {
    tag: { vi: 'Thiết bị', en: 'Devices' },
    q: { vi: 'Máy in không in được?', en: 'The printer isn’t working?' },
    a: { vi: 'Kiểm tra bạn chọn đúng máy in theo khu vực. Nếu vẫn lỗi, gửi yêu cầu hỗ trợ IT kèm tên máy in.', en: 'Check you selected the correct area printer. If it still fails, open a ticket and include the printer name.' },
  },
  {
    tag: { vi: 'Nhân sự', en: 'HR' },
    q: { vi: 'Tôi xin nghỉ phép ở đâu?', en: 'Where do I request leave?' },
    a: { vi: 'Gửi đơn nghỉ phép qua WorkIT và chờ quản lý phê duyệt. Xem thêm ở trang Chính sách.', en: 'Submit a leave request via WorkIT and await manager approval. See the Policies page for details.' },
  },
  {
    tag: { vi: 'Email', en: 'Email' },
    q: { vi: 'Làm sao để cài chữ ký email chuẩn công ty?', en: 'How do I set the standard company email signature?' },
    a: { vi: 'Tải mẫu chữ ký ở trang Công cụ → mục Tải về, rồi dán vào phần Chữ ký trong Outlook.', en: 'Download the signature template from Tools → Downloads, then paste it into Outlook’s Signature settings.' },
  },
  {
    tag: { vi: 'Hỗ trợ', en: 'Support' },
    q: { vi: 'Kênh nhanh nhất để được hỗ trợ IT là gì?', en: 'What’s the fastest way to get IT support?' },
    a: { vi: 'Gửi ticket qua hệ thống Helpdesk là nhanh và dễ theo dõi nhất. Trường hợp khẩn cấp, gọi trực tiếp số máy nhánh IT.', en: 'A Helpdesk ticket is fastest and easiest to track. For emergencies, call the IT extension directly.' },
  },
];
