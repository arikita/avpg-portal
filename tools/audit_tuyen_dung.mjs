/**
 * Soat cong cu tuyen dung — /tuyen-dung.
 *
 *   CHROME_BIN=~/chrome-cft/chrome-linux64/chrome \
 *     node tools/audit_tuyen_dung.mjs <thu-muc-dist>
 *
 * BA PHEP DO DANG KE:
 *
 *  1. CHO DIEN CON SOT. Noi dung thu dung {xungHo} {hoTen} {anhChi} {viTri}.
 *     Go sai ten mot cho dien — hay them mot cho dien moi vao recruit.content.ts
 *     ma quen khai trong `chen()` — thi thu van soan ra, van gui duoc, chi la
 *     ung vien nhan mot la thu con nguyen dau ngoac. Khong exception, khong
 *     canh bao. Phep do nay soan thu that roi tim dau ngoac trong ket qua.
 *
 *  2. XUNG HO THEO GIOI TINH. Chon Nam phai ra "Mr"/"Anh", Nu ra "Ms"/"Chị",
 *     chua chon ra "Mr/Ms"/"Anh/chị". Sai chieu o day la gui thu goi ung vien
 *     nam bang "Chị" — thu tu choi ma con goi sai xung ho thi con te hon la
 *     khong gui.
 *
 *  3. NGUOI NGOAI HAI PHONG KHONG THAY GI. Nut tren navbar phai an, va vao
 *     thang duong dan phai ra thong bao chu khong phai cai form. Day la loc
 *     hien thi chu khong phai hang rao that (xem ghi chu dau recruit.ts) nen
 *     no cang phai dung — no la thu duy nhat co.
 */
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('/home/clasvr/avpg/portal-avpg/node_modules/playwright-core');

const DIST = resolve(process.argv[2]);
const PORT = 8925;
const TYPES = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json',
                '.svg':'image/svg+xml','.ico':'image/x-icon','.woff2':'font/woff2','.png':'image/png','.jpg':'image/jpeg' };

/** Phong ban cua nguoi dang dang nhap — doi giua cac lan tai trang. */
let phong = 'Human Resources';
/** Truong nhan duoc o lan goi ghep anh gan nhat, de kiem client gui du chua. */
let daNhan = null;
/** Cho endpoint ghep anh tra loi 500 de do duong bao loi. */
let choLoi = false;
// PNG 2x2 hop le, du de trinh duyet hien ra <img>.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC',
  'base64');

const srv = createServer(async (req, res) => {
  const u = decodeURIComponent((req.url || '/').split('?')[0]);
  if (u === '/api/tuyen-dung/anh-chao-mung' && req.method === 'POST') {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    daNhan = Buffer.concat(chunks).toString('latin1');
    if (choLoi) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ detail: 'máy chủ bận, thử lại sau' }));
    }
    res.writeHead(200, { 'Content-Type': 'image/png' });
    return res.end(PNG);
  }
  if (u.startsWith('/api/')) {
    const B = {
      '/api/me': { username: 'lanpt', fullName: 'Phạm Thị Lan', department: phong, sso: true },
      '/api/notifications': [], '/api/content': {},
    }[u];
    res.writeHead(B ? 200 : 404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(B ?? {}));
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
  if (m.type() === 'error' && !/Failed to load resource|favicon|WebSocket/.test(t)) errs.push('CONSOLE: ' + t);
});
const go = async (path) => { await p.goto(`http://127.0.0.1:${PORT}${path}`, { waitUntil: 'networkidle' }); await p.waitForTimeout(700); };
const thu = () => p.locator('.td-noidung textarea').inputValue();
// Hai the deu co `.td-form` (soan thu va ghep anh) nen phai khoanh vung theo
// dac diem rieng cua tung the, khong dung chi so — them mot the nua la chi so
// truot het ma phep do van "qua" o cho khac.
const theThu = () => p.locator('.card:has(.td-noidung)');
const theAnh = () => p.locator('.card:has(input[type="file"])');

// ------------------------------------------------------ 1) Nhan su dung -----
console.log('\n1) Người phòng Nhân sự');
phong = 'Human Resources';
await go('/tuyen-dung');
let t = await p.evaluate(() => document.body.innerText);
say(/Công cụ tuyển dụng/.test(t), 'mở được trang');
say(!/dành cho phòng Nhân sự và Công nghệ thông tin/i.test(t) || /Thư trả lời/.test(t),
    'không bị chặn', t.slice(0, 200));
