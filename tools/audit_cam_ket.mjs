/**
 * Soat trang ky cam ket bao mat — /onboarding/cam-ket va tab /admin/cam-ket.
 *
 *   CHROME_BIN=~/chrome-cft/chrome-linux64/chrome \
 *     node tools/audit_cam_ket.mjs <thu-muc-dist>
 *
 * Chay tren dist vua build HOAC tren ban DANG PHUC VU (keo /var/www/avp-portal
 * ve roi tro vao day) — cach thu hai moi that su chung minh duoc dieu gi.
 *
 * Dung HTTP server tam tra JSON gia cho /api/* nen KHONG can Kerberos, khong
 * dong vao du lieu that va khong tao tai lieu nao tren Documenso.
 *
 * BON PHEP DO DANG KE:
 *
 *  1. NGUOI KHONG THUOC DIEN KHONG DUOC THAY NUT KY. Sai chieu so sanh ngay o
 *     `_thuoc_dien` la 850 nguoi cu bong nhien thay mot ban cam ket phai ky.
 *     Backend van chan (POST tra 403), nhung bay ra mot nut ma bam vao thi bao
 *     loi la kieu hong khong ai bao cao — ho chi bo qua va nghi portal hong.
 *
 *  2. KHUNG KY PHAI TRO DUNG `/embed/sign/`. Tro nham sang trang chu Documenso
 *     thi CSP `frame-ancestors 'self'` chan, iframe ra TRANG TRON — khong mot
 *     dong loi nao trong console cua trang cha.
 *
 *  3. HUONG DAN TIENG VIET PHAI NAM NGOAI IFRAME. Giao dien trong khung ky la
 *     tieng Anh (Documenso khong co ban tieng Viet). Ai do don template roi bo
 *     ba dong huong dan di thi nhan vien moi nhin thay mot bang tieng Anh
 *     khong ai giai thich — van chay, van khong bao loi.
 *
 *  4. KY XONG THI KHONG CON DUONG KY. `signUrl` phai rong khi da ky; con lai
 *     la mot duong con song de mo lai bang link cu.
 */
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('/home/clasvr/avpg/portal-avpg/node_modules/playwright-core');

const DIST = resolve(process.argv[2]);
const PORT = 8917;
const TYPES = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json',
                '.svg':'image/svg+xml','.ico':'image/x-icon','.woff2':'font/woff2','.png':'image/png','.jpg':'image/jpeg' };

const TOKEN_GIA = 'TOKEN-GIA-1234567890';
const KY_URL = `https://sign.anvietphatgroup.com/embed/sign/${TOKEN_GIA}`;

/** Ba trang thai can soat. Doi bang bien `kichBan` giua cac lan tai trang. */
const KICH_BAN = {
  chuaKy: {
    apDung: true, tuNgay: '2026-09-04', joinedAt: '2026-09-10',
    fullName: 'Nguyễn Văn Thử', department: 'Information System',
    title: 'Chuyên viên hệ thống', email: 'thunghiem@anvietenergy.com',
    status: 'CHUA_KY', signedAt: '', signUrl: '',
  },
  dangKy: {
    apDung: true, tuNgay: '2026-09-04', joinedAt: '2026-09-10',
    fullName: 'Nguyễn Văn Thử', department: 'Information System',
    title: 'Chuyên viên hệ thống', email: 'thunghiem@anvietenergy.com',
    status: 'DANG_KY', signedAt: '', signUrl: KY_URL,
  },
  daKy: {
    apDung: true, tuNgay: '2026-09-04', joinedAt: '2026-09-10',
    fullName: 'Nguyễn Văn Thử', department: 'Information System',
    title: 'Chuyên viên hệ thống', email: 'thunghiem@anvietenergy.com',
    status: 'DA_KY', signedAt: '2026-09-11T02:32:13.138Z', signUrl: '',
  },
  ngoaiDien: {
    apDung: false, tuNgay: '2026-09-04', joinedAt: '2019-03-01',
    fullName: 'Trần Thị Cũ', department: 'Sales', title: 'Nhân viên',
    email: 'cu@anvietenergy.com', status: 'CHUA_KY', signedAt: '', signUrl: '',
  },
};

