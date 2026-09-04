/* ============================================================================
 *  TUYỂN DỤNG — công cụ soạn thư cho phòng Nhân sự.
 *
 *  Chuyển từ site tĩnh cũ (nhánh `main`, GitHub Pages) vào portal ngày
 *  04/09/2026. Bản cũ nhét thẳng nội dung thư vào script.js, muốn sửa một chữ
 *  là phải sửa mã nguồn rồi push. Ở đây nội dung là DỮ LIỆU nên sửa được qua
 *  /admin như mọi nội dung khác.
 *
 *  CHỖ ĐIỀN được viết bằng {ngoặc nhọn}, thay lúc soạn thư:
 *    {xungHo}  → "Mr" hoặc "Ms"        (theo giới tính)
 *    {hoTen}   → họ tên ứng viên
 *    {anhChi}  → "Anh" hoặc "Chị"      (theo giới tính; chưa chọn thì "Anh/chị")
 *    {viTri}   → vị trí ứng tuyển
 *
 *  Thiếu một chỗ điền hay gõ sai tên nó thì thư gửi đi vẫn còn nguyên dấu
 *  ngoặc — `tools/audit_tuyen_dung.mjs` soạn thử một lá và bắt đúng chuyện đó.
 * ========================================================================== */
import { L } from '../core/models/content.models';

/** Một mẫu lý do từ chối. Phần mở đầu và kết thúc dùng chung cho mọi mẫu. */
export interface MauThu {
  id: string;
  /** Nhãn trên nút chọn mẫu. */
  ten: L;
  /** Đoạn giữa — lý do, khác nhau theo từng mẫu. */
  lyDo: L;
}

export const THU_MO_DAU: L = {
  vi: `Dear {xungHo}. {hoTen}

Cảm ơn {anhChi} đã dành thời gian tham gia phỏng vấn cho vị trí {viTri}.

Chúng tôi đánh giá cao sự cố gắng và nhiệt tình của {anhChi} đối với Công Ty Cổ Phần Năng Lượng An Việt Phát cũng như những gì {anhChi} thể hiện trong buổi phỏng vấn và cam kết đóng góp của {anhChi} đối với mục tiêu của công ty.`,
  en: `Dear {xungHo}. {hoTen}

Thank you for taking the time to interview for the {viTri} position.

We appreciate your effort and enthusiasm towards An Viet Phat Energy Corporation, what you showed during the interview, and your commitment to our goals.`,
};

export const THU_KET: L = {
  vi: `Chúng tôi sẽ giữ lại hồ sơ của {anhChi} và xin được liên hệ lại khi có bất kỳ một cơ hội nào phù hợp trong tương lai.

Chúc {xungHo}. {hoTen} may mắn trong quá trình tìm việc.

Trân trọng,`,
  en: `We will keep your profile on file and will be in touch should a suitable opportunity arise in the future.

We wish {xungHo}. {hoTen} all the best in your job search.

Best regards,`,
};

export const MAU_THU_TU_CHOI: MauThu[] = [
  {
    id: 'da-co-ung-vien',
    ten: { vi: 'Đã có ứng viên', en: 'Position filled' },
    lyDo: {
      vi: 'Tuy nhiên, chúng tôi đã phỏng vấn một số ứng viên ấn tượng và quyết định đồng hành với họ tại thời điểm này. Chúng tôi đã cân nhắc rất nhiều trước khi đưa ra quyết định.',
      en: 'However, we interviewed several impressive candidates and have decided to move forward with one of them at this time. It was not an easy decision.',
    },
  },
  {
    id: 'chua-phu-hop',
    ten: { vi: 'Chưa phù hợp', en: 'Not a fit' },
    lyDo: {
      vi: 'Tuy nhiên, sau khi cân nhắc tổng thể giữa yêu cầu công việc và kinh nghiệm hiện tại của {anhChi}, chúng tôi nhận thấy hồ sơ của {anhChi} chưa thực sự phù hợp với định hướng tuyển dụng ở thời điểm này.',
      en: 'However, weighing the role’s requirements against your current experience, we found your profile is not the right fit for our hiring direction at this time.',
    },
  },
];

export const TIEU_DE_MAC_DINH: L = {
  vi: 'Thông báo kết quả phỏng vấn - AVP Group',
  en: 'Interview result - AVP Group',
};

/** App nhập thông tin nhân viên mới. Ở NGOÀI portal (Vercel, hạ tầng công
 *  cộng) — giữ nguyên đường dẫn của bản cũ, chưa đưa vào trong. */
export const LINK_NHAN_VIEN_MOI = 'https://avpg-newemployee.vercel.app/';
