# AVP Group - Portal

Cổng thông tin nhân sự nội bộ của **Công ty Cổ phần Năng lượng An Việt Phát**.

**Live URL:** https://arikita.github.io/avpg-portal/

---

## Tính năng

| Tính năng | Mô tả |
|---|---|
| **New Employee** | Chuyển sang app nhập thông tin nhân viên mới |
| **Pass the interview** | *(Chưa có chức năng)* |
| **Fail the interview** | Mở form soạn email từ chối ứng viên qua Outlook |

### Email từ chối ứng viên
- **Mẫu 1 — Đã có ứng viên:** Đã tuyển được người khác
- **Mẫu 2 — Chưa phù hợp:** Hồ sơ chưa đáp ứng yêu cầu
- Tự động điền nội dung theo họ tên, giới tính, vị trí
- Gửi qua ứng dụng email mặc định trên máy (Outlook)

---

## Kiến trúc

```
Static Site — GitHub Pages
├── index.html     # Cấu trúc giao diện + modal email
├── script.js      # Logic UI, hiệu ứng particle, tạo email
└── style.css      # Toàn bộ CSS
```

Không có backend. Mọi logic chạy hoàn toàn trên trình duyệt.

---

## Triển khai

| Thành phần | Chi tiết |
|---|---|
| Hosting | GitHub Pages |
| Branch | `main` |
| Auto-deploy | Có — push lên `main` là live ngay |
| Domain cũ | `local.anvietphatgroup.com` → redirect về GitHub Pages |

---

## Liên kết hệ thống

| Hệ thống | URL |
|---|---|
| Portal (site này) | https://arikita.github.io/avpg-portal/ |
| App nhân viên mới | https://avpg-newemployee.vercel.app/ |
| Repo nhân viên mới | https://github.com/arikita/avpg-newemployee |

---

## Hướng dẫn chỉnh sửa

### Thay đổi nội dung email mẫu
Mở `script.js`, tìm hàm `updateEmailTemplate()`:
- `intro` — phần mở đầu chung
- `reason` — lý do từ chối (khác nhau theo từng mẫu)
- `outro` — phần kết chung

### Thay đổi link sang app nhân viên mới
Mở `index.html`, tìm button `Welcome to new employee`, đổi URL trong `onclick`.

### Thêm chức năng cho "Pass the interview"
`index.html` có button `class="btn-pass"`. Thêm handler trong `script.js`:
```js
document.querySelector('.btn-pass').addEventListener('click', () => {
  // logic xử lý ứng viên pass
});
```

### Sau khi chỉnh sửa
```bash
git add .
git commit -m "mô tả thay đổi"
git push
```
GitHub Pages tự động cập nhật trong vài giây.

---

## Quản lý từ server

Repository được clone tại server `kontumenery` (`clasvr`):
```
/home/clasvr/projects/avpg-portal/
```
SSH deploy key đã được cấu hình — có thể push trực tiếp từ server.