const ADMIN = {
  tuNgay: '2026-09-04',
  signed: 2,
  people: [
    { username: 'antv', fullName: 'Nguyễn Văn An', department: 'Sales',
      email: 'antv@anvietenergy.com', joinedAt: '2026-09-05', status: 'DA_KY',
      createdAt: '2026-09-05T01:00:00Z', signedAt: '2026-09-05T02:00:00Z' },
    { username: 'binhlt', fullName: 'Lê Thị Bình', department: 'Marketing',
      email: 'binhlt@anvietenergy.com', joinedAt: '2026-09-06', status: 'DA_KY',
      createdAt: '2026-09-06T01:00:00Z', signedAt: '2026-09-06T03:00:00Z' },
    { username: 'cuongpv', fullName: 'Phạm Văn Cường', department: 'Logistics',
      email: 'cuongpv@anvietenergy.com', joinedAt: '2026-09-08', status: 'DANG_KY',
      createdAt: '2026-09-08T01:00:00Z', signedAt: '' },
  ],
  chuaKy: [
    { username: 'cuongpv', name: 'Phạm Văn Cường', title: 'Nhân viên kho',
      department: 'Logistics', joinedAt: '2026-09-08' },
    { username: 'dungnt', name: 'Ngô Thị Dung', title: 'Kế toán',
      department: 'Accounting', joinedAt: '2026-09-09' },
  ],
};

let kichBan = 'chuaKy';
const hit = new Set();

const srv = createServer(async (req, res) => {
  const u = decodeURIComponent((req.url || '/').split('?')[0]);
  if (u.startsWith('/api/')) {
    hit.add(`${req.method} ${u}`);
    if (u === '/api/cam-ket/ky' && req.method === 'POST') {
      for await (const _ of req) { /* nuot body */ }
      kichBan = 'dangKy';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(KICH_BAN.dangKy));
    }
    const B = {
      '/api/me': { username: 'thunghiem', fullName: 'Nguyễn Văn Thử',
                   department: 'Information System', canEdit: true, sso: true },
      '/api/cam-ket': KICH_BAN[kichBan],
      '/api/admin/cam-ket': ADMIN,
      '/api/notifications': [],
      '/api/content': {},
    }[u];
    res.writeHead(B ? 200 : 404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(B ?? { detail: 'khong co' }));
  }
  let f = join(DIST, u);
  try { if ((await stat(f)).isDirectory()) f = join(f, 'index.html'); } catch { f = join(DIST, 'index.html'); }
  try { const buf = await readFile(f); res.writeHead(200, { 'Content-Type': TYPES[extname(f)] || 'application/octet-stream' }); res.end(buf); }
  catch { res.writeHead(404).end('x'); }
});
await new Promise(r => srv.listen(PORT, '127.0.0.1', r));

const b = await chromium.launch({ executablePath: process.env.CHROME_BIN, args: ['--no-sandbox'] });
let fail = 0;
const say = (ok, msg, extra = '') => {
  console.log(`  [${ok ? 'OK ' : 'LOI'}] ${msg}${ok ? '' : ' — ' + extra}`);
  if (!ok) fail++;
};

const errs = [];
const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
p.on('pageerror', e => errs.push('PAGEERROR: ' + (e.message || e)));
p.on('console', m => {
  const t = m.text();
  // Khung ky that khong ton tai trong phep do nay (mien sign.* khong goi
  // duoc tu day) nen loi tai iframe la binh thuong, khong tinh.
  if (m.type() === 'error' && !/Failed to load resource|favicon|WebSocket|ERR_NAME|ERR_CONNECTION/.test(t))
    errs.push('CONSOLE: ' + t);
});
const txt = () => p.evaluate(() => document.body.innerText);
const URL_KY = `http://127.0.0.1:${PORT}/onboarding/cam-ket`;