say((await p.locator('.td-mau button').count()) === 2, 'có 2 mẫu thư');
say((await p.locator('a.icon-btn[href="/tuyen-dung"]').count()) === 1, 'navbar có nút vào trang');

// ------------------------------------------- 2) soan thu + cho dien ---------
console.log('\n2) Soạn thư — chỗ điền phải được thay hết');
await theThu().locator('.td-form input').nth(0).fill('ungvien@example.com');
await theThu().locator('.td-form input').nth(1).fill('Nguyễn Thị Mai');
await theThu().locator('.td-form select').selectOption('Nữ');
await theThu().locator('.td-form input').nth(2).fill('Chuyên viên Nhân sự');
await p.waitForTimeout(400);
let noi = await thu();
// Phep do (1) dau file.
const conNgoac = noi.match(/\{[a-zA-Z]+\}/g);
say(!conNgoac, 'không còn chỗ điền nào chưa thay', `còn: ${(conNgoac || []).join(', ')}`);
say(noi.includes('Nguyễn Thị Mai'), 'thư có họ tên ứng viên');
say(noi.includes('Chuyên viên Nhân sự'), 'thư có vị trí ứng tuyển');
// Phep do (2).
say(noi.includes('Dear Ms. Nguyễn Thị Mai'), 'giới tính Nữ → "Ms"', noi.slice(0, 60));
say(noi.includes('Chị') && !/\bAnh\b/.test(noi), 'giới tính Nữ → xưng "Chị", không lẫn "Anh"',
    noi.slice(0, 200));

await theThu().locator('.td-form select').selectOption('Nam');
await p.waitForTimeout(300);
noi = await thu();
say(noi.includes('Dear Mr. Nguyễn Thị Mai'), 'giới tính Nam → "Mr"');
say(/\bAnh\b/.test(noi) && !/\bChị\b/.test(noi), 'giới tính Nam → xưng "Anh", không lẫn "Chị"');

await theThu().locator('.td-form select').selectOption('');
await p.waitForTimeout(300);
noi = await thu();
say(noi.includes('Mr/Ms') && noi.includes('Anh/chị'),
    'chưa chọn giới tính → "Mr/Ms" và "Anh/chị"', noi.slice(0, 80));

// -------------------------------------------------- 3) doi mau thu ----------
console.log('\n3) Đổi mẫu thư');
const truoc = await thu();
await p.locator('.td-mau button').nth(1).click();
await p.waitForTimeout(300);
const sau = await thu();
say(truoc !== sau, 'đổi mẫu thì nội dung đổi theo');
say(!/\{[a-zA-Z]+\}/.test(sau), 'mẫu thứ hai cũng không còn chỗ điền', sau.slice(0, 200));
say(sau.includes('chưa thực sự phù hợp'), 'mẫu 2 dùng đúng lý do "chưa phù hợp"', sau.slice(0, 300));

// Sua tay roi doi mau thi phai soan lai — giu ban sua la giu dung cai ly do
// vua bi thay ra.
await p.locator('.td-noidung textarea').fill('TÔI SỬA TAY');
await p.locator('.td-mau button').nth(0).click();
await p.waitForTimeout(300);
say((await thu()) !== 'TÔI SỬA TAY', 'sửa tay xong đổi mẫu thì soạn lại từ đầu');

// ---------------------------------------------- 4) nguoi ngoai hai phong ----
console.log('\n4) Người ngoài hai phòng');
phong = 'Sales';
await go('/tuyen-dung');
t = await p.evaluate(() => document.body.innerText);
// Phep do (3) dau file.
say(/dành cho phòng Nhân sự và Công nghệ thông tin/i.test(t),
    'vào thẳng đường dẫn thì báo không thuộc diện', t.slice(0, 200));
say((await p.locator('.td-form').count()) === 0, 'KHÔNG hiện form nào');
say((await p.locator('a.icon-btn[href="/tuyen-dung"]').count()) === 0, 'navbar không có nút');

console.log('\n5) Phòng Công nghệ thông tin');
phong = 'Information System';
await go('/tuyen-dung');
say((await p.locator('.td-form').count()) === 2, 'IT cũng dùng được trang này (2 công cụ)');

