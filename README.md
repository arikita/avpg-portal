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

`UPDATE ... RETURNING` là nguyên khối nên hai worker (hoặc timer chạy
trùng lúc) không thể đăng hai lần. Đăng xong tác giả nhận thông báo + Web Push.

Cài lại trên máy chủ:

```bash
sudo cp server/systemd/avp-news-publish.* /etc/systemd/system/
sudo cp server/publish_scheduled.py /opt/avp-portal-api/
sudo systemctl daemon-reload
sudo systemctl enable --now avp-news-publish.timer
```

## Deploy code API — dùng `reload`, KHÔNG dùng `restart`

Service `avp-portal-api` chạy **gunicorn + `uvicorn_worker.UvicornWorker`** (từ 22/08/2026).
Tiến trình master giữ socket lắng nghe; `SIGHUP` thay worker **lần lượt**, nên socket
không bao giờ đóng:

```bash
sudo cp server/app/*.py /opt/avp-portal-api/app/
sudo systemctl reload avp-portal-api      # <-- reload, khong phai restart
```

| Lệnh | Điều gì xảy ra | Người đang online |
|---|---|---|
| `systemctl reload` | SIGHUP, thay worker lần lượt, master giữ socket | **không ai dính** — đo thật: 400 thăm dò TCP + 60 request HTTP, **0 lỗi** |
| `systemctl restart` | giết cả master, socket đóng | ~0,2–0,4 giây bị từ chối kết nối |

Chỉ dùng `restart` khi đổi chính file unit hoặc biến môi trường. Trước 22/08 unit chạy
`uvicorn --workers 2` trực tiếp — uvicorn **bỏ qua SIGHUP**, nên mọi lần deploy đều là
`restart` và giáng 503 xuống người đang dùng (7 ngày = 37 lỗi, có lần 13 người cùng lúc,
**không ai báo cáo**). Đó là BS-20 trong sổ điểm mù của repo giám sát.

⚠️ `uvicorn` ≥ 0.31 **đã xoá `uvicorn.workers`** — phải dùng gói riêng `uvicorn-worker`
và worker class `uvicorn_worker.UvicornWorker`. Viết theo lối cũ thì service không khởi
động nổi, mà `Restart=always` sẽ quay vòng liên tục.

```bash
sudo cp server/systemd/avp-portal-api.service /etc/systemd/system/
sudo systemd-analyze verify /etc/systemd/system/avp-portal-api.service   # bat loi TRUOC
sudo systemctl daemon-reload && sudo systemctl restart avp-portal-api
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