// ------------------------------------------------- 1) nguoi CHUA ky --------
console.log('\n1) Nhân viên mới, chưa ký');
await p.goto(URL_KY, { waitUntil: 'networkidle' });
await p.waitForTimeout(700);
let t = await txt();
say(t.includes('Cam kết bảo mật thông tin'), 'mở được trang ký');
say(hit.has('GET /api/cam-ket'), 'có hỏi server trạng thái đã ký chưa');
say(t.includes('Nguyễn Văn Thử'), 'hiện họ tên lấy từ AD', t.slice(0, 200));
say(t.includes('Chuyên viên hệ thống'), 'hiện chức danh lấy từ AD');
say(t.includes('thunghiem@anvietenergy.com'), 'hiện email lấy từ AD');
say(/không sửa được|cannot edit/i.test(t),
    'nói rõ danh tính do AD điền, người ký không sửa được', t.slice(0, 400));
say(await p.getByRole('button', { name: /Đọc và ký/ }).count() > 0, 'có nút ký');
say((await p.locator('iframe').count()) === 0,
    'CHƯA bấm ký thì chưa nhúng khung ký — không tạo tài liệu khi người ta chỉ ghé qua');

// ------------------------------------------------- 2) bam ky --------------
console.log('\n2) Bấm ký → nhúng khung ký');
await p.getByRole('button', { name: /Đọc và ký/ }).click();
await p.waitForTimeout(1200);
t = await txt();
say(hit.has('POST /api/cam-ket/ky'), 'có gọi POST /api/cam-ket/ky');
const iframes = p.locator('iframe');
say(await iframes.count() === 1, 'nhúng đúng một khung ký', String(await iframes.count()));
const src = await iframes.first().getAttribute('src');
// Phep do (2) dau file: tro nham la iframe trang tron, khong mot dong loi nao.
say((src || '').includes('/embed/sign/'),
    'khung ký trỏ vào /embed/sign/ chứ không phải trang chủ Documenso', String(src));
say((src || '').includes(TOKEN_GIA), 'khung ký dùng đúng token server trả về', String(src));
// Phep do (3): huong dan tieng Viet phai nam NGOAI iframe.
say(/Đọc hết 3 trang/.test(t), 'có hướng dẫn tiếng Việt bước 1 ngoài khung ký');
say(/Signature/.test(t) && /gõ tên/.test(t), 'hướng dẫn nói rõ thao tác trong khung tiếng Anh');
say(/tiếng Anh/.test(t), 'nói trước cho người dùng biết khung ký là tiếng Anh', t.slice(0, 600));
say(await p.getByRole('button', { name: /Tôi đã ký xong/ }).count() > 0,
    'có nút tự báo đã ký xong (iframe khác origin nên portal không tự biết)');

// PHEP DO QUAN TRONG NHAT o day (them 04/09/2026 sau khi user bao loi that):
// khung ky KHONG DUOC tai lai trong luc nguoi ta dang ky.
//
// Trang nay hoi lai trang thai moi 5 giay. `bypassSecurityTrustResourceUrl()`
// tra ve OBJECT MOI moi lan goi, ke ca khi chuoi URL y het — nen neu computed
// goi lai no sau moi luot hoi, Angular so sanh theo THAM CHIEU, thay "doi",
// va gan lai src. Iframe tai lai moi 5 giay, nguoi dang ky do mat sach thao
// tac. Khong mot dong loi nao trong console.
//
// Do bang MutationObserver dem so lan thuoc tinh `src` bi gan lai — do la
// dung dinh nghia cua loi, khong phai mot dau hieu gian tiep.
await p.evaluate(() => {
  const f = document.querySelector('iframe');
  window.__lanGanSrc = 0;
  new MutationObserver(ms => { for (const m of ms) if (m.attributeName === 'src') window.__lanGanSrc++; })
    .observe(f, { attributes: true, attributeFilter: ['src'] });
});
// Doi qua 2 luot hoi (5s/luot) roi moi ket luan.
await p.waitForTimeout(12000);
const ganLai = await p.evaluate(() => window.__lanGanSrc);
say(ganLai === 0, `khung ký KHÔNG bị gán lại src trong 12s (qua 2 lượt hỏi lại)`,
    `bị gán lại ${ganLai} lần — iframe tải lại, người đang ký mất thao tác`);
