/**
 * Soat trang lam bai kiem tra hoi nhap IT — /onboarding/kiem-tra.
 *
 *   CHROME_BIN=~/chrome-cft/chrome-linux64/chrome \
 *     node tools/audit_quiz.mjs <thu-muc-dist> [src/app/content/quiz.content.ts]
 *
 * Chay tren dist vua build HOAC tren ban DANG PHUC VU (keo /var/www/avp-portal
 * ve roi tro vao day) — cach thu hai moi that su chung minh duoc dieu gi.
 *
 * Dung mot HTTP server tam tra JSON gia cho /api/* nen KHONG can Kerberos,
 * khong dong vao du lieu that.
 *
 * PHEP DO QUAN TRONG NHAT o day la so 4: API gia CO TINH tra ve 3/10 trong khi
 * bai lam cua trinh duyet la 10 cau tra loi bat ky. Neu man ket qua hien 3/10
 * thi diem duoc CHAM O SERVER — dung nhu thiet ke. Neu no hien mot con so khac
 * (vi du 10/10 hay 0/10) thi o dau do trong client da tu tinh diem, tuc la dap
 * an da lot vao bundle va bai kiem tra khong con nghia ly gi. Do la kieu hong
 * khong bao gio nem exception va khong bao gio lam do mot test don vi nao.
 */
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('/home/clasvr/avpg/portal-avpg/node_modules/playwright-core');

const DIST = resolve(process.argv[2]);
const PORT = 8913;
const TYPES = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json',
                '.svg':'image/svg+xml','.ico':'image/x-icon','.woff2':'font/woff2','.png':'image/png','.jpg':'image/jpeg' };

// Diem do API gia tra ve. Chon 3 vi no khong the trung voi bat ky cach tu tinh
// nao cua client trong phep thu duoi (client tra loi du 10 cau).
const DIEM_GIA = 3;
const SAI_GIA = ['usb', 'gui-tai-lieu-nhay-cam', 'dung-luong-dinh-kem', 'helpdesk',
                 'phishing', 'wifi-khach', 'mot-mat-khau'];

const API = {
  '/api/me': { username: 'antv', fullName: 'Tran Van An', department: 'Sales', sso: true },
  '/api/quiz': { total: 10, pool: 50, pass: 8, attempts: 0, best: 0, passed: false, lastAt: '' },
  '/api/notifications': [],
  '/api/content': {},
};

const hit = new Set();
let baiDaGui = null;
/** Moi de bai da duoc gui len, de kiem viec boc 10 trong 50. */
const cacDeDaBoc = [];

const srv = createServer(async (req, res) => {
  const u = decodeURIComponent((req.url || '/').split('?')[0]);
  if (u.startsWith('/api/')) {
    hit.add(u);
    if (u === '/api/quiz/submit' && req.method === 'POST') {
      let raw = '';
      for await (const c of req) raw += c;
      try { baiDaGui = JSON.parse(raw); } catch { baiDaGui = null; }
      if (baiDaGui?.drawn) cacDeDaBoc.push(baiDaGui.drawn);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ score: DIEM_GIA, total: 10, pass: 8,
                                      passed: false, wrong: SAI_GIA }));
    }
    if (req.method !== 'GET') { for await (const c of req) {} res.writeHead(204).end(); return; }
    const b = API[u];
    res.writeHead(b ? 200 : 404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(b ?? { detail: 'khong co' }));
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
  if (m.type() === 'error' && !/Failed to load resource|favicon|WebSocket connection/.test(t)) errs.push('CONSOLE: ' + t);
});

const txt = () => p.evaluate(() => document.body.innerText);
// `.tag` co `text-transform: uppercase` nen innerText tra ve "CÂU 1/10" chu
// khong phai "Câu 1/10". So chuoi tho o day tung bao sai 2 lan — ha ca hai ve
// chu thuong roi moi so.
const co = async (s) => (await txt()).toLowerCase().includes(s.toLowerCase());
const URL_BAI = `http://127.0.0.1:${PORT}/onboarding/kiem-tra`;

