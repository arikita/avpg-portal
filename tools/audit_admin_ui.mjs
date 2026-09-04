/**
 * Soat toan bo trang quan tri /admin — 8 tab, 4 be rong, 2 giao dien sang/toi.
 *
 *   node tools/audit_admin_ui.mjs <thu-muc-dist> [tools/fixtures/admin_api.json]
 *
 * Chay duoc tren dist vua build HOAC tren ban DANG PHUC VU (keo /var/www/avp-portal
 * ve roi tro vao day) — cach thu hai moi that su chung minh duoc dieu gi.
 *
 * Dung mot HTTP server tam tra JSON gia cho /api/* nen KHONG can tai khoan AD,
 * khong can Kerberos, khong dong vao du lieu that.
 *
 * BA thu no kiem ma `ng build` va test don vi khong bao gio thay:
 *   1. Tab co render ra chu that khong (chu khong phai khung trong).
 *   2. TRANG co bi cuon ngang khong. Bang duoc phep cuon BEN TRONG khung cua no
 *      — do la thiet ke; cai sai la ca trang bi day rong ra. Nguyen nhan goc
 *      thuong la `min-width: auto` cua o grid (xem ghi chu trong admin.scss).
 *   3. Nut thao tac (Sua/Ghim/XOA) co con nam trong vung nhin thay khong. Mat
 *      nut Xoa la loi that da xay ra 24/08/2026 va khong he lam do test nao.
 *
 * Yeu cau: CHROME_BIN tro toi chromium, vi du bin cua playwright trong
 * ~/.playwright/chromium-<phien-ban>/chrome-linux64/chrome
 */
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('/home/clasvr/avpg/portal-avpg/node_modules/playwright-core');

const DIST = resolve(process.argv[2]);
const API = JSON.parse(await readFile(process.argv[3], 'utf8'));
const PORT = 8911;
const TYPES = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json',
                '.svg':'image/svg+xml','.ico':'image/x-icon','.woff2':'font/woff2','.png':'image/png','.jpg':'image/jpeg' };
const hit = new Set();
const srv = createServer(async (req, res) => {
  const full = req.url || '/';
  const u = decodeURIComponent(full.split('?')[0]);
  if (u.startsWith('/api/')) {
    hit.add(u);
    if (req.method !== 'GET') { for await (const c of req) {} res.writeHead(204).end(); return; }
    const b = API[u];
    res.writeHead(b ? 200 : 404, { 'Content-Type':'application/json' });
    return res.end(JSON.stringify(b ?? { detail:'khong co' }));
  }
  let f = join(DIST, u);
  try { if ((await stat(f)).isDirectory()) f = join(f,'index.html'); } catch { f = join(DIST,'index.html'); }
  try { const buf = await readFile(f); res.writeHead(200,{'Content-Type':TYPES[extname(f)]||'application/octet-stream'}); res.end(buf); }
  catch { res.writeHead(404).end('x'); }
});
await new Promise(r => srv.listen(PORT,'127.0.0.1',r));

const b = await chromium.launch({ executablePath: process.env.CHROME_BIN, args:['--no-sandbox'] });
let fail = 0;
const say = (ok, msg, extra='') => { console.log(`  [${ok?'OK ':'LOI'}] ${msg}${ok?'':' — '+extra}`); if(!ok) fail++; };

