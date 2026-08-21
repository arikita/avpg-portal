# AVP Portal — cổng thông tin nội bộ

Thư mục làm việc chính của dự án portal (tách khỏi `avpg-network-monitoring` ngày 17/08/2026).
Memory chi tiết: `~/.claude/projects/-home-clasvr-avpg-portal-avpg/memory/` — **đọc `avp_portal_project_2026-08-06.md` trước khi sửa bất cứ thứ gì**, nó dài nhưng chứa toàn bộ quyết định của user + các bẫy đã dính.

## Máy móc

| Vai trò | Ở đâu |
|---|---|
| Máy dev (đang chạy Claude) | `hcm-clasvr` 10.10.100.128 — **chỉ để code + giữ git key**, không phải server portal |
| Server portal | `hcm-internalsvr` **10.10.100.136** (Ubuntu 24.04, VLAN100), SSH user `internalsvr` |
| Nguồn thật đang chạy | `.136:~/avp-portal` (Angular) + `/opt/avp-portal-api` (FastAPI venv, systemd `avp-portal-api`) |
| Web serve | Apache `/var/www/avp-portal` (SPA) · media `/var/www/avp-portal-media` (ngoài thư mục deploy) |
| DB | PostgreSQL 16 local trên .136, db/role `avpportal` |

Kiến trúc: `Browser --Kerberos--> Apache (GSSAPI) ├─ / → SPA tĩnh └─ /api/* → 127.0.0.1:8000 FastAPI → PostgreSQL + AD`

## Git — đọc kỹ

- Kho `git@github-avpg-portal:arikita/avpg-portal.git`, **nhánh `app`** (orphan), key `~/.ssh/id_ed25519_avpg_portal` (deploy key, chỉ dùng được cho đúng kho này).
- **`main` = site tĩnh cũ đang phục vụ GitHub Pages thật** → **ĐỪNG merge, đừng đẩy đè lên `main`**.
- **`.136:~/avp-portal` KHÔNG phải git repo.** Sửa trên server xong phải kéo về đây rồi commit (key nằm ở clasvr).
- ✅ 18/08/2026: đã đối chiếu md5 từng file — kho này **khớp 100%** với `.136:~/avp-portal` và `/opt/avp-portal-api/app`. Vẫn nên đối chiếu lại nếu ai đó sửa thẳng trên server.

## Luật cứng (đã trả giá mới có)

1. **Sửa nội dung phải làm CẢ HAI**: `PUT /api/content/{module}/{key}` (DB — nguồn đang chạy) **và** file `src/app/content/*.ts` (bản dự phòng trong bundle). Sửa một chỗ là lệch khi API/DB chết.
2. **Bảo mật sống còn**: trong `<Location /api>` phải có `RequestHeader unset X-Remote-User` **TRƯỚC** `RequestHeader set X-Remote-User`. Thiếu = ai cũng mạo danh được.
3. **Sau MỖI lần deploy phải chạy `tools/clean_deploy.py --apply`** — Angular đặt tên file theo hash, `cp` chỉ đè không xoá ⇒ chunk cũ tích luỹ và trình duyệt vẫn chạy code cũ mà không báo lỗi.
4. **Deploy an toàn**: `sudo rm -rf dist` → `ng build` → `test -f dist/avp-portal/browser/index.html` rồi mới copy. Đừng pipe `ng build` vào `tail` (mất exit code — đã từng làm trắng site live).
5. **"Sửa rồi mà vẫn y như cũ"** → kiểm bundle đang chạy TRƯỚC khi nghi ngờ bản sửa: `grep -oh "<selector>\[_ngcontent-%COMP%\]{[^}]*}" /var/www/avp-portal/*.js`, ra >1 kết quả là còn chunk rác.
6. **Lỗi giao diện user báo**: soi ảnh chụp trước, sửa ĐÚNG MỘT thứ, hỏi lại. Không nhân tiện thiết kế lại (13/08 đã bị bắt hoàn tác cả đợt).
7. **Sửa file trên server bằng Python**: dùng SFTP đọc/sửa/ghi, đừng lồng heredoc trong heredoc hay `'''` trong `r'''...'''`.
8. **Đừng xoá bài của user thật** khi dọn dữ liệu test (haivl/Marketing đã đăng bài thật từ 10/08).

## Đăng nhập (sửa 19/08/2026 — bỏ popup Basic)

- Máy join domain: **Kerberos SSO im lặng** như cũ, không thấy trang login.
- Máy khác: `ErrorDocument 401` trả **trang login riêng** `/dang-nhap/` (nguồn `server/apache/login.html` → `/var/www/avp-login/`), ô đầu ghi **"Email"**. POST `/dang-nhap/xac-thuc` → `mod_auth_form` + provider LDAP `avp-upn`/`avp-sam` → phiên trong cookie mã hoá `avpsess` (12h, `/etc/apache2/avp-session.key` root 600). `/dang-nhap/thoat` xoá phiên hỏng rồi về form (nhờ đó máy domain quay lại được đường SSO).
- **Đã bỏ `GssapiBasicAuth On`**: popup của trình duyệt chỉ hiện khi server gửi `WWW-Authenticate: Basic`. Nhãn "Tên người dùng"/"Mật khẩu" trong popup do TRÌNH DUYỆT sinh theo ngôn ngữ máy — server không đổi được, đó là lý do phải làm trang login.
- Nhánh Basic vẫn giữ cho curl/script **tự gửi** `Authorization: Basic`.
- **BẪY: `mod_auth_form` cần `mod_request`** — thiếu thì `apache2ctl configtest` vẫn "Syntax OK" nhưng Apache CHẾT khi restart (19/08 site down ~2 phút). Bật đủ: `auth_form session session_cookie session_crypto request`.
- `/api` dùng form **không** đặt `AuthFormLoginRequiredLocation` → trả 401 sạch cho `fetch()`, không chuyển hướng HTML. Nghiệm thu 19/08: `REMOTE_USER` = `haivl` (sAMAccountName), API 200.
- Bản sao cấu hình: `server/apache/avp-portal.conf`; backup trên server `/etc/apache2/backups/avp-portal.conf.2026-08-19-preform`.

## Module đã có

Nội dung động (content+history, quyền = group AD `Information System`) · Danh bạ từ AD · Tin tức (news: react/comment lồng/poll/thông báo/Web Push/**hẹn giờ phát hành** — timer `avp-news-publish` mỗi phút) · Hồ sơ cá nhân + tường (wall) · Bảng tin `/feed` (**2 cột bên** từ 20/08: thẻ cá nhân, mosaic ảnh AVP Cup, đang trực tuyến, tin mới, poll bỏ phiếu tại chỗ, thành viên mới — gộp trong `GET /api/rail`) · Chat realtime (WebSocket qua vé, PostgreSQL LISTEN/NOTIFY, Web Push cho người đã đóng portal) · Hero slideshow · Auto-login WorkIT.

## Đang treo

- Login read-only `avp_bday_ro` trên Workit DB `.108:14333` (cần cho sinh nhật + khối nhân sự trên hồ sơ) — **chờ user tạo**.
- `SECRETS.md` plaintext trên .136 (có Cloudflare API token khuyến nghị revoke) → nên đẩy sang password manager.
- Sửa poll của bài đã đăng · @mention · avatar từ NAS/AD `thumbnailPhoto` · thống kê hồ sơ chưa cộng bài tường.