// -------------------------------------------------- 1) man gioi thieu ------
await p.goto(URL_BAI, { waitUntil: 'networkidle' });
await p.waitForTimeout(600);
const gioiThieu = await txt();
say(gioiThieu.includes('Kiểm tra hội nhập IT'), 'mở được trang kiểm tra');
say(gioiThieu.includes('8/10'), 'nói rõ điểm đạt TRƯỚC khi bắt đầu', gioiThieu.slice(0, 200));
say(/50/.test(gioiThieu), 'nói rõ đề bốc từ ngân hàng 50 câu', gioiThieu.slice(0, 300));
say(hit.has('/api/quiz'), 'có hỏi server "tôi đã làm bài chưa"');

// --------------------------------------------- 2) di het bai, mot cau mot --
await p.getByRole('button', { name: /Bắt đầu làm bài/ }).click();
await p.waitForTimeout(400);
say(await co('Câu 1/10'), 'bấm Bắt đầu thì vào câu 1');

const soLuaChon = await p.locator('.qz-opt').count();
say(soLuaChon === 4, 'mỗi câu có 4 lựa chọn', `đếm được ${soLuaChon}`);

// Tra loi 9 cau dau, CO TINH bo trong cau cuoi de kiem phan canh bao.
for (let i = 0; i < 9; i++) {
  await p.locator('.qz-opt').nth(i % 4).click();
  await p.waitForTimeout(120);
  await p.getByRole('button', { name: /Câu tiếp theo/ }).click();
  await p.waitForTimeout(180);
}
say(await co('Câu 10/10'), 'đi hết được 10 câu');

// ---------------------------------- 3) chua tra loi het thi khong nop duoc -
const nutNop = p.getByRole('button', { name: /Nộp bài/ });
say(await nutNop.isDisabled(), 'thiếu câu thì nút Nộp bài bị khoá');
const canhBao = await txt();
say(canhBao.includes('Còn câu chưa trả lời'), 'có cảnh báo còn câu chưa trả lời');
say(canhBao.includes('Câu 10'), 'cảnh báo CHỈ RÕ câu nào, không nói chung chung', canhBao.slice(-300));

// Bam vao "Cau 10" trong canh bao thi phai nhay toi dung cau do.
await p.locator('.qz-jump').first().click();
await p.waitForTimeout(300);
say(await co('Câu 10/10'), 'bấm số câu trong cảnh báo thì nhảy tới đúng câu');

// ---------------------------------------------- 4) diem do SERVER cham ----
await p.locator('.qz-opt').first().click();
await p.waitForTimeout(150);
say(!(await nutNop.isDisabled()), 'trả lời đủ thì mở khoá nút Nộp bài');
await nutNop.click();
await p.waitForTimeout(900);

const ketQua = await txt();
say(hit.has('/api/quiz/submit'), 'bài được gửi lên server');
say(baiDaGui && Object.keys(baiDaGui.answers || {}).length === 10,
    'gửi lên đủ 10 câu trả lời', JSON.stringify(baiDaGui).slice(0, 200));
// Server cham theo `drawn`, khong doan tu `answers` — thieu truong nay thi moi
// bai nop deu an 400 va khong ai lam bai duoc.
say(Array.isArray(baiDaGui?.drawn) && baiDaGui.drawn.length === 10
    && new Set(baiDaGui.drawn).size === 10,
    'gửi kèm đúng 10 câu đã bốc, không trùng nhau',
    JSON.stringify(baiDaGui?.drawn));
say(baiDaGui && typeof baiDaGui.seconds === 'number' && baiDaGui.seconds >= 0,
    'có gửi kèm thời gian làm bài');
say(ketQua.includes(`${DIEM_GIA}`) && ketQua.includes('/10'),
    `hiện ĐÚNG điểm server trả về (${DIEM_GIA}/10) — điểm không do client tự tính`,
    ketQua.slice(0, 300));
say(ketQua.includes('Chưa đạt'), 'dưới điểm đạt thì báo Chưa đạt');

