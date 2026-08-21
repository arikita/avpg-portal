# AVP Portal — mã nguồn ứng dụng

Cổng thông tin nội bộ của **Công ty Cổ phần Năng lượng An Việt Phát**, chạy tại
`https://portal.anvietphatgroup.com` (máy `hcm-internalsvr`, 10.10.100.136).

> **Nhánh này (`app`) là ứng dụng Angular + FastAPI đang chạy thật.**
> Nhánh `main` là một thứ khác hẳn: site tĩnh cũ đang phục vụ GitHub Pages tại
> `https://arikita.github.io/avpg-portal/`. Hai nhánh không liên quan nhau, đừng
> merge vào nhau.

---

## Cấu trúc

| Đường dẫn | Nội dung |
|---|---|
| `src/` | Ứng dụng Angular 20 (SPA). Chữ song ngữ nằm trong `src/app/content/*.ts` |
| `public/` | Ảnh thương hiệu, favicon, service worker (`sw.js` — Web Push) |
| `server/app/` | Backend FastAPI: AD, tin tức, hồ sơ, tường, bảng tin, chat |
| `server/publish_scheduled.py` | Đăng bài tin đã tới giờ hẹn (chạy bằng timer systemd mỗi phút) |
| `server/systemd/` | Unit `avp-news-publish.{service,timer}` — bản sao của thứ đang chạy ở `/etc/systemd/system/` |
| `server/schema_*.sql` | Các bảng thêm trong đợt 13/08/2026 |
| `server/schema_full_dump.sql` | Cấu trúc toàn bộ DB `avpportal` (chỉ cấu trúc, không có dữ liệu) |
| `tools/` | `clean_deploy.py` (dọn file cũ sau khi deploy), `pull_gallery.py` |
| `dump-content.js` | Trích nội dung từ `content/*.ts` để nạp vào bảng `content` |

## Chạy và triển khai

```bash
npm install
npx ng build                       # ra dist/avp-portal/browser/
sudo cp -r dist/avp-portal/browser/* /var/www/avp-portal/
sudo chown -R www-data:www-data /var/www/avp-portal
python3 tools/clean_deploy.py --apply   # BẮT BUỘC, xem bên dưới
```

**Luôn chạy `clean_deploy.py` sau khi deploy.** Angular đặt tên file theo mã băm
nội dung nên mỗi lần build ra tên mới, còn lệnh `cp` thì chỉ đè chứ không xoá.
Thư mục deploy sẽ tích luỹ mọi thế hệ chunk cũ; trình duyệt nào giữ `index.html`
cũ trong cache sẽ tải đúng chunk cũ đó — **chạy code cũ mà không báo lỗi gì**.
Đã dính đúng lỗi này ngày 13/08/2026 (88/127 file là rác).

## Hẹn giờ phát hành bài tin

Bài có `status = 'scheduled'` + `scheduled_at` nằm chờ, chỉ tác giả nhìn thấy.
Hai đường đưa bài lên sóng, cùng gọi `publish_due()` trong `server/app/news.py`:

- **Timer `avp-news-publish`** chạy mỗi phút (`server/publish_scheduled.py`).
- **API** — mỗi lần mở trang tin hoặc mở một bài, phòng khi timer chết.

`UPDATE ... RETURNING` là nguyên khối nên hai worker uvicorn (hoặc timer chạy
trùng lúc) không thể đăng hai lần. Đăng xong tác giả nhận thông báo + Web Push.

Cài lại trên máy chủ:

```bash
sudo cp server/systemd/avp-news-publish.* /etc/systemd/system/
sudo cp server/publish_scheduled.py /opt/avp-portal-api/
sudo systemctl daemon-reload
sudo systemctl enable --now avp-news-publish.timer
```

## Những thứ KHÔNG nằm trong kho này

- `/etc/avp-portal-api.env` — chuỗi kết nối DB, tài khoản Workit, khoá VAPID.
- `/etc/krb5.keytab.portal` — keytab Kerberos của service account.
- Cấu hình Apache (`/etc/apache2/sites-available/avp-portal.conf`).
- Ảnh người dùng tải lên: `/var/www/avp-portal-media/`.

## Kiến trúc tóm tắt

```
Trình duyệt --Kerberos--> Apache (mod_auth_gssapi)
                            ├─ /            → SPA tĩnh /var/www/avp-portal
                            ├─ /api/*       → 127.0.0.1:8000 (FastAPI)
                            └─ /api/ws      → WebSocket (chat), upgrade=websocket
FastAPI → PostgreSQL 16 + Active Directory (LDAP qua GSSAPI, không lưu mật khẩu bind)
```

Backend chỉ tin header `X-Remote-User` do Apache đặt. Trong `<Location /api>`
**bắt buộc** phải có `RequestHeader unset X-Remote-User` **trước** khi set lại,
nếu không ai cũng mạo danh được người khác.