say((await p.locator('iframe').count()) === 1, 'vẫn đúng một khung ký sau khi hỏi lại');

// ------------------------------------------------- 3) da ky ---------------
console.log('\n3) Đã ký xong');
kichBan = 'daKy';
await p.goto(URL_KY, { waitUntil: 'networkidle' });
await p.waitForTimeout(700);
t = await txt();
say(/Bạn đã ký bản cam kết/.test(t), 'hiện trạng thái đã ký', t.slice(0, 200));
say((await p.locator('iframe').count()) === 0,
    'ký xong thì bỏ khung ký — signUrl rỗng, không còn đường ký lại');
const tai = p.locator('a[href="/api/cam-ket/ban-da-ky"]');
say(await tai.count() === 1, 'có đường tải bản đã ký');
say(/11\/09\/2026|11:|09:/.test(t), 'hiện thời điểm ký', t.slice(0, 300));

// ------------------------------------------ 4) khong thuoc dien -----------
console.log('\n4) Người vào làm trước ngày chốt');
kichBan = 'ngoaiDien';
await p.goto(URL_KY, { waitUntil: 'networkidle' });
await p.waitForTimeout(700);
t = await txt();
// Phep do (1) dau file.
say(await p.getByRole('button', { name: /Đọc và ký/ }).count() === 0,
    'KHÔNG bày nút ký cho người không thuộc diện');
say(/không thuộc diện/i.test(t), 'nói rõ vì sao không phải ký', t.slice(0, 300));
say(/2026-09-04/.test(t), 'nêu đúng ngày chốt lấy từ server');
say(/Quy định IT/.test(t), 'vẫn chỉ đường sang Quy định IT — luật bảo mật áp dụng cho mọi người');

// ------------------------------------------------- 5) tab admin -----------
console.log('\n5) Tab quản trị /admin/cam-ket');
await p.goto(`http://127.0.0.1:${PORT}/admin/cam-ket`, { waitUntil: 'networkidle' });
await p.waitForTimeout(900);
t = await txt();
say(hit.has('GET /api/admin/cam-ket'), 'có gọi /api/admin/cam-ket');
say(/Chưa ký/.test(t), 'có bảng "Chưa ký"');
say(/Ngô Thị Dung/.test(t), 'liệt kê người chưa ký', t.slice(0, 400));
say(/Phạm Văn Cường/.test(t), 'người đang ký dở cũng nằm trong danh sách chưa ký');
// Bang "chua ky" phai dung TRUOC bang "da ky" — do la thu phong IT can nhin.
// So theo TIEU DE BANG (.card-title), khong so vi tri trong innerText: o so
// lieu phia tren cung co chu "Da ky" nen so chuoi tho bao sai.
const tieuDe = await p.locator('.card-title').allInnerTexts();
const iChua = tieuDe.findIndex(x => /Chưa ký/.test(x));
const iDa = tieuDe.findIndex(x => /^\s*Đã ký/.test(x.trim()));
say(iChua >= 0 && iDa > iChua, 'bảng "Chưa ký" đứng trước bảng "Đã ký"',
    JSON.stringify(tieuDe));
say(/50/.test(t) || /%/.test(t), 'có tỉ lệ hoàn thành');
// Token khong duoc xuat hien o bat ky dau trong trang quan tri.
const html = await p.content();
say(!html.includes(TOKEN_GIA) && !/\btoken\b/i.test(t),
    'trang quản trị KHÔNG lộ token ký của bất kỳ ai');

// ------------------------------------------------- ket qua ----------------
console.log('\n6) Lỗi JavaScript');
say(errs.length === 0, 'không có lỗi JS trong suốt phép đo', errs.slice(0, 3).join(' | '));

await b.close(); srv.close();
console.log(fail ? `\n${fail} LỖI.` : '\nKhông lỗi.');
process.exit(fail ? 1 : 0);