// ------------------------------------- 5) sai o dau thi chi cho doc lai ----
const soCauSai = await p.locator('.qz-wrong .card').count();
say(soCauSai === SAI_GIA.length, `liệt kê đủ ${SAI_GIA.length} câu cần xem lại`, `đếm được ${soCauSai}`);
const links = await p.locator('.qz-wrong a').evaluateAll(a => a.map(x => x.getAttribute('href')));
say(links.length === SAI_GIA.length && links.every(h => /#/.test(h || '')),
    'mỗi câu sai đều có đường dẫn tới đúng MỤC trong tài liệu (có #neo)', links.join(' '));
say(links.some(h => (h || '').includes('/regulations')) && links.some(h => (h || '').includes('/onboarding')),
    'đường dẫn trỏ sang cả Quy định IT lẫn trang Hội nhập', links.join(' '));

// ------------------------------------ 6) boc 10 cau tu kho 50 moi luot ----
// Day la ly do doi tu 10 cau co dinh sang kho 50: hai nguoi ngoi canh nhau
// khong duoc nhan cung mot de. Do bang chinh cac de da gui len server.
const lamMotLuot = async () => {
  await p.goto(URL_BAI, { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  await p.getByRole('button', { name: /Bắt đầu|Làm lại/ }).first().click();
  await p.waitForTimeout(300);
  const thuTuLuaChon = [];
  for (let i = 0; i < 10; i++) {
    thuTuLuaChon.push({
      cau: (await p.locator('.qz-q').innerText()).slice(0, 60),
      cac: await p.locator('.qz-opt').evaluateAll(o => o.map(x => x.innerText.slice(0, 30))),
    });
    await p.locator('.qz-opt').first().click();
    await p.waitForTimeout(80);
    if (i < 9) {
      await p.getByRole('button', { name: /Câu tiếp theo/ }).click();
      await p.waitForTimeout(120);
    }
  }
  await p.getByRole('button', { name: /Nộp bài/ }).click();
  await p.waitForTimeout(700);
  return thuTuLuaChon;
};

const cacLuot = [];
for (let i = 0; i < 5; i++) cacLuot.push(await lamMotLuot());

const deSauCung = cacDeDaBoc.slice(-5);
const tatCaCau = new Set(deSauCung.flat());
say(deSauCung.length === 5, 'chạy được 5 lượt liên tiếp', `${deSauCung.length} lượt`);
say(tatCaCau.size > 20,
    `5 lượt bốc ra ${tatCaCau.size} câu khác nhau — đúng là bốc từ kho, không phải đề cố định`,
    `chỉ thấy ${tatCaCau.size} câu; nếu đề cố định thì con số này đúng bằng 10`);

// Hai luot bat ky khong duoc trung nhau hoan toan.
const trungNhauHet = deSauCung.some((a, i) =>
  deSauCung.slice(i + 1).some(b => a.length === b.length && a.every(x => b.includes(x))));
say(!trungNhauHet, 'không có hai lượt nào nhận y hệt một đề');

// De bai phai TRAI DEU CHU DE, khong phai boc bua. Mot luot hoi 4 cau mat khau
// ma khong hoi cau nao ve USB thi khong ket luan duoc gi ve nguoi lam bai —
// xem `bocDe()` trong quiz.ts. Ban do id -> chu de nam o file content; neu
// khong doc duoc thi NOI RO la khong do duoc, khong im lang cho qua.
const NGUON = process.argv[4] || 'src/app/content/quiz.content.ts';
let chuDeCua = null;
try {
  const src = await readFile(resolve(NGUON), 'utf8');
  chuDeCua = new Map([...src.matchAll(/id:\s*'([^']+)',\s*\n\s*topic:\s*'([^']+)'/g)]
    .map(m => [m[1], m[2]]));
} catch { /* khong co file nguon — bao o duoi */ }

if (!chuDeCua || chuDeCua.size < 10) {
  console.log(`  [BO ] không đo được độ trải chủ đề: không đọc được ${NGUON}. ` +
              `Truyền đường dẫn quiz.content.ts làm tham số thứ 2 để đo.`);
} else {
  const soChuDe = new Set([...chuDeCua.values()]).size;
  const thieu = deSauCung
    .map((de, i) => ({ i, n: new Set(de.map(q => chuDeCua.get(q))).size }))
    .filter(x => x.n < soChuDe - 1);
  say(thieu.length === 0,
      `mỗi lượt trải đều ${soChuDe} chủ đề (10 câu / ${soChuDe} chủ đề)`,
      thieu.map(x => `lượt ${x.i + 1} chỉ có ${x.n} chủ đề`).join(', '));
}

// Thu tu LUA CHON trong mot cau cung phai doi. Neu khong, dap an nam nguyen
// mot cho va "cau nay chon o dau tien" truyen tay duoc — trong khi trong kho
// nay dap an dung deu duoc viet o vi tri dau tien cua mang goc.
const theoCau = new Map();
for (const luot of cacLuot) {
  for (const { cau, cac } of luot) {
    if (!theoCau.has(cau)) theoCau.set(cau, []);
    theoCau.get(cau).push(cac.join('|'));
  }
}
const lapLai = [...theoCau.values()].filter(v => v.length > 1);
say(lapLai.length > 0,
    'có câu xuất hiện ở nhiều lượt để so được thứ tự lựa chọn',
    'không câu nào lặp lại trong 5 lượt — tăng số lượt đo lên');
say(lapLai.some(v => new Set(v).size > 1),
    'thứ tự lựa chọn trong một câu được trộn lại giữa các lượt',
    'mọi câu lặp lại đều giữ nguyên thứ tự lựa chọn — đáp án luôn nằm cùng một chỗ');

// ------------------------------------------------- 7) man hinh dien thoai --
// Nhieu nguoi lam bai ngay sau buoi training, tren dien thoai.
//
// DO SO VOI CHINH PORTAL, KHONG SO VOI 0. Thanh dieu huong cua portal
// (`.nav-actions`) da tran san 59px o 390px va 35px o 414px — tren MOI trang,
// ke ca trang chu; do la mot loi co truoc, khong phai cua trang nay. Neu bat
// phep do nay ve 0 thi no do do moi lan chay vi mot ly do khong lien quan, va
// den luc trang kiem tra tu lam hong bo cuc that thi khong ai con doc ket qua
// nua. So sanh voi /onboarding lam moc: trang nay KHONG duoc tran hon.
const tranCua = async (url, stage) => {
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  if (stage) {
    await p.getByRole('button', { name: /Bắt đầu|Làm lại/ }).first().click();
    await p.waitForTimeout(400);
  }
  return p.evaluate(() => ({
    tran: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    // O bam phai du to de bam trung tren dien thoai (khuyen nghi >= 44px).
    oNhoNhat: Math.min(...[...document.querySelectorAll('.qz-opt')].map(e => e.getBoundingClientRect().height), Infinity),
  }));
};

for (const width of [1280, 820, 390]) {
  await p.setViewportSize({ width, height: 900 });
  const moc = await tranCua(`http://127.0.0.1:${PORT}/onboarding`, false);
  const r = await tranCua(URL_BAI, true);
  say(r.tran <= moc.tran, `${width}px: không cuộn ngang hơn phần còn lại của portal`,
      `bài kiểm tra tràn ${r.tran}px, /onboarding tràn ${moc.tran}px`);
  say(r.oNhoNhat >= 44, `${width}px: ô chọn đủ lớn để bấm trên điện thoại`,
      `${Math.round(r.oNhoNhat)}px`);
}

say(errs.length === 0, 'không có lỗi console/pageerror', errs.slice(0, 3).join(' | '));

await b.close();
srv.close();
console.log(fail ? `\n  ${fail} PHÉP ĐO KHÔNG ĐẠT.\n` : '\n  TOÀN BỘ ĐẠT.\n');
process.exit(fail ? 1 : 0);
