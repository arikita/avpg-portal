# CLAUDE.md — avpg-portal

## Project
Static site nhân sự của AVP Group (Công ty Cổ phần Năng lượng An Việt Phát).

- **Live:** https://arikita.github.io/avpg-portal/
- **Repo:** https://github.com/arikita/avpg-portal
- **Hosting:** GitHub Pages — auto-deploy từ nhánh `main`

## Stack
Vanilla HTML/CSS/JS thuần. Không có build step, không có package manager, không có backend.

## Files quan trọng
| File | Vai trò |
|---|---|
| `index.html` | Toàn bộ cấu trúc HTML + modal email + inline CSS cho toggle |
| `script.js` | Logic UI, hiệu ứng particle canvas, tạo nội dung email, mở mailto |
| `style.css` | CSS chính cho layout 2 panel kiểu flip-card |

## Deploy
```bash
git add .
git commit -m "..."
git push
```
GitHub Pages cập nhật trong vài giây, không cần thêm bước nào.

## Lưu ý quan trọng
- **Gửi email dùng `mailto:`** — mở Outlook/ứng dụng email trên máy người dùng, không qua server. Nếu muốn gửi thật qua server thì phải tích hợp EmailJS hoặc n8n webhook.
- **"Pass the interview"** hiện chưa có chức năng — `class="btn-pass"` nhưng không có JS handler.
- **Domain cũ** `local.anvietphatgroup.com` đang redirect về GitHub Pages (hardcode trong `script.js`).
- Repo SSH alias: `github-avpg-portal` (deploy key trên server `kontumenery`).

## Liên hệ hệ thống
- App nhân viên mới: https://avpg-newemployee.vercel.app/ (repo: `arikita/avpg-newemployee`)
- Link này hardcode trong `index.html` button "Welcome to new employee"