// ------------------------------------------- 5b) anh chao mung --------------
// -------------------------------------------- 3b) chuoi mailto -------------
console.log('\n3b) Chuỗi mailto gửi sang Outlook');
phong = 'Human Resources';
await go('/tuyen-dung');
{
  const tt = p.locator('.card:has(.td-noidung)');
  await tt.locator('.td-form input').nth(0).fill('ungvien@example.com');
  await tt.locator('.td-form input').nth(1).fill('Nguyễn Thị Mai');
  await tt.locator('.td-form input').nth(2).fill('Chuyên viên');
  await p.waitForTimeout(300);
  // Bat lai src ma component gan cho iframe an, thay vi de trinh duyet mo that.
  await p.evaluate(() => {
    window.__mailto = [];
    const d = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'src');
    Object.defineProperty(HTMLIFrameElement.prototype, 'src', {
      set(v) { window.__mailto.push(String(v)); },
      get() { return this.getAttribute('src'); }, configurable: true });
  });
  await p.getByRole('button', { name: /Mở trong Outlook/ }).click();
  await p.waitForTimeout(600);
  const url = (await p.evaluate(() => window.__mailto))[0] || '';
  say(url.startsWith('mailto:'), 'có dựng chuỗi mailto', url.slice(0, 60));
  // Day la loi da lam nut khong hoat dong (04/09/2026): `encodeURIComponent`
  // doi `@` thanh `%40`, Outlook khong giai ma phan dia chi.
  say(url.startsWith('mailto:ungvien@example.com?'),
      'địa chỉ người nhận KHÔNG bị mã hoá (@ phải nguyên vẹn)', url.slice(0, 60));
  say(url.includes('subject=') && url.includes('&body='), 'có cả tiêu đề và thân thư');
  // Than thu VAN phai ma hoa — khong thi dau `&` trong ten se cat mat noi dung.
  say(!/[\r\n]/.test(url), 'thân thư đã mã hoá, không còn xuống dòng thô trong URL');
}

console.log('\n5b) Ảnh chào mừng nhân viên mới');
phong = 'Human Resources';
await go('/tuyen-dung');
const nutVe = p.getByRole('button', { name: /Tạo ảnh/ });
say(await nutVe.count() === 1, 'có nút tạo ảnh');
// Chua chon anh, chua nhap ten thi khong duoc bam — goi len server chac chan
// hong, bay mot nut bam duoc de roi bao loi la lam nguoi dung tuong may hong.
say(await nutVe.isDisabled(), 'chưa chọn ảnh thì nút tạo ảnh bị khoá');

const oAnh = p.locator('input[type="file"]');
say(await oAnh.count() === 1, 'có ô chọn ảnh');
await oAnh.setInputFiles({ name: 'chan-dung.png', mimeType: 'image/png', buffer: PNG });
await theAnh().locator('.td-form input[type="text"]').first().fill('Nguyễn Thị Mai');
await p.waitForTimeout(300);
say(!(await nutVe.isDisabled()), 'có ảnh + họ tên thì mở khoá nút');

await nutVe.click();
await p.waitForTimeout(900);
say(!!daNhan, 'có gọi POST /api/tuyen-dung/anh-chao-mung');
// Thieu mot truong o day thi anh ra van dep, chi la trong mot o. Kiem tung ten.
for (const truong of ['name', 'position', 'department', 'phone', 'startDate', 'gender', 'image']) {
  say((daNhan || '').includes(`name="${truong}"`), `gửi lên có trường "${truong}"`);
}
say((await p.locator('.td-anh img').count()) === 1, 'hiện ảnh kết quả');
say((await p.locator('a[download="chao-mung.png"]').count()) === 1, 'có đường tải ảnh về');

console.log('\n5c) Máy chủ báo lỗi');
choLoi = true;
await nutVe.click();
await p.waitForTimeout(900);
const t5 = await p.evaluate(() => document.body.innerText);
say(/máy chủ bận/.test(t5), 'hiện đúng thông báo lỗi từ server', t5.slice(0, 200));
say((await p.locator('.td-anh img').count()) === 0,
    'lỗi thì bỏ ảnh cũ đi, không để người dùng tưởng ảnh mới');
choLoi = false;

console.log('\n6) Lỗi JavaScript');
say(errs.length === 0, 'không có lỗi JS trong suốt phép đo', errs.slice(0, 3).join(' | '));

await b.close(); srv.close();
console.log(fail ? `\n${fail} LỖI.` : '\nKhông lỗi.');
process.exit(fail ? 1 : 0);
