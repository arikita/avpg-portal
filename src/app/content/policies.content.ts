/* ============================================================================
 *  POLICIES CONTENT — chính sách & quy định (tóm tắt cho người mới).
 *  TODO: rà soát cho khớp với quy định THẬT của công ty.
 * ========================================================================== */
import { PolicyItem } from '../core/models/content.models';

export const POLICIES: PolicyItem[] = [
  {
    icon: 'clock',
    title: { vi: 'Giờ làm việc', en: 'Working hours' },
    summary: { vi: 'Khung giờ làm việc và nghỉ trưa tiêu chuẩn.', en: 'Standard working and lunch hours.' },
    points: [
      { vi: 'Thứ 2 – Thứ 6: 08:00 – 17:00 (nghỉ trưa 12:00 – 13:00).', en: 'Mon–Fri: 08:00 – 17:00 (lunch 12:00 – 13:00).' },
      { vi: 'Chấm công khi đến và khi về theo quy định.', en: 'Clock in and out as required.' },
      { vi: 'Đi trễ/về sớm cần báo quản lý trực tiếp.', en: 'Notify your manager for late arrivals/early leaves.' },
    ],
  },
  {
    icon: 'calendar',
    title: { vi: 'Nghỉ phép', en: 'Leave' },
    summary: { vi: 'Cách xin nghỉ phép năm, nghỉ ốm và nghỉ việc riêng.', en: 'How to request annual, sick and personal leave.' },
    points: [
      { vi: 'Gửi đơn nghỉ phép qua WorkIT và chờ phê duyệt.', en: 'Submit leave requests via WorkIT and await approval.' },
      { vi: 'Nghỉ ốm: báo sớm cho quản lý, bổ sung giấy tờ nếu cần.', en: 'Sick leave: inform your manager early, provide documents if needed.' },
      { vi: 'Lên kế hoạch nghỉ phép năm cùng nhóm để không gián đoạn công việc.', en: 'Plan annual leave with your team to avoid disruption.' },
    ],
  },
  {
    icon: 'briefcase',
    title: { vi: 'Công tác phí', en: 'Business travel & expenses' },
    summary: { vi: 'Quy định tạm ứng và hoàn ứng chi phí công tác.', en: 'Advance and reimbursement of travel expenses.' },
    points: [
      { vi: 'Đề nghị công tác & tạm ứng qua WorkIT trước chuyến đi.', en: 'Request the trip & advance via WorkIT before travelling.' },
      { vi: 'Giữ hoá đơn hợp lệ để hoàn ứng.', en: 'Keep valid receipts for reimbursement.' },
    ],
  },
  {
    icon: 'users',
    title: { vi: 'Trang phục & Ứng xử', en: 'Dress code & Conduct' },
    summary: { vi: 'Chuẩn mực trang phục và ứng xử nơi làm việc.', en: 'Workplace dress and conduct standards.' },
    points: [
      { vi: 'Trang phục lịch sự, phù hợp môi trường công sở.', en: 'Dress neatly and appropriately for the office.' },
      { vi: 'Tôn trọng, hợp tác và giao tiếp chuyên nghiệp với đồng nghiệp.', en: 'Be respectful, collaborative and professional with colleagues.' },
    ],
  },
  {
    icon: 'lock',
    title: { vi: 'Bảo mật dữ liệu', en: 'Data security' },
    summary: { vi: 'Bảo vệ thông tin công ty và khách hàng.', en: 'Protecting company and customer information.' },
    points: [
      { vi: 'Không chia sẻ dữ liệu nội bộ ra ngoài khi chưa được phép.', en: 'Do not share internal data externally without approval.' },
      { vi: 'Khoá màn hình khi rời chỗ; bảo mật mật khẩu.', en: 'Lock your screen when away; keep passwords private.' },
    ],
  },
  {
    icon: 'monitor',
    title: { vi: 'Tài sản CNTT', en: 'IT assets' },
    summary: { vi: 'Sử dụng và bảo quản thiết bị được cấp.', en: 'Using and caring for issued equipment.' },
    points: [
      { vi: 'Thiết bị được cấp phục vụ công việc; giữ gìn cẩn thận.', en: 'Issued devices are for work; handle them with care.' },
      { vi: 'Báo IT ngay khi thiết bị hỏng hoặc mất.', en: 'Report damaged or lost devices to IT immediately.' },
    ],
  },
  {
    icon: 'gift',
    title: { vi: 'Phúc lợi', en: 'Benefits' },
    summary: { vi: 'Các chế độ dành cho nhân viên (tham khảo HR).', en: 'Employee benefits (check with HR).' },
    points: [
      { vi: 'BHXH, BHYT theo quy định; khám sức khỏe định kỳ.', en: 'Social & health insurance; periodic health checks.' },
      { vi: 'Thưởng lễ, Tết, sinh nhật và các hoạt động nội bộ.', en: 'Holiday, Tet and birthday bonuses, plus internal activities.' },
    ],
  },
];
