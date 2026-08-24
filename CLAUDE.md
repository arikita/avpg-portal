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

**Bảng điều khiển quản trị `/admin`** (7 tab, xem mục riêng bên dưới) · Nội dung động (content+history) · Danh bạ từ AD · Tin tức (news: react/comment lồng/poll/thông báo/Web Push/**hẹn giờ phát hành** — timer `avp-news-publish` mỗi phút) · Hồ sơ cá nhân + tường (wall) · Bảng tin `/feed` (**2 cột bên** từ 20/08: thẻ cá nhân, mosaic ảnh AVP Cup, đang trực tuyến, tin mới, poll bỏ phiếu tại chỗ, thành viên mới — gộp trong `GET /api/rail`) · Chat realtime (WebSocket qua vé, PostgreSQL LISTEN/NOTIFY, Web Push cho người đã đóng portal) · Hero slideshow · Auto-login WorkIT.

## Bảng điều khiển quản trị `/admin` (24/08/2026)

Một component `features/admin/admin.ts` + 7 component tab con; đường dẫn là **`/admin/<tab>`**
(`overview` `content` `news` `users` `analytics` `errors` `system`). `/admin` trần = Tổng quan.

- **ĐỪNG đổi `/admin/errors`**: thông báo lỗi tự động gửi link `/admin/errors?id=123` (xem `telemetry.py`),
  đổi đường dẫn là hỏng mọi thông báo đã nằm trong hộp thư người dùng. Tab lỗi đọc `?id=` để mở thẳng.
- Backend `server/app/admin.py` — **6 endpoint CHỈ ĐỌC**, mọi endpoint qua `_require_admin`.
  Ghi vẫn đi đường cũ: `PUT /api/content/*` (có `content_history`), `/api/telemetry/errors/{id}/status`,
  `/api/news/*`. `server/tests/test_admin.py` đọc bảng định tuyến để bắt route quên hàng rào.
- **`smoke_test.py` mong đợi `/api/admin/* = 403`** (chạy dưới user `smoke-test`) — đó là cảm biến bảo mật,
  không phải lỗi cấu hình. Ra 200 nghĩa là allowlist đã mở toang.
- Ba loại quyền, **cố ý không gộp**: vào `/admin` = env `CONTENT_ADMIN_USERS`; ghim/xoá tin = group AD
  `Information System`; đăng tin = group HR/Marketing/IS. Không cấp quyền được từ web.
- Biểu đồ tự vẽ (`features/admin/charts.ts`) — không thư viện (Apache không cho tải CDN).
  **SVG chỉ vẽ nét, chữ/chấm là HTML**: SVG có viewBox sẽ co giãn chữ theo bề rộng thẻ, cột hẹp thì
  nhãn còn ~6px không đọc nổi. Style dùng chung ở `admin.scss` với `ViewEncapsulation.None` —
  **mọi selector trong file đó phải bắt đầu bằng `.adm`**.
- **GA4 trong tab Lượt truy cập — ĐÃ CHẠY 24/08/2026.** `/api/admin/ga4` tự ký JWT RS256 bằng
  `cryptography` + `requests` (có sẵn trong venv, không cài thêm gói Google). Service account
  `avp-portal-ga4@avp-portal-analytics.iam.gserviceaccount.com`, khoá `/etc/avp-portal-ga4.json`
  (`www-data`, 600), bật bằng `GA4_SA_JSON` trong `/etc/avp-portal-api.env`.
  **Đổi biến trong env file phải `systemctl restart`, KHÔNG `reload`** — reload chỉ thay worker, master
  gunicorn giữ môi trường cũ. Chưa có khoá thì endpoint trả hướng dẫn 4 bước chứ không 500.
- **`systemctl reload` KHÔNG giữ được WebSocket.** SIGHUP thay worker gunicorn lần lượt nên request HTTP
  ngắn không rớt, nhưng **mọi kết nối chat của mọi người đang online đều rớt**. Đo được: reload 11:11:39
  → 2 người báo rớt 11:11:45; reload 11:22:48 → 2 người nữa. Client tự nối lại ~1 giây nên người dùng
  hầu như không thấy — đừng ngạc nhiên khi thấy `WebSocketDrop` sau mỗi lần deploy API.
- **Bắt lỗi client — bài học 24/08/2026.** Dead click ban đầu chỉ coi *đổi route* hoặc *gọi API* là
  có phản hồi ⇒ mọi nút phản hồi bằng cách **đổi DOM tại chỗ** (đổi sáng/tối, VI/EN, mở modal, bung
  accordion) đều bị báo chết: 12/18 dòng lỗi là báo động giả, chôn mất `NetworkError` thật. Nay dùng
  `MutationObserver` với cửa sổ **500ms** (không phải 1200ms — trang chủ có slideshow đổi ảnh mỗi 6s,
  cửa sổ dài dễ trùng nhịp tự động và bỏ sót dead click thật). Rage click chỉ xét phần tử bấm được.
  **Dead/rage click là `info`, không phải `error`** — một bảng lỗi toàn báo động giả thì không ai đọc,
  và đó là kiểu hỏng tệ nhất vì không ai nhận ra. Bảng phân loại nằm ở `_severity()` trong
  `telemetry.py`, là **nguồn duy nhất**; có test trong `test_security.py::TestSeverity`.
- **Bẫy deploy**: `.136` KHÔNG có Chrome/playwright nên `tools/deploy.sh` bước 1b (boot check) phải chạy
  `SKIP_BOOT_CHECK=1`. Bù lại: kéo `/var/www/avp-portal` về clasvr rồi chạy `tools/boot_check.mjs` trên
  chính bản đang phục vụ. Đừng bỏ qua bước bù — deploy mù chính là nguyên nhân sự cố 13/08 và 22/08.

## Đang treo

- Login read-only `avp_bday_ro` trên Workit DB `.108:14333` (cần cho sinh nhật + khối nhân sự trên hồ sơ) — **chờ user tạo**.
- `SECRETS.md` plaintext trên .136 (có Cloudflare API token khuyến nghị revoke) → nên đẩy sang password manager.
- **Private key GA4 nằm trong git**: `docs/avp-portal-analytics-d21837f17568.json` ở repo
  `avpg-network-monitoring` (commit `cb3fab8`, đã push `origin/main`) → nên xoá khỏi history + tạo khoá mới.
- Sửa poll của bài đã đăng · @mention · avatar từ NAS/AD `thumbnailPhoto` · thống kê hồ sơ chưa cộng bài tường.