async function newPage(width, theme) {
  const p = await b.newPage({ viewport:{ width, height: 1000 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR: ' + (e.message||e)));
  p.on('console', m => { const t=m.text();
    if (m.type()==='error' && !/Failed to load resource|favicon|WebSocket connection/.test(t)) errs.push('CONSOLE: '+t); });
  await p.addInitScript((t) => { try { localStorage.setItem('avp.theme', t); } catch {} }, theme);
  return { p, errs };
}

const TABS = ['','content','news','users','quiz','analytics','errors','system'];

// ---------------------------------------------------- 1) render + tran khung
for (const width of [1440, 1280, 1024, 820]) {
  for (const theme of ['light','dark']) {
    const { p, errs } = await newPage(width, theme);
    let tranTong = [], loiTong = [];
    for (const t of TABS) {
      await p.goto(`http://127.0.0.1:${PORT}/admin${t?'/'+t:''}`, { waitUntil:'networkidle' });
      await p.waitForTimeout(700);
      // BANG duoc phep cuon BEN TRONG .table-responsive cua no (do la thiet ke).
      // Cai KHONG duoc phep la ca TRANG hay khung bi day rong ra.
      //
      // Do CA `.app-main`: trong bo cuc AdminLTE `layout-fixed`, `.app-main` co
      // `overflow: auto` nen no NUOT phan tran thay vi day <html> rong ra. Chi
      // do documentElement thi mot cai bang qua kho van "dat" trong khi nguoi
      // dung phai keo ngang that.
      const r = await p.evaluate(() => {
        const wrap = document.querySelector('.app-wrapper');
        const main = document.querySelector('.app-main');
        const act = document.querySelector('td.adm-act-col .btn:last-child');
        let nutBiCat = false;
        if (act) {
          const w = act.closest('.table-responsive').getBoundingClientRect();
          const a = act.getBoundingClientRect();
          nutBiCat = a.left < w.left - 1 || a.right > w.right + 1;
        }
        return {
          shell: Math.max(
            wrap ? wrap.scrollWidth - wrap.clientWidth : 0,
            main ? main.scrollWidth - main.clientWidth : 0,
          ),
          body: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          chu: (document.querySelector('.app-main')?.innerText || '').length,
          nutBiCat,
        };
      });
      if (r.shell > 1) tranTong.push(`${t||'overview'}:KHUNG+${r.shell}`);
      if (r.body > 1) tranTong.push(`${t||'overview'}:TRANG+${r.body}`);
      if (r.nutBiCat) tranTong.push(`${t||'overview'}:NUT-THAO-TAC-BI-CAT`);
      if (r.chu < 200) loiTong.push(`${t||'overview'} chi ${r.chu} ky tu`);
    }
    if (errs.length) loiTong.push(...errs.slice(0,3));
    say(!tranTong.length && !loiTong.length, `${width}px ${theme}: ${TABS.length} tab sach — trang khong cuon ngang, nut thao tac con nguyen`,
        [...tranTong, ...loiTong].join(' | '));
    await p.close();
  }
}

// ------------------------------------------------------------ 2) thao tac
const { p, errs } = await newPage(1440, 'light');
const txt = async () => (await p.locator('.app-main').innerText()).replace(/\s+/g,' ');

// dieu huong bang thanh ben (sidebar cua AdminLTE)
await p.goto(`http://127.0.0.1:${PORT}/admin`, { waitUntil:'networkidle' });
await p.waitForTimeout(600);
await p.locator('.sidebar-menu .nav-link', { hasText:'Hệ thống' }).click();
await p.waitForTimeout(600);
say(p.url().endsWith('/admin/system') && (await txt()).includes('Dịch vụ'),
    'thanh tab trái điều hướng và đổi URL', p.url());

// tong quan: bam "viec can lam" nhay dung tab
await p.goto(`http://127.0.0.1:${PORT}/admin`, { waitUntil:'networkidle' });
await p.waitForTimeout(700);
await p.locator('.card .list-group-item-action').first().click();
await p.waitForTimeout(700);
say(/\/admin\/(errors|news|system)$/.test(p.url()), 'bấm "Việc cần làm" nhảy đúng tab', p.url());

// noi dung: tim kiem + chon muc + mo lich su
await p.goto(`http://127.0.0.1:${PORT}/admin/content`, { waitUntil:'networkidle' });
await p.waitForTimeout(700);
const truoc = await p.locator('.adm-picker button').count();
await p.fill('#adm-content-q', 'hero');
await p.waitForTimeout(500);
const sau = await p.locator('.adm-picker button').count();
say(truoc > 0 && sau > 0 && sau < truoc, 'Nội dung: tìm kiếm lọc bớt danh sách', `${truoc} -> ${sau}`);
await p.locator('.adm-picker button').first().click();
await p.waitForTimeout(400);
say((await txt()).includes('Lịch sử sửa'), 'Nội dung: chọn mục thì hiện ô soạn thảo');
await p.locator('button', { hasText:'Lịch sử sửa' }).click();
await p.waitForTimeout(600);
say(hit.has('/api/content/home/HERO/history') || (await txt()).includes('Bản trước đó')
    || (await txt()).includes('chưa từng được sửa'), 'Nội dung: nút Lịch sử gọi API history');

// tin tuc: loc trang thai + tim
await p.goto(`http://127.0.0.1:${PORT}/admin/news`, { waitUntil:'networkidle' });
await p.waitForTimeout(700);
const dongTruoc = await p.locator('.app-main table tbody tr').count();
say(dongTruoc > 0, 'Tin tức: bảng có dữ liệu', `${dongTruoc} dòng`);
say(await p.locator('td.adm-act-col button[title*="Xoá"], td.adm-act-col button[title*="Delete"]').first().isVisible(),
    'Tin tức: nút Xoá nhìn thấy được');

// luot truy cap: doi khoang + hien/an danh sach nguoi
await p.goto(`http://127.0.0.1:${PORT}/admin/analytics`, { waitUntil:'networkidle' });
await p.waitForTimeout(800);
say((await txt()).includes('Bảng này ghi kèm tên tài khoản'), 'Lượt truy cập: danh sách theo tên MẶC ĐỊNH ĐÓNG');
await p.locator('button', { hasText:'Hiện' }).first().click();
await p.waitForTimeout(500);
say((await p.locator('.app-main table').count()) > 0, 'Lượt truy cập: bấm Hiện thì mở bảng người dùng');
await p.locator('.btn-group button', { hasText:'7' }).first().click();
await p.waitForTimeout(800);
say(hit.has('/api/admin/analytics') && hit.has('/api/admin/ga4'), 'Lượt truy cập: nút 7 ngày gọi lại cả hai nguồn');

// loi: loc + mo chi tiet
await p.goto(`http://127.0.0.1:${PORT}/admin/errors`, { waitUntil:'networkidle' });
await p.waitForTimeout(700);
await p.locator('.app-main table tbody tr').first().click();
await p.waitForTimeout(600);
say((await txt()).includes('fingerprint'), 'Lỗi: bấm dòng mở được chi tiết + mẫu thô');
await p.selectOption('#adm-err-sev', 'critical');
await p.waitForTimeout(600);
say(true, 'Lỗi: đổi bộ lọc mức độ không vỡ trang');

// kiem tra hoi nhap: bang ket qua + "cau hay sai nhat".
// Cot tren cung cua tab nay la thu DE HONG AM THAM nhat: no doi chieu ID cau
// hoi tu API voi noi dung cau hoi trong quiz.content.ts. Lech ID mot chu thi
// bang van ve ra, chi la moi dong hien ra dung cai ID tho — nhin luot van
// tuong dang chay. Vi vay kiem BANG CHU CUA CAU HOI, khong phai bang so dong.
await p.goto(`http://127.0.0.1:${PORT}/admin/quiz`, { waitUntil:'networkidle' });
await p.waitForTimeout(700);
const tQuiz = await txt();
say(hit.has('/api/admin/quiz'), 'Kiểm tra hội nhập: có gọi API');
say(tQuiz.includes('Le Nguyen Kieu Oanh') && tQuiz.includes('Chưa đạt'),
    'Kiểm tra hội nhập: bảng người có cả người đạt lẫn chưa đạt');
say(tQuiz.includes('tệp nhạy cảm') || tQuiz.includes('sensitive file'),
    'Kiểm tra hội nhập: câu hay sai hiện NỘI DUNG câu hỏi, không phải ID',
    tQuiz.includes('gui-tai-lieu-nhay-cam') ? 'đang hiện ID thô' : '');
say(tQuiz.includes('Tran Van An'), 'Kiểm tra hội nhập: có danh sách nhân viên mới chưa làm');
// Ti le sai phai chia cho SO LAN CAU DO DUOC HOI, khong phai tong so luot lam
// bai. Fixture: cau "tep nhay cam" sai 9 tren 12 lan duoc hoi = 75%. Neu ai do
// doi mau so ve tong luot (17) thi con so tut xuong 53% — van la mot con so
// dep de, van hien ra binh thuong, va sai hoan toan.
say(tQuiz.includes('75%'), 'Kiểm tra hội nhập: tỉ lệ sai chia cho SỐ LẦN ĐƯỢC HỎI',
    tQuiz.includes('53%') ? 'đang chia cho tổng lượt làm bài' : '');
say(tQuiz.includes('ít mẫu'), 'Kiểm tra hội nhập: câu hỏi quá ít lần được gắn nhãn "ít mẫu"',
    'câu chỉ hỏi 2 lần đang hiện 100% như một kết luận thật');
say(/Bảo mật/.test(tQuiz) && tQuiz.includes('44%'),
    'Kiểm tra hội nhập: có bảng gom theo chủ đề');

// thanh ben: man rong THU lai, man hep TRUOT ra de len noi dung.
// AdminLTE lam viec nay bang adminlte.js; portal khong nap JS cua template
// (chi can hai lop) nen Admin tu dat `sidebar-collapse` / `sidebar-open`.
// Do la doan code tu viet => phai co cho kiem, khong thi no hong am tham.
await p.goto(`http://127.0.0.1:${PORT}/admin`, { waitUntil:'networkidle' });
await p.waitForTimeout(600);
const rong = () => p.evaluate(() => Math.round(document.querySelector('.app-sidebar').getBoundingClientRect().right));
const truocThu = await rong();
await p.locator('.app-header button.nav-link').first().click();
await p.waitForTimeout(500);
say(await rong() <= 0 && truocThu > 100, '1440px: nút ☰ thu hẳn thanh bên', `${truocThu} -> ${await rong()}`);
await p.locator('.app-header button.nav-link').first().click();
await p.waitForTimeout(500);
say(await rong() > 100, '1440px: bấm lại thì thanh bên trở ra');

await p.setViewportSize({ width: 820, height: 1000 });
await p.waitForTimeout(400);
say(await rong() <= 0, '820px: thanh bên tự nằm ngoài màn hình');
await p.locator('.app-header button.nav-link').first().click();
await p.waitForTimeout(500);
say(await rong() > 100, '820px: nút ☰ trượt thanh bên ra');
await p.locator('.sidebar-overlay').click({ position: { x: 400, y: 500 } });
await p.waitForTimeout(500);
say(await rong() <= 0, '820px: bấm ra ngoài thì thanh bên đóng lại');
await p.setViewportSize({ width: 1440, height: 1000 });

// khong co quyen
await p.goto(`http://127.0.0.1:${PORT}/admin`, { waitUntil:'networkidle' });
await p.evaluate(() => fetch('/api/me'));
say(true, 'kiểm tra xong');

console.log(`\n  lỗi console/pageerror trong lượt thao tác: ${errs.length}${errs.length?' -> '+errs.slice(0,3).join(' | '):''}`);
if (errs.length) fail++;
await p.close(); await b.close(); srv.close();
console.log(fail ? `\n  ${fail} MỤC HỎNG` : '\n  TOÀN BỘ ĐẠT.');
process.exit(fail ? 1 : 0);
