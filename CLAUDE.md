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
- ✅ 28/08/2026: đối chiếu md5 lại sau khi deploy bài kiểm tra — kho này **khớp 100%** với `.136:~/avp-portal` (224 file src+tools+server) và `/opt/avp-portal-api/app` (15 file). Vẫn nên đối chiếu lại nếu ai đó sửa thẳng trên server.

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
- **Sau khi đăng nhập về ĐÚNG trang đã bấm** (24/08/2026): ô ẩn `httpd_location` trước đây cắm cứng `/`
  nên ai mở link từ thông báo đẩy, đăng nhập xong đều bị nem về trang chủ. Nay JS trong `login.html` đọc
  `location.pathname` — thanh địa chỉ vẫn giữ URL gốc vì Apache trả trang login làm **thân của 401**
  (`ErrorDocument`), không phải redirect. Đích được nhớ trong `sessionStorage` để sống qua màn hình
  "sai mật khẩu". **Bắt buộc lọc `//host` và `/\host`** — giá trị này đi thẳng vào header `Location`,
  không lọc là lỗ hổng chuyển hướng mở. Kiểm bằng `node tools/audit_login_redirect.mjs`.
- **ĐÃ THỬ RỒI HOÀN TÁC (25/08/2026) — đừng làm lại nếu chưa đọc hết mục này.**
  Sáng 25/08 đã sửa ba chỗ để bịt popup Basic cũ: giới hạn IP cho ba nhánh
  `<ElseIf ... =~ /^Basic/>`, đưa `ErrorDocument 401` lên cấp VirtualHost, và cho `<Location /api>`
  một `ErrorDocument 401 "chua dang nhap"` gọn. Đo xong đều đạt. **Chiều cùng ngày user yêu cầu
  hoàn tác toàn bộ** vì nghi các nút trên thanh menu portal hỏng từ lúc đó. Đã khôi phục từ
  `/etc/apache2/backups/avp-portal.conf.2026-08-25-prebasic` và `systemctl reload apache2`.
  **Nguyên nhân thật của việc menu hỏng CHƯA xác định được** — mọi phép đo trên bundle đang phục vụ
  đều cho thấy 6 mục menu chạy bình thường ở 6 bề rộng (`tools/audit_portal_nav.mjs`).
- **Kiến thức vẫn đúng, giữ lại để khỏi mò lại từ đầu:** `GssapiBasicAuth Off` chỉ chặn lượt chào đầu
  tiên. Trình duyệt nào **đã từng gõ vào popup trước 19/08** vẫn tự gửi `Authorization: Basic` ở mọi
  request; Apache rơi vào nhánh Basic, mật khẩu cũ/sai thì trả `WWW-Authenticate: Basic` ⇒ **popup cũ
  hiện lại**, ở cả `/`, `/admin`, `/api/*`, `/media/*`. Đo bằng
  `curl -u nguoidung:matkhausai https://portal...`. Ràng buộc khi làm lại: **e2e Playwright dùng chính
  nhánh Basic đó** (`httpCredentials`), bỏ hẳn Basic thì phải chuyển e2e sang đăng nhập bằng form trước.
- **`ErrorDocument 401` hiện chỉ nằm trong `<Directory /var/www/avp-portal>`**, nên `/media/<ảnh>.jpg`
  và `/api/*` trả **trang 401 trắng của Apache** chứ không phải trang đăng nhập. Đây là trạng thái
  hiện tại sau khi hoàn tác, ghi ra để biết chứ không phải lỗi mới.
- **Kiểm sau mỗi lần đụng auth**: `bash /tmp/probe.sh` chạy **trên .136** (nguồn ở
  `server/apache/probe.sh`) — nó gọi vào `10.10.100.136` chứ không phải `127.0.0.1`, để Apache thấy
  một IP **ngoài** allowlist, tức đóng vai máy nhân viên. Đo từ clasvr là vô nghĩa vì clasvr nằm
  TRONG allowlist.
- Bản sao cấu hình: `server/apache/avp-portal.conf` — **21/08 sửa trên server mà quên kéo về, lệch
  mất phần `CustomLog` + hai khối Zabbix**; 25/08 đã lấy bản live làm gốc. Đối chiếu bằng `diff` trước
  khi sửa. Backup trên server: `/etc/apache2/backups/avp-portal.conf.2026-08-19-preform`,
  `...2026-08-25-prebasic`.

## Module đã có

