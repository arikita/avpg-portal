/* ============================================================================
 *  IT REGULATIONS — Quy định IT (An Việt Phát ISMS).
 *  Tổng hợp từ 2 văn bản chính thức:
 *   - Quy định Hệ thống thông tin (03.IT.regulation)
 *   - Quy định sử dụng phương tiện truyền thông & trao đổi thông tin (02)
 *  Sửa nội dung tại đây nếu quy định cập nhật.
 * ========================================================================== */
import { GuideSection, L } from '../core/models/content.models';

export const REG_INTRO: L = {
  vi: 'Tổng hợp quy định về sử dụng hệ thống thông tin, máy tính, mạng, email và bảo mật thông tin tại An Việt Phát. Áp dụng cho toàn bộ nhân viên. Vi phạm có thể bị kỷ luật tới mức buộc thôi việc hoặc truy cứu pháp luật.',
  en: 'Consolidated rules for using information systems, computers, the network, email and information security at An Viet Phat. Applies to all employees. Violations may lead to discipline up to dismissal or legal prosecution.',
};

export const REG_SECTIONS: GuideSection[] = [
  {
    id: 'purpose',
    icon: 'info',
    eyebrow: { vi: 'Tổng quan', en: 'Overview' },
    title: { vi: 'Mục đích & phạm vi', en: 'Purpose & scope' },
    blocks: [
      {
        kind: 'bullets',
        items: [
          { vi: 'Công ty trang bị cho nhân viên các phương tiện làm việc (máy tính, điện thoại, fax, email, intranet, Internet…) để phục vụ khách hàng và công việc.', en: 'The company provides work tools (PC, phone, fax, email, intranet, Internet…) to serve customers and work.' },
          { vi: 'Các phương tiện phục vụ lợi ích của công ty; mọi nhân viên có trách nhiệm bảo quản tài sản công ty.', en: 'These tools serve company interests; every employee is responsible for protecting company assets.' },
          { vi: 'Mọi nhân viên phải tuân thủ quy tắc sử dụng máy tính, thiết bị ngoại vi và tài nguyên liên quan để tránh sai sót ảnh hưởng hệ thống và công việc chung.', en: 'Everyone must follow the rules for using computers, peripherals and related resources to avoid harming systems and shared work.' },
        ],
      },
    ],
  },
  {
    id: 'personal-use',
    icon: 'alert-triangle',
    eyebrow: { vi: 'Điều cấm', en: 'Prohibited' },
    title: { vi: 'Sử dụng cá nhân', en: 'Personal use' },
    intro: {
      vi: 'Máy tính và phương tiện của công ty dùng để hỗ trợ công việc. KHÔNG dùng cho các mục đích cá nhân sau:',
      en: 'Company computers and tools are for work. Do NOT use them for the following personal purposes:',
    },
    blocks: [
      {
        kind: 'bullets',
        items: [
          { vi: 'Tham gia hoạt động thương mại, tài chính hoặc đăng ký tài khoản trên các website thương mại.', en: 'Engaging in commercial or financial activities, or registering accounts on commercial websites.' },
          { vi: 'Dùng quyền hạn đặc biệt để xem, chọn, thông báo hoặc phân phối thông tin của công ty/người khác khi không được phép.', en: 'Using special privileges to view, select, announce or distribute company/other users’ information without permission.' },
          { vi: 'Dùng máy tính để chuyển thông tin cá nhân, thông tin mật về người khác (trừ khi có sự đồng ý của họ).', en: 'Using the computer to transfer others’ personal or confidential information (except with their consent).' },
          { vi: 'Gửi các ghi nhận, thông điệp, công bố mang tính cá nhân trong hệ thống mạng nội bộ.', en: 'Sending personal notes, messages or announcements over the internal network.' },
          { vi: 'Phá hoại, xóa hoặc che giấu các tập tin dữ liệu của công ty (hoặc công ty khác).', en: 'Destroying, deleting or hiding company (or other companies’) data files.' },
          { vi: 'Cố ý phát tán virus, sâu, phần mềm gián điệp hoặc mã độc gây hại hệ thống.', en: 'Intentionally spreading viruses, worms, spyware or malicious code that harms systems.' },
          { vi: 'Gửi, nhận hoặc truy cập các website khiêu dâm.', en: 'Sending, receiving or accessing pornographic websites.' },
          { vi: 'Gây ách tắc, gián đoạn, vô hiệu hóa, thay đổi hoặc làm hư hỏng hệ thống mạng công ty.', en: 'Congesting, disrupting, disabling, altering or damaging the company network.' },
          { vi: 'Chơi game.', en: 'Playing games.' },
          { vi: 'Phá hoại hoặc tìm cách phá vỡ các quy định bảo mật trên hệ thống và ứng dụng của công ty.', en: 'Breaking or attempting to break the security rules on company systems and applications.' },
        ],
      },
      {
        kind: 'callout',
        tone: 'tip',
        title: { vi: 'Được phép', en: 'Allowed' },
        text: {
          vi: 'Nhân viên có thể dùng Internet/email cá nhân trong giờ nghỉ trưa, miễn là không làm phiền người khác và không vi phạm quy định bảo mật dữ liệu.',
          en: 'Employees may use personal Internet/email during the lunch break, as long as it does not disturb others or breach data-security rules.',
        },
      },
    ],
  },
  {
    id: 'hardware',
    icon: 'monitor',
    title: { vi: 'Phần cứng', en: 'Hardware' },
    blocks: [
      {
        kind: 'bullets',
        items: [
          { vi: 'Tuân theo hướng dẫn vận hành; không tự ý tháo lắp, di chuyển thiết bị hay thay đổi cấu hình máy.', en: 'Follow operating instructions; do not disassemble, move devices or change the machine’s configuration on your own.' },
          { vi: 'Mọi thao tác kỹ thuật về phần cứng phải do nhân viên hỗ trợ kỹ thuật (IT) thực hiện khi được quản lý cho phép.', en: 'All hardware technical work must be performed by IT support staff with manager approval.' },
          { vi: 'Máy tính/thiết bị cá nhân không do công ty cấp không được dùng trong công ty; trường hợp đặc biệt phải được Trưởng bộ phận cho phép và đăng ký với phòng IT.', en: 'Personal computers/devices not issued by the company may not be used at work; exceptions need Dept Head approval and registration with IT.' },
          { vi: 'Thiết bị di động phải được khóa mã (passcode) khi dùng để truy cập email công ty.', en: 'Mobile devices must have a passcode lock when used to access company email.' },
          { vi: 'Không để laptop hoặc thiết bị phần cứng trên bàn/nơi dễ thấy ngoài giờ làm việc.', en: 'Do not leave laptops or hardware on desks or in visible places outside working hours.' },
        ],
      },
    ],
  },
  {
    id: 'software',
    icon: 'download',
    title: { vi: 'Phần mềm', en: 'Software' },
    blocks: [
      {
        kind: 'bullets',
        items: [
          { vi: 'Cấm tải hoặc cài đặt phần mềm không hợp pháp. Chỉ phần mềm do công ty cài đặt và đã đăng ký mới được vận hành.', en: 'Downloading or installing illegal software is prohibited. Only company-installed and registered software may run.' },
          { vi: 'Cần phần mềm gì, liên hệ quản trị hệ thống (IT) để được hỗ trợ.', en: 'For any software needs, contact the system administrator (IT).' },
          { vi: 'Tuân thủ thỏa thuận bản quyền; không sao chép, phân phối bản sao cho mục đích cá nhân. Vi phạm có thể bị kỷ luật, kể cả sa thải.', en: 'Comply with license agreements; do not copy or distribute copies for personal use. Violations may lead to discipline, including dismissal.' },
        ],
      },
    ],
  },
  {
    id: 'data-ownership',
    icon: 'lock',
    title: { vi: 'Quyền sở hữu & truy cập dữ liệu', en: 'Data ownership & access' },
    blocks: [
      {
        kind: 'bullets',
        items: [
          { vi: 'Công ty sở hữu toàn bộ dữ liệu và email được gửi/nhận trên bất kỳ máy tính, mạng hay hệ thống nào của công ty.', en: 'The company owns all data and email sent/received on any company computer, network or system.' },
          { vi: 'Công ty có quyền kiểm tra dữ liệu lưu trong thư mục cá nhân trên mạng, máy tính hoặc phương tiện lưu trữ để đảm bảo tuân thủ chính sách.', en: 'The company may inspect data stored in personal folders on the network, computers or storage media to ensure policy compliance.' },
          { vi: 'Không truy cập máy tính, dữ liệu hoặc email của nhân viên khác khi chưa được phép của người đó hoặc công ty.', en: 'Do not access another employee’s computer, data or email without prior permission from that person or the company.' },
        ],
      },
    ],
  },
  {
    id: 'security',
    icon: 'shield-check',
    title: { vi: 'An ninh & bảo mật', en: 'Security' },
    intro: {
      vi: 'Trừ khi được công ty cho phép, mọi nhân viên phải tuân thủ:',
      en: 'Unless authorized by the company, every employee must comply with:',
    },
    blocks: [
      {
        kind: 'bullets',
        items: [
          { vi: 'Chấp nhận việc giám sát và ngăn chặn các tập tin trao đổi giữa nhân viên hoặc với bên thứ ba.', en: 'Accept monitoring and blocking of files exchanged between employees or with third parties.' },
          { vi: 'Không xâm nhập, truy cập máy tính/hệ thống mà mình không có quyền.', en: 'Do not intrude into or access computers/systems you are not authorized to use.' },
          { vi: 'Không dùng tài khoản/mật khẩu của người khác để đăng nhập.', en: 'Do not use another person’s account/password to log in.' },
          { vi: 'Laptop công ty cấp phải khóa mã BIOS, cài phần mềm diệt virus, không mở chia sẻ file hay remote access khi dùng bên ngoài công ty; bảo quản cẩn thận tránh mất.', en: 'Company laptops must be BIOS-locked, run antivirus, and must not enable file sharing or remote access when used outside the company; handle carefully to avoid loss.' },
          { vi: 'Không gửi email nặc danh hoặc giả mạo địa chỉ. Không dùng email công cộng (Gmail, Yahoo, Hotmail…) để trao đổi thông tin công việc.', en: 'Do not send anonymous or spoofed emails. Do not use public email (Gmail, Yahoo, Hotmail…) to exchange work information.' },
          { vi: 'Không gửi email/tệp dung lượng quá lớn (tệp đính kèm tối đa 20 MB; lớn hơn phải được IT cho phép).', en: 'Do not send oversized emails/files (attachments max 20 MB; larger needs IT approval).' },
          { vi: 'Không sao chép, sửa hoặc chuyển tiếp tài liệu khi chưa được chủ sở hữu cho phép; không tự ý chuyển tài liệu/thông tin nội bộ ra ngoài.', en: 'Do not copy, edit or forward documents without the owner’s permission; do not transfer internal documents/info externally on your own.' },
          { vi: 'Cài phần mềm diệt virus và cập nhật thường xuyên theo hướng dẫn của IT.', en: 'Install antivirus and keep it updated per IT guidance.' },
          { vi: 'Không tự ý dùng USB, HDD box… để sao chép/chuyển dữ liệu; khi cần phải được Trưởng bộ phận cho phép.', en: 'Do not use USB drives, HDD boxes… to copy/transfer data on your own; when needed, get Dept Head approval.' },
          { vi: 'Máy của bộ phận phát triển phần mềm có thể dùng quyền Local Administrator theo phê duyệt của Giám đốc, phải kiểm soát định kỳ việc cài antivirus và bắt buộc join domain.', en: 'Software-development machines may use Local Administrator per the Director’s approval, subject to periodic antivirus checks and must join the domain.' },
          { vi: 'Không mang laptop cá nhân vào công ty; nếu mang vào phải được Trưởng bộ phận, phòng IT đồng ý và đăng ký với bảo vệ.', en: 'Do not bring personal laptops into the company; if brought in, they need Dept Head and IT approval and must be registered with security.' },
        ],
      },
    ],
  },
  {
    id: 'encryption',
    icon: 'key',
    title: { vi: 'Mã hóa', en: 'Encryption' },
    blocks: [
      {
        kind: 'p',
        text: {
          vi: 'Dùng công cụ mã hóa bằng mật khẩu (file MS Office) hoặc mã hóa của phần mềm nén (zip) để bảo vệ dữ liệu nhạy cảm, và chuyển mật khẩu qua một kênh khác (nhắn tin, chat…). Mật khẩu, khóa mã và bản sao lưu “hard copy” phải giao cho quản lý bộ phận và giữ nơi an toàn. Dữ liệu trao đổi ra ngoài mạng nội bộ (với khách hàng, giữa chi nhánh và trung tâm) phải được mã hóa.',
          en: 'Use password encryption (MS Office files) or the zip tool’s encryption to protect sensitive data, and send the password via a separate channel (SMS, chat…). Passwords, keys and “hard-copy” backups must be given to the department manager and kept safe. Data exchanged outside the internal network (with customers, between branches and HQ) must be encrypted.',
        },
      },
      {
        kind: 'callout',
        tone: 'warning',
        title: { vi: 'Tài liệu bắt buộc mã hóa', en: 'Documents that must be encrypted' },
        text: {
          vi: 'Kế toán: báo cáo tài chính (kiểm toán, thuế), số liệu chuyển ngân hàng. Nhân sự: thông tin lương/thưởng. Kinh doanh: thông tin thưởng. IT: thông tin quản trị hệ thống (tài khoản, mật khẩu). Các chi nhánh: thông tin thưởng.',
          en: 'Accounting: financial reports (audit, tax), bank-transfer data. HR: salary/bonus info. Sales: bonus info. IT: system admin info (accounts, passwords). Branches: bonus info.',
        },
      },
    ],
  },
  {
    id: 'passwords',
    icon: 'lock',
    title: { vi: 'Tài khoản & mật khẩu', en: 'Accounts & passwords' },
    blocks: [
      {
        kind: 'bullets',
        items: [
          { vi: 'Khóa máy trước khi rời vị trí làm việc.', en: 'Lock your computer before leaving your desk.' },
          { vi: 'Không cho người khác mượn/dùng tài khoản và mật khẩu của mình.', en: 'Do not lend or share your account and password.' },
          { vi: 'Thay đổi mật khẩu định kỳ theo hướng dẫn của quản trị hệ thống.', en: 'Change your password periodically per system-admin guidance.' },
          { vi: 'Không ghi mật khẩu ra giấy hoặc nơi dễ phát hiện.', en: 'Do not write passwords on paper or in easily discoverable places.' },
        ],
      },
    ],
  },
  {
    id: 'backup',
    icon: 'folder',
    title: { vi: 'Sao lưu & khôi phục', en: 'Backup & recovery' },
    blocks: [
      {
        kind: 'bullets',
        items: [
          { vi: 'Chỉ tra cứu tài liệu bằng chương trình, công cụ dành cho công ty.', en: 'Only look up documents using company-provided programs and tools.' },
          { vi: 'Ghi phiếu yêu cầu nếu cần sao chép tài liệu từ chương trình vận hành của công ty.', en: 'Submit a request form if you need to copy documents from company operating programs.' },
          { vi: 'Không tìm cách hủy bỏ mật khẩu của những phần không được phép sử dụng.', en: 'Do not attempt to remove passwords of components you are not allowed to use.' },
          { vi: 'Không sao chép phần mềm vào/ra khỏi máy bằng vật ghi cá nhân (USB, HDD box, CD/DVD-RW…) khi chưa được phép.', en: 'Do not copy software to/from the machine using personal media (USB, HDD box, CD/DVD-RW…) without permission.' },
          { vi: 'Tuân thủ lịch backup định kỳ và lưu trữ dữ liệu quan trọng đúng nơi quy định.', en: 'Follow the periodic backup schedule and store important data in the designated place.' },
          { vi: 'Tắt máy đúng trình tự sau khi kết thúc buổi làm việc.', en: 'Shut down the computer properly at the end of the workday.' },
        ],
      },
    ],
  },
  {
    id: 'internet-email',
    icon: 'globe',
    title: { vi: 'Sử dụng Internet & Email', en: 'Internet & email use' },
    blocks: [
      {
        kind: 'bullets',
        items: [
          { vi: 'Tuân thủ quy định, thủ tục hiện hành khi dùng Internet; hạn chế mọi hành động có thể gây hại hệ thống và dữ liệu, kể cả tấn công virus khi tải dữ liệu từ Internet.', en: 'Follow current rules and procedures for Internet use; limit any action that could harm systems and data, including virus attacks when downloading from the Internet.' },
          { vi: 'Tìm hiểu các quy ước Internet, gồm thủ tục được phép khi truy cập và chuyển file từ máy tính từ xa.', en: 'Learn Internet conventions, including permitted procedures for remote access and file transfer.' },
          { vi: 'Tuân thủ yêu cầu đặc biệt về truy cập, bảo quản và sử dụng dữ liệu, gồm cả dữ liệu nhạy cảm thu thập được.', en: 'Follow special requirements for accessing, storing and using data, including sensitive data collected.' },
          { vi: 'Không lưu file cá nhân tải từ Internet lên ổ cứng PC hoặc server mạng.', en: 'Do not store personal files downloaded from the Internet on your PC hard drive or the network server.' },
          { vi: 'Không tải hình ảnh, âm thanh từ Internet trừ khi phục vụ chức năng công việc đã được quy định.', en: 'Do not download images or audio from the Internet unless for defined work functions.' },
        ],
      },
    ],
  },
  {
    id: 'violations',
    icon: 'alert-triangle',
    title: { vi: 'Xử lý vi phạm', en: 'Handling violations' },
    blocks: [
      {
        kind: 'callout',
        tone: 'danger',
        title: { vi: 'Chế tài', en: 'Consequences' },
        text: {
          vi: 'Nhân viên vi phạm quy định về sử dụng máy tính và tài nguyên liên quan sẽ chịu kỷ luật từ khiển trách, cảnh cáo cho tới buộc thôi việc, hoặc có thể bị truy tố trước pháp luật.',
          en: 'Employees who violate the rules on using computers and related resources will face discipline ranging from reprimand and warning to dismissal, and may be prosecuted by law.',
        },
      },
    ],
  },
];