**Bảng điều khiển quản trị `/admin`** (9 tab, xem mục riêng bên dưới) · Nội dung động (content+history) · Danh bạ từ AD · Tin tức (news: react/comment lồng/poll/thông báo/Web Push/**hẹn giờ phát hành** — timer `avp-news-publish` mỗi phút) · Hồ sơ cá nhân + tường (wall) · Bảng tin `/feed` (**2 cột bên** từ 20/08: thẻ cá nhân, mosaic ảnh AVP Cup, đang trực tuyến, tin mới, poll bỏ phiếu tại chỗ, thành viên mới — gộp trong `GET /api/rail`) · Chat realtime (WebSocket qua vé, PostgreSQL LISTEN/NOTIFY, Web Push cho người đã đóng portal) · Hero slideshow · Auto-login WorkIT · **Kiểm tra hội nhập IT** `/onboarding/kiem-tra` · **Ký cam kết bảo mật** `/onboarding/cam-ket` (đều có mục riêng).

## Bảng điều khiển quản trị `/admin` (24/08/2026)

Một component `features/admin/admin.ts` + 9 component tab con; đường dẫn là **`/admin/<tab>`**
(`overview` `content` `news` `users` `quiz` `cam-ket` `analytics` `errors` `system`). `/admin` trần = Tổng quan.

- **ĐỪNG đổi `/admin/errors`**: thông báo lỗi tự động gửi link `/admin/errors?id=123` (xem `telemetry.py`),
  đổi đường dẫn là hỏng mọi thông báo đã nằm trong hộp thư người dùng. Tab lỗi đọc `?id=` để mở thẳng.
- Backend `server/app/admin.py` — **6 endpoint CHỈ ĐỌC**, mọi endpoint qua `_require_admin`.
  Ghi vẫn đi đường cũ: `PUT /api/content/*` (có `content_history`), `/api/telemetry/errors/{id}/status`,
  `/api/news/*`. `server/tests/test_admin.py` đọc bảng định tuyến để bắt route quên hàng rào.
- **`smoke_test.py` mong đợi `/api/admin/* = 403`** (chạy dưới user `smoke-test`) — đó là cảm biến bảo mật,
  không phải lỗi cấu hình. Ra 200 nghĩa là allowlist đã mở toang.
- Ba loại quyền, **cố ý không gộp**: vào `/admin` = env `CONTENT_ADMIN_USERS`; ghim/xoá tin = group AD
  `Information System`; đăng tin = group HR/Marketing/IS. Không cấp quyền được từ web.
- **Giao diện = template AdminLTE v4.8.5** (25/08/2026). `/admin` chiếm trọn màn hình: sidebar tối +
  navbar riêng, **header/footer portal ẩn hẳn** (`isAdmin()` trong `app.ts`). Xem mục "AdminLTE" bên dưới.
- Biểu đồ tự vẽ (`features/admin/charts.ts`) — không thư viện (Apache không cho tải CDN).
  **SVG chỉ vẽ nét, chữ/chấm là HTML**: SVG có viewBox sẽ co giãn chữ theo bề rộng thẻ, cột hẹp thì
  nhãn còn ~6px không đọc nổi. Style dùng chung ở `admin.scss` với `ViewEncapsulation.None` —
  **mọi selector trong file đó phải bắt đầu bằng `.lte` hoặc `.adm`**.
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
- **Bộ soát trang admin** (viết 24/08/2026, dùng lại thay vì viết lại):
  `python3 tools/audit_admin_api.py` chạy **trên .136** — kiểm hàng rào quyền (admin 200 / người lạ 403),
  hình dạng dữ liệu, thời gian, tham số. `node tools/audit_admin_ui.mjs <dist> tools/fixtures/admin_api.json`
  chạy **trên clasvr** (cần `CHROME_BIN`) — 7 tab × 4 bề rộng × sáng/tối + 13 thao tác thật; dùng API giả
  nên không cần Kerberos, không đụng dữ liệu thật. Trỏ vào `/var/www/avp-portal` kéo về thì mới thật sự
  chứng minh được điều gì.
- **Bảng phải nằm trong `.table-responsive`**, và cột thao tác (Sửa/Ghim/Xoá) dùng `.adm-act-col`
  (sticky phải + `min-width:138px`). Đây là chỗ đã mất nút Xoá 24/08/2026: bảng tràn thì cột thao tác
  trôi ra ngoài tầm nhìn mà không báo gì. `audit_admin_ui.mjs` đo đúng chuyện này ở 4 bề rộng.
- **Bẫy deploy**: `.136` KHÔNG có Chrome/playwright nên `tools/deploy.sh` bước 1b (boot check) phải chạy
  `SKIP_BOOT_CHECK=1`. Bù lại: kéo `/var/www/avp-portal` về clasvr rồi chạy `tools/boot_check.mjs` trên
  chính bản đang phục vụ. Đừng bỏ qua bước bù — deploy mù chính là nguyên nhân sự cố 13/08 và 22/08.

## AdminLTE v4 trong `/admin` (25/08/2026)

Template lấy từ npm `admin-lte@4.8.5` (devDependency). **KHÔNG nạp `adminlte.min.css` trực tiếp**: nó
gói sẵn Bootstrap 5.3 nên định nghĩa đúng `.container` `.card` `.btn` `.row` mà portal đang dùng ở
/feed, /news, /profile, và reset cả `body`/`h1`/`a`. Nạp thẳng là vỡ toàn site.

- `node tools/build_adminlte_css.mjs` **nhốt toàn bộ CSS xuống lớp `.lte`** (postcss) →
  `public/vendor/adminlte-4.8.5.css` (**được commit**, deploy chỉ copy asset) + `adminlte.version.ts`.
  Chạy lại sau mỗi lần nâng `admin-lte`.
- **Lớp trạng thái cấp `<body>` phải GẮN LIỀN, không thành con cháu.** `.sidebar-expand-lg .app-sidebar`
  phải ra `.lte.sidebar-expand-lg …`, không phải `.lte .sidebar-expand-lg …`. Danh sách ở hằng `WRAPPER`
  trong script; **thêm lớp vào thẻ bọc trong `admin.html` thì phải thêm vào `WRAPPER`** — script tự báo
  lỗi nếu quên. Sai chỗ này thì toàn bộ bố cục đáp ứng chết âm thầm (820px thanh bên không chịu trượt ra
  ngoài, nút ☰ bấm không ăn) mà không có một dòng lỗi nào.
- CSS nạp **lười, chỉ khi vào `/admin`**, và chèn bằng `head.prepend` — **prepend chứ không append**:
  AdminLTE là lớp nền, `styles.scss` + `admin.scss` phải nằm sau nó mới ghi đè được.
- **Không nạp JS của AdminLTE** (adminlte.js + Bootstrap JS + Popper ≈ 150KB) — chỉ cần nút thu/mở
  thanh bên, viết thẳng trong `admin.ts` (`sidebar-collapse` màn rộng / `sidebar-open` màn hẹp). Vì thế
  phải tự đặt lớp `app-loaded`, thiếu nó thì header/sidebar bị giữ ở trạng thái ẩn.
- Icon vẫn dùng `app-icon` sẵn có, **không** kéo font bootstrap-icons (CDN bị chặn).
- **`node tools/audit_admin_css_leak.mjs`** — chạy sau mỗi lần sửa `src/styles.scss`. Nó vẽ trang hai
  lần (có / không có stylesheet portal) rồi so computed style: thuộc tính nào portal khai mà Bootstrap
  không khai thì **vẫn lọt vào** dù selector AdminLTE cụ thể hơn. Đã dính 3 lần trong một buổi:
  `.row{gap:12px}` phá lưới 12 cột · `p{color:var(--text-2)}` làm nhãn ô số liệu còn tương phản 2:1 ·
  `svg{max-width:100%}` + flex làm biểu tượng tụt từ 18px xuống 6,7px. Chỗ gỡ nằm cuối `admin.scss`.

## Thư viện ảnh `/gallery` (25/08/2026)

**Ảnh gốc KHÔNG bao giờ copy về `.136`.** Share của hcm-datasvr mount read-only ở `/mnt/avp-share`
bằng Kerberos. Portal chỉ giữ thumbnail 480px (`/var/www/avp-portal-media/gallery/<slug>/thumb/`),
resize ảnh lớn 1600px theo yêu cầu rồi cache ở `/var/cache/avp-portal-gallery`, và đọc thẳng ảnh gốc
khi ai đó bấm tải. Đĩa `.136` chỉ ~19GB — giữ nguyên nguyên tắc này.

- **`server/app/gallery.py`** (tách khỏi `main.py`): 4 route đọc + 7 route quản lý.
  `manage_router` **PHẢI `include_router` TRƯỚC `router`** trong `main.py` — FastAPI khớp route theo
  thứ tự, để sau thì `/api/gallery/manage` rơi vào `/{slug}`. `'manage'` nằm trong `RESERVED` để không
  album nào chiếm mất tên đó, và route Angular `gallery/manage` cũng phải khai trước `gallery/:slug`.
- **Quản lý ở `/gallery/manage`, KHÔNG phải trong `/admin`.** `/admin` chỉ mở cho `CONTENT_ADMIN_USERS`
  (2 người); quyền quản lý ảnh là nhóm đăng tin HR/Marketing/IS (`is_news_author`). Đặt trong `/admin`
  thì đúng những người cần dùng nhất lại không vào được — tức vẫn y nguyên nút thắt cũ: **trước đây
  thêm một album là 3 bước tay trên 2 máy + mật khẩu SMB, nên sau nhiều tháng thư viện vẫn đúng 1 album.**
- Album tạo ra ở trạng thái **`draft`**; `public`/`hidden` do người quản lý chuyển. **Cột bên `/feed`
  phải lọc theo `status`** — logic chọn album nằm ở `gallery.rail_photos()` để MỘT chỗ quyết định
  album nào công khai. Trước 25/08 `rail.py` lấy bừa "album cuối theo thứ tự chữ cái", album nháp lọt
  thẳng ra /feed.
- **Lưới justified, không phải ô vuông**: `flex-grow` = tỉ lệ, `flex-basis` = tỉ lệ × chiều cao hàng.
  Ô vuông cắt cụt ảnh dọc (chân dung mất đầu). Cần `w`/`h` từ API để giữ chỗ trước, nếu không bố cục
  nhảy liên tục khi cuộn — việc sinh thumb ghi kích thước + ngày chụp EXIF vào `album.json`.
  Thẻ `.gal-fill` ở cuối mỗi hàng là **bắt buộc**, thiếu nó thì hàng cuối bị kéo giãn ra quá khổ.
- Cuộn vô hạn bằng `IntersectionObserver` (`rootMargin: 800px`), mỗi lần 150 ảnh — **không bao giờ đổ
  hết 1687 thẻ `<img>` một lúc**.
- **Cỡ thẻ album do Marketing chọn cho TỪNG album** (`size` trong album.json): `noibat` (chiếm cả
  hàng, bìa ngang + chữ bên cạnh) · `thuong` · `gon` (nhỏ, chỉ tên, 1 ảnh bìa). Lưới danh sách là
  **12 cột** để ba cỡ trộn được trong cùng một hàng — `auto-fill` không làm được vì nó chia đều mọi ô.
  Album cũ không có trường `size` → mặc định `thuong`, không được vỡ.
- **Bẫy `1fr` trong lưới bìa mosaic**: `1fr` = `minmax(auto, 1fr)`, và `auto` lấy chiều cao tối thiểu
  **theo ảnh** — ô rộng 232px thì hàng cũng đòi 232px, ba hàng thành 696px trong khung cao 300px rồi
  ảnh thứ tư bị `overflow:hidden` cắt mất. Phải dùng `minmax(0, 1fr)`. Nhìn qua vẫn thấy 3 ảnh nên
  rất dễ bỏ sót — `audit_gallery.mjs` đo "mọi ảnh bìa nằm trọn trong khung".
- **Bốn kiểu bố cục ẢNH BÊN TRONG album, mỗi kiểu giải MỘT việc** (nhớ lựa chọn ở `localStorage['avp.gallery.layout']`):
  `Dòng` justified · `Cột` (`column-count`, nhịp dọc) · `Điểm nhấn` (cứ ảnh thứ `7n+1` chiếm 2×2) ·
  `Ô vuông` (dày đặc, quét nhanh, chấp nhận cắt).
  **`Điểm nhấn` tồn tại vì một lý do cụ thể**: AVP Cup chụp cùng một máy nên mọi ảnh đều 7008×4672 —
  `Dòng` và `Cột` nhìn gần như nhau. Đây là kiểu duy nhất tạo được nhịp bất kể tỉ lệ ảnh nguồn. Dùng
  `7n+1` chứ không `4n+1`: 7 không chia hết cho số cột (4/5/6) nên ô to lệch dần từng hàng thay vì
  xếp thành một cột thẳng tắp.
- **Trình chiếu** (4 giây/ảnh): lightbox tự chạy, ẩn nút điều hướng khi đang chiếu. Dùng cho màn hình
  ở sảnh hoặc trong cuộc họp — đây là thứ biến thư viện thành "bộ mặt tập đoàn" thay vì một kho ảnh.
- **Bẫy khi viết phép đo**: đừng khẳng định "ảnh ngang và ảnh dọc phải rộng khác nhau" một cách vô
  điều kiện — album chụp cùng một máy thì mọi ô rộng bằng nhau và đó là ĐÚNG. `audit_gallery.mjs`
  tự xét album có nhiều tỉ lệ hay không rồi mới đo. Báo động giả thì lần sau không ai đọc kết quả nữa.
- **`node tools/audit_gallery.mjs <dist> <fixture>`** — đo lưới (ảnh cùng hàng cao bằng nhau, ảnh
  ngang/dọc rộng khác nhau), cuộn vô hạn, lightbox, trang quản lý. Fixture chứa tên/email nhân viên
  nên **đừng commit fixture thật**.

## Kiểm tra hội nhập IT `/onboarding/kiem-tra` (28/08/2026)

**ĐÃ CHẠY TRÊN PRODUCTION 28/08/2026** — build `nogit-20260828-162119`.

Bài trắc nghiệm cho nhân viên làm **sau buổi training của phòng IT** — để biết ai đã nắm được, và
(quan trọng hơn) **phần nào của buổi training không vào đầu ai**. **Ngân hàng 50 câu, mỗi lượt bốc
10**, đạt = **8/10**, làm lại không giới hạn.

- **ĐỀ Ở BUNDLE, ĐÁP ÁN Ở SERVER — đừng gộp lại.** Câu hỏi + lựa chọn nằm ở
  `src/app/content/quiz.content.ts` (đi thẳng vào bundle JS, ai mở DevTools cũng đọc được).
  Đáp án là hằng `ANSWERS` trong `server/app/quiz.py`, **chấm điểm chạy ở server**; client chỉ gửi
  lên các `optionId`. Để đáp án vào file content là bài kiểm tra thành vô nghĩa.
- Cái giá của việc tách hai file: chúng có thể lệch nhau mà **không có gì báo lỗi** — đổi tên một
  lựa chọn bên frontend thì từ đó mọi người trả lời câu đó đều SAI. `server/tests/test_quiz.py`
  đọc cả hai file rồi đối chiếu từng ID + khoá `QUIZ_PASS == PASS`.
- **Nộp bài xong chỉ nói "câu nào sai", KHÔNG nói đáp án đúng.** Trả về đáp án là một lần nộp bừa
  lấy được cả bộ đề rồi truyền tay nhau. Người học vẫn biết học lại ở đâu: mỗi câu có trường `ref`
  trỏ tới đúng mục trong `/onboarding` hoặc `/regulations` (dùng `[fragment]`, router đã bật
  `anchorScrolling`).
- **Bốc 10/50 CÂN THEO CHỦ ĐỀ, không bốc bừa** (`bocDe()` trong `quiz.ts`). 9 chủ đề × 1 câu + 1 câu
  tự do. Bốc bừa thì có lượt hỏi 4 câu mật khẩu mà không hỏi câu nào về USB — một lượt như vậy không
  cho IT kết luận được gì. Đo bằng `audit_quiz.mjs` (mọi lượt phải trải đủ 9 chủ đề).
- Kèm trộn thứ tự câu + thứ tự lựa chọn (Fisher-Yates). **Đáp án đúng trong `quiz.content.ts` luôn
  được viết ở vị trí đầu tiên** cho dễ soát — nên nếu trộn lựa chọn hỏng thì mọi đáp án nằm ở ô A mà
  không có gì báo. `audit_quiz.mjs` đo đúng chuyện đó (một câu xuất hiện ở nhiều lượt phải đổi thứ tự).
- **CLIENT bốc, SERVER chấm đúng 10 câu được gửi lên** (`drawn` trong body). Server kiểm hình dạng:
  đúng 10 id, không trùng, đều có thật. Điều này **KHÔNG chặn** người sửa JS để tự chọn 10 câu dễ —
  chấp nhận có ý: bài cho làm lại không giới hạn và mọi lượt đều ghi lại, nên chặn hẳn (server bốc +
  ký đề bằng HMAC hoặc bảng `quiz_draw`) đắt hơn nhiều so với thứ đổi lại được. Ghi ra để sau này ai
  muốn siết còn biết phải làm gì.
- **Câu bỏ trống tính là SAI, không phải 400.** Người ta vừa làm xong bài, đừng bắt làm lại từ đầu vì
  một ô quên bấm — đó là lý do `drawn` phải gửi kèm chứ không suy ra từ `answers`.
- **Giữ MỌI lần làm, không upsert theo username** (`quiz_attempt`, `server/schema_quiz.sql`).
  Đạt 8/10 ngay lần đầu khác hẳn đạt 8/10 ở lần thứ sáu — `/admin` hiện cột "Số lần".
  `quiz.py` tự `CREATE TABLE IF NOT EXISTS` khi dùng lần đầu: deploy quên chạy psql thì 850 người
  bấm Nộp bài gặp 500, quá đắt so với một lệnh idempotent.
- **Phải lưu CẢ `drawn` lẫn `wrong`.** Mẫu số của tỉ lệ sai là **số lần câu đó ĐƯỢC HỎI**, không
  phải tổng số lượt làm bài: kho 50 câu mà mỗi lượt chỉ bốc 10, chia cho tổng lượt thì câu nào cũng
  "ít lỗi" — nói dối bằng số học. `/admin/quiz` đo đúng chuyện này (fixture: 9/12 = 75%, chia nhầm
  thành 53%).
- **Bảng gom theo CHỦ ĐỀ mới là bảng đọc được**, không phải bảng từng câu. Nhờ bốc cân, mỗi chủ đề
  được hỏi ~1 lần/lượt nên mẫu của các chủ đề xấp xỉ bằng nhau và so sánh được; từng câu lẻ thì mẫu
  nhỏ và nhiễu — câu dưới 5 lượt được gắn nhãn **"ít mẫu"** thay vì để nó đứng đầu bảng với 100%
  dựng trên 2 lượt.
- **Xem kết quả ở `/admin/quiz`** (tab thứ 8, `GET /api/admin/quiz` — endpoint chỉ đọc thứ 7 trong
  `admin.py`, qua `_require_admin` như mọi endpoint khác). Tab hiện bảng người + "câu hay sai nhất"
  + **nhân viên mới 90 ngày chưa làm bài** (`recent_accounts`) — cố ý KHÔNG liệt kê cả 850 người,
  bài này dành cho người vừa được training. API chỉ trả **ID câu hỏi**; chữ lấy từ `quiz.content.ts`
  để không có bản thứ hai đi lệch.
- **Kiểm bằng `CHROME_BIN=~/chrome-cft/chrome-linux64/chrome node tools/audit_quiz.mjs <dist>
  [src/app/content/quiz.content.ts]`** (29 phép đo). Quan trọng nhất: API giả **cố tình trả 3/10**
  trong khi trình duyệt trả lời đủ 10 câu — màn kết quả hiện 3/10 thì chứng minh điểm do server chấm.
  Client tự tính điểm là kiểu hỏng không bao giờ ném exception. Nó cũng chạy **5 lượt liên tiếp** rồi
  đếm số câu khác nhau (đề cố định thì con số này đúng bằng 10). Tham số thứ 2 để đo độ trải chủ đề;
  thiếu thì script **in rõ là không đo được**, không im lặng cho qua. Tab admin nằm trong
  `tools/audit_admin_ui.mjs` (nay 8 tab).
- **BẪY khi viết phép đo**: `.tag` có `text-transform: uppercase` nên `innerText` trả về
  `"CÂU 1/10"` chứ không phải `"Câu 1/10"` — so chuỗi thô báo sai 2 lần, phải hạ chữ thường.
- **BẪY khi tạo bảng bằng psql**: chạy `sudo -u postgres psql -f schema_quiz.sql` thì bảng thuộc
  sở hữu của `postgres`, còn API kết nối bằng role `avpportal` ⇒ INSERT bị từ chối, mà `quiz.py`
  nuốt lỗi ghi (cố ý, để người làm bài vẫn thấy điểm) nên **không ai biết là không có dòng nào được
  lưu**. Phải `ALTER TABLE quiz_attempt OWNER TO avpportal` + `ALTER SEQUENCE quiz_attempt_id_seq
  OWNER TO avpportal`. Kiểm bằng cách nộp thật một bài rồi `select count(*)`.
- **`smoke_test.py` phải biết endpoint admin mới**: nó khoá danh sách `/api/admin/* = 403`; thêm
  endpoint thứ 7 mà quên thêm vào đây là mất cảm biến bảo mật cho đúng endpoint mới nhất.
- **Thêm/bớt câu**: sửa `quiz.content.ts` (đề + `topic` + `ref`) **và** `ANSWERS` trong `quiz.py`.
  `test_quiz.py` khoá: cùng bộ id, đáp án phải là một lựa chọn có thật, `QUIZ_PASS`/`QUIZ_DRAW` khớp
  hai bên, mọi câu có chủ đề đã khai báo, **không chủ đề nào rỗng**, và **số chủ đề ≤ số câu bốc**
  (11 chủ đề mà bốc 10 thì có chủ đề không bao giờ được hỏi, và không có gì báo).

## Hội nhập nhiều phòng ban (04/09/2026)

Từ 04/09 hội nhập không còn của riêng IT. **`/onboarding` là trang trung tâm** (thẻ dẫn sang từng
phòng + hai thẻ bắt buộc: bài kiểm tra và ký cam kết); **nội dung hướng dẫn VÀ danh sách việc cần làm
nằm ở `/onboarding/<slug>`**, mỗi phòng một trang. Việc cần làm là **thuộc tính của phòng**
(`PhongBan.checklist`) chứ không phải thứ chung: 8 mục hiện có đều là việc của IT, để ở trang trung
tâm là bắt Nhân sự nhìn việc của IT. Tiến độ vẫn lưu `localStorage` theo id từng mục nên chuyển trang
không làm ai mất đánh dấu đã có. Hiện có `it` và `nhan-su` (Nhân sự chưa có nội
dung, trang tự hiện "đang cập nhật" chứ không ra trang trắng).

- **Thêm một phòng = thêm một phần tử vào `PHONG_BAN`** trong `onboarding.content.ts`. Không sửa
  route, không sửa component — cả hai đều đọc từ danh sách đó.
- **Mỗi phòng khai rõ `module` + tên khoá** thay vì suy theo quy ước: nội dung IT đã nằm trong DB
  dưới module `onboarding` khoá `ONBOARDING_INTRO`/`SECTIONS` từ trước; đổi tên khoá là bản DB và bản
  dự phòng trong bundle lệch nhau ngay (luật số 1). Nhân sự dùng module mới `onboarding_hr`.
- **BẪY THỨ TỰ ROUTE**: `onboarding/:phong` **PHẢI khai SAU** `onboarding/kiem-tra` và
  `onboarding/cam-ket`. Đặt trước thì Angular hiểu `kiem-tra` là tên một phòng ban và **trang bài
  kiểm tra biến mất** — không một dòng lỗi nào. Cùng cái bẫy `gallery/manage`. Hằng `RESERVED` giữ
  chỗ hai tên đó; `audit_onboarding.mjs` đo **tĩnh** trên `app.routes.ts` nên bắt được trước cả khi build.
- **BẪY `input()` không nhận route param**: `input<string>()` chỉ nhận param khi router bật
  `withComponentInputBinding()`, mà `app.config.ts` **không bật** ⇒ mọi trang phòng ban ra "không có
  trang này", im lặng. Dùng `ActivatedRoute.paramMap` + `toSignal` (không dùng `snapshot`: đi từ
  `/onboarding/it` sang `/onboarding/nhan-su` thì Angular dùng lại component, snapshot không đổi).
- **7 đường dẫn "học lại ở đâu" của bài kiểm tra** trỏ vào các mục của IT — nay là `/onboarding/it`.
  Chúng gom trong **một map `REFS`** ở `quiz.content.ts`. Đổi id mục hay đổi đường dẫn mà quên sửa thì
  bấm vào chỉ **đứng yên**, không 404, không lỗi. `audit_onboarding.mjs` mở từng trang đích và kiểm
  từng id có thật trong DOM.
- **Kiểm**: `CHROME_BIN=... node tools/audit_onboarding.mjs <dist>` — 28 phép đo, gồm 6 phép đo tĩnh
  chạy không cần trình duyệt.
- **Đã biết, chưa sửa**: `.c-hint` trong checklist là `display:inline` nên dòng gợi ý dính liền tiêu đề
  ("…email công ty**Đổi mật khẩu lần đầu**"). Lỗi có sẵn từ trước, không phải do đợt tách trang.

## Ký cam kết bảo mật `/onboarding/cam-ket` (04/09/2026)

**ĐÃ CHẠY TRÊN PRODUCTION 04/09/2026** — build `nogit-20260904-111537`.

**THỨ TỰ BẮT BUỘC: `setup_cam_ket.sh` XONG rồi mới `deploy.sh`.** Ngược lại thì deploy luôn thất
bại: `smoke_test.py` khoá `/api/admin/cam-ket = 403`, mà endpoint đó chỉ tồn tại sau khi setup chép
`server/app/*.py` sang `/opt`. Ra 404 là deploy tự khôi phục và dừng — cảm biến làm đúng việc, không
phải lỗi.

Nhân viên mới ký cam kết bảo mật ngay trên portal, nhúng khung ký của **Documenso self-hosted**
(`sign.anvietphatgroup.com`, trên `hcm-procsvr` **10.10.100.130**, sau Caddy, build `f1dd1471`).
Chuỗi hội nhập: đọc `/regulations` → làm `/onboarding/kiem-tra` → ký `/onboarding/cam-ket`.

- **BẪY LỚN NHẤT — font Documenso không có tiếng Việt.** Font nó dùng để dập chữ vào PDF chỉ phủ
  Latin-1: `â ê ô` chạy, còn `ă ư ử ệ ễ` ra **dấu hỏi**. "Nguyễn Văn Thử" thành **"Nguy?n V?n Th?"**.
  Đo trên bản đã ký thật 04/09/2026, không phải suy đoán. Vì vậy **portal tự dập 5 dòng danh tính vào
  PDF** bằng `reportlab` + LiberationSerif TRƯỚC khi đẩy lên; Documenso chỉ còn dập **ảnh chữ ký** và
  **ngày `dd/MM/yyyy`** (toàn ASCII). Lợi thêm: danh tính nằm hẳn trong PDF, không ai sửa được.
  `test_cam_ket.py::TestDapChuTiengViet` đọc ngược chữ ra khỏi PDF và so từng ký tự.
- **Mỗi người một tài liệu riêng, KHÔNG dùng template.** Hệ quả trực tiếp của điều trên. Template #4
  trên Documenso chỉ để **người** xem trước trong giao diện Documenso — **portal không dùng nó**, sửa
  nó không đổi được gì. Nội dung nằm ở `docs/cam-ket-bao-mat.pdf`.
- **Nguồn nội dung là `docs/cam-ket-bao-mat.html`**, không phải file PDF. Sửa xong chạy
  `CHROME_BIN=... node tools/build_cam_ket_pdf.mjs` → sinh lại PDF **và tự đo lại toạ độ ô ký** vào
  `docs/cam-ket-fields.json`. Script cũng bắt **trang tràn nội dung** (`overflow:hidden` làm chữ bị
  cắt mà PDF vẫn trông sạch — đã bắt thật 2 lần) và bắt **logo không nạp được**.
  Đổi nội dung rồi thì chạy `DOCUMENSO_API_KEY=... python3 tools/documenso_camket.py --lam-lai`.
- **`readOnly` + `required` cùng bật ⇒ Documenso trả 500 LÚC MỞ TRANG KÝ**, khung ký trắng. API tạo
  template vẫn 200, không một dòng lỗi nào. Chỉ thấy khi mở bằng trình duyệt thật.
- **Documenso không có tiếng Việt** (enum ngôn ngữ chỉ de/en/fr/es/it/nl/pl/pt-BR/ja/ko/zh) ⇒ nút bên
  trong khung ký là tiếng Anh. Hướng dẫn tiếng Việt **bắt buộc nằm ngoài iframe** — `audit_cam_ket.mjs`
  đo đúng chuyện này, bỏ nó đi thì nhân viên mới nhìn thấy một bảng tiếng Anh không ai giải thích.
- **`/embed/sign/<token>` và `/sign/<token>` trả `frame-ancestors *`** nên nhúng iframe được; riêng
  **trang chủ Documenso là `'self'`** — trỏ nhầm là iframe trắng trơn, không một dòng lỗi nào.
  Portal đặt `X-Frame-Options: SAMEORIGIN` nhưng đó là luật portal **bị** nhúng, không chặn.
- **KHÔNG dùng webhook.** Trạng thái đọc thẳng từ `GET /api/v2/document/{id}` →
  `recipients[].signingStatus` + `signedAt`. Đổi lại: trạng thái chỉ cập nhật khi có ai đó nhìn vào.
- **`token` chỉ đi về cho chính chủ** qua `GET /api/cam-ket`. Nó là thứ duy nhất cần để ký **thay**
  người khác — một `SELECT *` ở `/api/admin/cam-ket` là đủ biến trang quản trị thành công cụ mạo danh
  chữ ký. Có test khoá cả hai chiều.
- **Ai phải ký**: tài khoản AD tạo **từ `CAM_KET_TU_NGAY` trở đi** (mặc định `2026-09-04`). Không đọc
  được `whenCreated` thì trả False — thà bỏ sót một người còn hơn đưa cả 850 người vào diện phải ký vì
  một lỗi tra cứu LDAP.
- **`CAM_KET_MO_THEM` — mở cho đúng một người mà không hạ ngày chốt.** Luật chính chỉ có MỘT mốc
  ngày, không lọc được theo người; muốn cho một người ký thì cách duy nhất còn lại là hạ ngày chốt,
  tức mở cho cả 850 nhân viên cùng lúc. Biến này nhận danh sách ngăn bằng dấu phẩy, **nhận cả
  `haivl` lẫn `haivl@anvietenergy.com`** (người đặt biến nghĩ bằng email, `REMOTE_USER` lại là
  sAMAccountName — bắt hai bên khớp nhau là cái bẫy không bao giờ báo lỗi, chỉ im lặng không mở cho
  ai cả). `/api/admin/cam-ket` cũng ghép họ vào bảng "chưa ký", nếu không thì hai chỗ trong portal
  trả lời khác nhau cho cùng câu hỏi "ai còn thiếu". Xoá bằng `CAM_KET_MO_THEM=""` khi chạy setup.
- **`distributionMethod: NONE` chỉ chặn email MỜI ký**, không chặn email báo hoàn tất (kèm bản đã ký).
  Mặc định không gửi email mời; bật bằng `CAM_KET_GUI_EMAIL=1`.
- **Chuẩn bị máy chủ**: `DOCUMENSO_API_KEY=api_... sudo -E bash tools/setup_cam_ket.sh` **chạy trên
  .136** — 6 bước idempotent: gói `reportlab`+`pypdf`, `fonts-liberation`, tạo bảng **và
  `ALTER TABLE cam_ket OWNER TO avpportal`** (đúng cái bẫy đã nuốt mất dữ liệu `quiz_attempt`), ghi
  env, copy PDF, rồi **`systemctl restart` — KHÔNG `reload`** (reload chỉ thay worker, master
  gunicorn giữ môi trường cũ nên biến mới không được đọc). Kết thúc bằng một lượt gọi thật
  `/api/cam-ket`. `tools/deploy.sh` bước **6c** cũng tự copy PDF + toạ độ ô ký sau mỗi lần deploy.
- **BA BẪY khi triển khai, đã dính đủ cả ba ngày 04/09** (script nay chặn hết, ghi ra để hiểu vì sao
  nó viết như vậy): ① venv nằm ở `/opt/avp-portal-api/**venv**`, không phải `/opt/avp-portal-api` —
  nay script tự đọc `ExecStart=` trong unit systemd chứ không đoán · ② `deploy.sh` **không** chép
  `server/app/*.py`; `README.md:70` ghi đó là lệnh `cp` chạy tay, bỏ sót thì `camket.py` không tới
  `/opt` và `/api/cam-ket` trả 404 trong khi mọi thứ nhìn như đã deploy xong · ③ `sudo -u postgres
  psql -f <file>` bắt user `postgres` mở file nằm trong `/home/internalsvr` ⇒ **Permission denied**;
  phải chuyển hướng stdin để root đọc file.
- **`sudo` xoá sạch biến môi trường**: `SKIP_BOOT_CHECK=1 sudo bash tools/deploy.sh` đặt biến cho
  `sudo` chứ không cho `bash` bên trong ⇒ deploy dừng ở bước 1b. Phải `sudo -E`.
- **Kiểm**: `python3 -m pytest server/tests/test_cam_ket.py` (22 phép đo) và
  `CHROME_BIN=... node tools/audit_cam_ket.mjs <dist>` (32 phép đo, API giả nên không tạo tài liệu
  thật trên Documenso). `smoke_test.py` đã thêm `/api/admin/cam-ket = 403`.

## Quyền trên bài đăng (25/08/2026)

Ba luật, **một nguồn duy nhất** là `server/app/ad.py` (không phải `news.py`/`wall.py`):

| Loại bài | Ai toàn quyền (sửa / xoá / ghim / xoá bình luận) |
|---|---|
| Đời sống (tường, /feed) | **chỉ tác giả bài** — cộng thêm IS |
| Tin tức | tác giả, **và người CÙNG PHÒNG với bài** (trong nhóm đăng tin HR/MKT/IS) — cộng thêm IS |
| Bình luận trên tường | người viết bình luận, **hoặc tác giả bài** — cộng thêm IS |

- Hàm: `can_manage_post(user, author, dept)` · `can_manage_wall_post(viewer, author)` ·
  `can_delete_wall_comment(viewer, comment_author, post_author)`. Test:
  `server/tests/test_quyen_bai_dang.py`.
- **Luật quyền để ở `ad.py` là CỐ Ý**: `news.py` kéo theo `nh3` + `python-multipart`, hai gói chỉ có
  trong venv trên `.136` ⇒ để ở `news.py` thì test **skip im lặng** trên máy dev. Một luật quyền không
  được kiểm là một luật quyền sẽ hỏng.
- **`ast.parse` KHÔNG đủ để gác `news.py`/`wall.py`/`gallery.py`** — 25/08 một lệnh sửa bằng script lỡ
  xoá cả cụm `_conn` `_bi` `_name_of` `_post_row`; cú pháp vẫn đúng, 123 test vẫn qua (ba file này
  không import được ở máy dev), đẩy lên production rồi `/api/news` mới 500
  `NameError: name '_conn' is not defined`. Nay có `server/tests/test_ten_chua_dinh_nghia.py` —
  đọc AST, hỏi đúng một câu "tên này có được định nghĩa ở đâu không", bắt đúng lỗi đó trong 0,05 giây.
  Nó cũng đối chiếu **số cột `POST_COLS` với chỗ bóc tuple trong `_post_row`**: lệch một cột thì không
  có ngoại lệ nào, mọi trường nhảy một bậc.
- **`/api/health` = 200 KHÔNG chứng minh được gì** — lần hỏng trên health vẫn 200 trong khi `/api/news`
  500. Sau mỗi lần deploy API phải gọi thật `/api/news /api/notifications /api/feed /api/rail
  /api/admin/news`.
- **Phòng ban của bài chốt lúc đăng**, lưu ở cột `news_post.author_dept` (`server/schema_news_dept.sql`).
  Chốt chứ không tra AD mỗi lần: người chuyển phòng thì bài cũ vẫn thuộc phòng đã đăng, và tránh gọi
  LDAP trong vòng lặp danh sách. Bài trước 25/08 có cột rỗng → `_post_dept()` **tự tra phòng của tác
  giả**, nên không cần backfill.
- **Tài khoản AD đã tắt KHÔNG được tính là có quyền** — `is_editor` và `_in_group` dùng chung hằng
  `CHUA_TAT` (`userAccountControl` bit 2). Trước 25/08 hai hàm này chỉ hỏi "có trong group không",
  trong khi `list_directory`/`list_people`/`recent_accounts` lại có lọc ⇒ cùng một câu hỏi mà hai chỗ
  trong portal trả lời khác nhau: đếm thiếu lọc ra **63 người đăng tin**, lọc rồi còn **14**
  (HR 11 + MKT 4, `haivl` trùng). Không phải lỗ hổng — tài khoản tắt không lấy được vé Kerberos —
  nhưng phải lọc để mọi phép đếm nói cùng một con số.
  **`get_user` CỐ Ý không lọc**: tên tác giả bài cũ vẫn phải hiện sau khi người đó nghỉ việc.
  Test khoá cả hai chiều trong `test_quyen_bai_dang.py::TestTaiKhoanDaTat`.
- **Hai group `CN=Human Resources` / `CN=Marketing` bị dùng cho HAI việc**: vừa là group phòng ban,
  vừa là `NEWS_AUTHOR_GROUP_DNS`. Thêm ai vào Marketing vì file share/VPN là vô tình cấp quyền đăng
  tin cho 850 người đọc. Chúng cũng chứa người ngoài phòng: `hant` (Assistant Teams) trong HR,
  `tambtt` (CSO, Sustainability) là thành viên **trực tiếp** của Marketing. Luật quyền chốt theo
  `department` nên mấy người này thực tế chỉ sửa được bài của chính mình. Muốn tách bạch thì tạo group
  riêng rồi đổi `NEWS_AUTHOR_GROUP_DNS` trong `/etc/avp-portal-api.env` — không đụng code.
  **Còn 48 tài khoản đã nghỉ nằm trong hai group đó** (40 HR + 8 MKT), nên dọn bên AD.
- **`'' KHÔNG khớp `''`**: tài khoản AD thiếu `department` thì `can_manage_post` trả False. Nếu cho
  khớp thì mọi tài khoản thiếu trường đó bỗng dưng sửa được bài của nhau — mở toang quyền mà không ai
  thấy. Có test riêng.
- **ĐÃ ĐỔI HÀNH VI**: trước đây **chủ tường** xoá được bài/bình luận người khác đăng lên tường mình.
  Yêu cầu mới ("chỉ user đăng bài mới có quyền") bỏ điều đó — nay chủ tường chỉ xoá được bình luận
  trên **bài của chính mình**. Ghi ra vì đây là mất quyền, không phải thêm.
- **Cờ `canManage` tính theo TỪNG dòng, không dùng cờ toàn cục.** `/api/admin/news` và
  `tabs/news.html` trước dùng chung `me.canModerateNews` ⇒ HR/MKT nhìn thấy nút Ghim/Xoá trên bài
  phòng khác rồi bấm mới ăn 403. Backend vẫn là hàng rào thật; cờ chỉ để khỏi bày nút chết.

## Nút "Báo lỗi" — chỉ phòng Information System (25/08/2026)

`<app-bug-report />` bọc trong `@if (isITDept())` ở `app.html`. Điều kiện đọc **`department` của AD**,
không đọc nhóm bảo mật:

- Đây là **lọc hiển thị, không phải hàng rào quyền** — endpoint nhận báo lỗi vẫn mở cho mọi người,
  giấu nút không bịt gì cả. Dùng nhóm AD cho một việc thuần giao diện là gộp nhầm hai thứ mà mục
  quyền ở trên cố ý tách.
- **ĐỪNG dùng `canEdit`**: `huybg` (IT Support) thuộc phòng IS nhưng không nằm trong
  `CONTENT_ADMIN_USERS` → dùng `canEdit` là loại mất anh ấy. Phòng IS có 3 người:
  `arikita`, `haivl`, `huybg`.
- So sánh sau khi `trim().toLowerCase()` để chịu được cách viết lệch trong AD.

**Đánh đổi đã biết**: component này sinh ra vì "nhân viên hiếm khi mở ticket, một nút ngay trên trang
là cách rẻ nhất để biến *portal dạo này lag* thành một dòng tra được" (xem ghi chú đầu
`bug-report.ts`). Giới hạn cho IS tức là **mất kênh đó với 850 người còn lại** — họ quay về Zalo hoặc
chịu đựng. Đây là quyết định của user, ghi lại để sau này ai đọc còn biết cái giá.

## Đang treo

- Login read-only `avp_bday_ro` trên Workit DB `.108:14333` (cần cho sinh nhật + khối nhân sự trên hồ sơ) — **chờ user tạo**.
- `SECRETS.md` plaintext trên .136 (có Cloudflare API token khuyến nghị revoke) → nên đẩy sang password manager.
- **Private key GA4 nằm trong git**: `docs/avp-portal-analytics-d21837f17568.json` ở repo
  `avpg-network-monitoring` (commit `cb3fab8`, đã push `origin/main`) → nên xoá khỏi history + tạo khoá mới.
- **Navbar portal tràn ngang trên điện thoại** (đo 28/08/2026, CHƯA sửa): `.nav-actions` lòi ra
  ngoài **59px ở bề rộng 390px** và **35px ở 414px** — tức iPhone 12/13/14 và bản Plus/Max. Xảy ra
  trên MỌI trang kể cả trang chủ, không phải lỗi của trang nào cụ thể. Phát hiện tình cờ khi viết
  `tools/audit_quiz.mjs`; chưa đụng vì không nằm trong việc user giao. Đo lại bằng
  `document.documentElement.scrollWidth - clientWidth` ở 390px.
- Sửa poll của bài đã đăng · @mention · avatar từ NAS/AD `thumbnailPhoto` · thống kê hồ sơ chưa cộng bài tường.
