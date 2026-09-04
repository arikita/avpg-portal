/**
 * Soat bo cuc hoi nhap nhieu phong ban — /onboarding va /onboarding/<slug>.
 *
 *   CHROME_BIN=~/chrome-cft/chrome-linux64/chrome \
 *     node tools/audit_onboarding.mjs <thu-muc-dist>
 *
 * BA PHEP DO DANG KE, ca ba deu bat kieu hong KHONG ném lỗi:
 *
 *  1. THU TU ROUTE. `onboarding/:phong` ma khai truoc `onboarding/kiem-tra`
 *     thi Angular hieu 'kiem-tra' la ten mot phong ban: trang bai kiem tra
 *     BIEN MAT, thay vao do la trang "khong co phong nay". Khong mot dong loi
 *     nao trong console. Cung cai bay `gallery/manage` da ghi trong CLAUDE.md.
 *
 *  2. DUONG DAN "HOC LAI O DAU" CUA BAI KIEM TRA. Moi cau hoi tro toi mot muc
 *     trong /onboarding/it bang fragment. Doi duong dan hay doi id cua muc thi
 *     trinh duyet chi... khong cuon di dau ca. Khong 404, khong loi. Phep do
 *     nay mo dung trang do va kiem TUNG id co that trong DOM.
 *
 *  3. PHONG CHUA CO NOI DUNG. Nhan su dang cho gui bai. Trang phai noi "dang
 *     cap nhat" chu khong duoc ra mot trang trang tron — nguoi doc can biet la
 *     CHUA CO, khong phai la HONG.
 */
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('/home/clasvr/avpg/portal-avpg/node_modules/playwright-core');

const DIST = resolve(process.argv[2]);
const SRC = resolve(process.argv[3] || 'src/app/content/quiz.content.ts');
const PORT = 8921;
const TYPES = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json',
                '.svg':'image/svg+xml','.ico':'image/x-icon','.woff2':'font/woff2','.png':'image/png','.jpg':'image/jpeg' };

const API = {
  '/api/me': { username: 'antv', fullName: 'Trần Văn An', department: 'Sales', sso: true },
  '/api/quiz': { total: 10, pool: 50, pass: 8, attempts: 0, best: 0, passed: false, lastAt: '' },
  '/api/cam-ket': { apDung: false, tuNgay: '2026-09-04', joinedAt: '2020-01-01', fullName: 'Trần Văn An',
                    department: 'Sales', title: '', email: 'antv@anvietenergy.com',
                    status: 'CHUA_KY', signedAt: '', signUrl: '' },
  '/api/notifications': [],
  '/api/content': {},
};

const srv = createServer(async (req, res) => {
  const u = decodeURIComponent((req.url || '/').split('?')[0]);
  if (u.startsWith('/api/')) {
    const b = API[u];
    res.writeHead(b ? 200 : 404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(b ?? {}));
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
const txt = () => p.evaluate(() => document.body.innerText);
const go = async (path) => { await p.goto(`http://127.0.0.1:${PORT}${path}`, { waitUntil: 'networkidle' }); await p.waitForTimeout(600); };

// ------------------------------- 0) hai phep do TINH, khong can trinh duyet --
// Chung bat bay TRUOC khi build, va bat ke ca khi ai do quen chay phan sau.
console.log('\n0) Kiểm tĩnh trên mã nguồn');
{
  const nd = await readFile('src/app/content/onboarding.content.ts', 'utf8');
  const slugs = [...nd.matchAll(/^\s*slug:\s*'([^']+)'/gm)].map(m => m[1]);
  const reserved = (nd.match(/RESERVED\s*=\s*\[([^\]]*)\]/) || [, ''])[1]
    .split(',').map(x => x.trim().replace(/^'|'$/g, '')).filter(Boolean);
  say(slugs.length >= 2, `khai báo ${slugs.length} phòng ban: ${slugs.join(', ')}`);
  const dam = slugs.filter(x => reserved.includes(x));
  say(dam.length === 0, `không phòng nào chiếm tên đã có chủ (${reserved.join(', ')})`,
      `đụng: ${dam.join(', ')} — phòng này sẽ nuốt mất trang cùng tên`);
  say(new Set(slugs).size === slugs.length, 'không có slug trùng nhau');

  // Thu tu route: dong `onboarding/:phong` PHAI nam SAU cac route cu the.
  const rt = (await readFile('src/app/app.routes.ts', 'utf8')).split('\n');
  const dong = (m) => rt.findIndex(l => l.includes(m));
  const iPhong = dong("path: 'onboarding/:phong'");
  const cuThe = reserved.map(r => ({ r, i: dong(`path: 'onboarding/${r}'`) }));
  say(iPhong > 0, 'có route onboarding/:phong');
  for (const { r, i } of cuThe) {
    say(i > 0 && i < iPhong, `onboarding/${r} khai TRƯỚC onboarding/:phong`,
        `dòng ${i + 1} vs ${iPhong + 1} — đặt sau thì trang này bị nuốt, không báo lỗi`);
  }
}

// ---------------------------------------------------- 1) trang trung tam ----
console.log('\n1) /onboarding — trang trung tâm');
await go('/onboarding');
let t = await txt();
say(/Hành trình nhân viên mới/.test(t), 'mở được trang hội nhập');
// Danh sach viec can lam da chuyen sang trang tung phong (04/09/2026): 8 muc
// hien co deu la viec cua IT, de o trang trung tam la bat Nhan su nhin viec
// cua IT.
say(!/Danh sách việc cần làm/.test(t),
    'danh sách việc cần làm KHÔNG còn ở trang trung tâm', 'vẫn còn ở đây');
say(/Công nghệ thông tin/.test(t) && /Nhân sự/.test(t), 'có thẻ cả hai phòng ban', t.slice(0, 300));
// Noi dung huong dan KHONG duoc con nam o day nua — de lai la hai ban song song.
// Do bang SO KHOI `article[data-sec]`, khong so chuoi: checklist o trang nay
// van nhac ten cac muc ("Kết nối Wi-Fi"...) va do la dung, so chuoi tho se
// bao dong gia.
say((await p.locator('article[data-sec]').count()) === 0,
    'nội dung hướng dẫn đã rời khỏi trang trung tâm', 'vẫn còn khối nội dung ở đây');
say(/Đang cập nhật/.test(t), 'thẻ Nhân sự ghi rõ đang cập nhật');
const theIT = await p.locator('a[href="/onboarding/it"]').count();
say(theIT === 1, 'thẻ IT dẫn đúng /onboarding/it', String(theIT));
// Hai the bat buoc da chuyen xuong trang phong (04/09/2026): bai kiem tra gan
// voi noi dung vua doc nen phai nam ngay duoi noi dung do.
say((await p.locator('a[href="/onboarding/kiem-tra"]').count()) === 0
    && (await p.locator('a[href="/onboarding/cam-ket"]').count()) === 0,
    'thẻ bài kiểm tra / cam kết KHÔNG còn ở trang trung tâm');

// ------------------------------------------------------- 2) trang phong -----
console.log('\n2) /onboarding/it — phòng đã có nội dung');
await go('/onboarding/it');
t = await txt();
say(/Công nghệ thông tin/.test(t), 'mở được trang phòng IT');
say(/Kết nối Wi-Fi/.test(t) && /Sử dụng Outlook/.test(t), 'render đủ các mục', t.slice(0, 200));
const soMuc = await p.locator('article[data-sec]').count();
say(soMuc >= 8, `có ${soMuc} mục (mong đợi ≥ 8)`);
const soNav = await p.locator('aside.side a').count();
say(soNav === soMuc, 'mục lục bên cạnh khớp số mục', `${soNav} mục lục / ${soMuc} mục`);
say(/Danh sách việc cần làm/.test(t), 'danh sách việc cần làm nằm ở trang IT');
const soViec = await p.locator('button.check').count();
say(soViec === 8, `có ${soViec} việc cần làm (mong đợi 8)`);
// Bam mot muc phai doi tien do — day la thu nguoi dung thuc su dung.
await p.locator('button.check').first().click();
await p.waitForTimeout(300);
say((await txt()).includes('1/8'), 'bấm một mục thì tiến độ lên 1/8',
    'tiến độ không đổi — ProgressService không nối đúng');
say((await p.locator('a[href="/onboarding/kiem-tra"]').count()) === 1,
    'trang IT có thẻ làm bài kiểm tra');
say((await p.locator('a[href="/onboarding/cam-ket"]').count()) === 1,
    'trang IT có thẻ ký cam kết');

console.log('\n3) /onboarding/nhan-su — phòng chưa có nội dung');
await go('/onboarding/nhan-su');
t = await txt();
say(/Nhân sự/.test(t), 'mở được trang Nhân sự');
// Phep do (3) dau file.
say(/Đang cập nhật/.test(t), 'nói rõ đang cập nhật, không phải trang trắng', t.slice(0, 200));
say((await p.locator('article[data-sec]').count()) === 0, 'chưa render mục nào');
say(!/Danh sách việc cần làm/.test(t),
    'Nhân sự chưa khai việc cần làm thì không hiện khối rỗng');
// Phong chua co bai kiem tra rieng thi KHONG duoc bay the dan toi bai cua IT.
say((await p.locator('a[href="/onboarding/kiem-tra"]').count()) === 0,
    'Nhân sự chưa có bài kiểm tra riêng thì không bày thẻ dẫn tới bài của IT');
say((await p.locator('a[href="/onboarding/cam-ket"]').count()) === 0,
    'thẻ ký cam kết chỉ nằm ở trang IT');

console.log('\n4) /onboarding/khong-co-that — slug sai');
await go('/onboarding/khong-co-that');
t = await txt();
say(/Không có trang hội nhập này/.test(t), 'báo rõ không có trang, có đường về', t.slice(0, 200));

// ------------------------------------------- 5) BAY THU TU ROUTE ------------
console.log('\n5) Thứ tự route — hai đường dẫn cũ KHÔNG được bị nuốt');
await go('/onboarding/kiem-tra');
t = await txt();
// Phep do (1) dau file: day la thu de gay nhat khi them route :phong.
say(/Kiểm tra hội nhập IT/.test(t) && !/Không có trang hội nhập này/.test(t),
    '/onboarding/kiem-tra vẫn ra trang bài kiểm tra', t.slice(0, 200));
await go('/onboarding/cam-ket');
t = await txt();
say(/Cam kết bảo mật/.test(t) && !/Không có trang hội nhập này/.test(t),
    '/onboarding/cam-ket vẫn ra trang ký cam kết', t.slice(0, 200));

// ------------------------------- 6) duong dan "hoc lai o dau" cua bai kiem tra
console.log('\n6) Đường dẫn "học lại ở đâu" của bài kiểm tra');
const nguon = await readFile(SRC, 'utf8');
const refs = [...nguon.matchAll(/path:\s*'([^']+)'\s*,\s*frag:\s*'([^']+)'/g)]
  .map(([, path, frag]) => ({ path, frag }));
say(refs.length > 0, `đọc được ${refs.length} đường dẫn từ quiz.content.ts`);
const onb = refs.filter(r => r.path.startsWith('/onboarding'));
say(onb.every(r => r.path !== '/onboarding'),
    'không còn đường dẫn nào trỏ vào /onboarding trần (nội dung đã dời)',
    JSON.stringify(onb.filter(r => r.path === '/onboarding')));
// Phep do (2): mo tung trang dich va kiem id co that trong DOM.
const theoTrang = new Map();
for (const r of refs) (theoTrang.get(r.path) ?? theoTrang.set(r.path, []).get(r.path)).push(r.frag);
for (const [path, frags] of theoTrang) {
  await go(path);
  const thieu = await p.evaluate(fs => fs.filter(f => !document.getElementById(f)), frags);
  say(thieu.length === 0, `${path}: đủ ${frags.length} mục đích đến`,
      `thiếu id: ${thieu.join(', ')} — bấm vào chỉ đứng yên, không báo lỗi`);
}

// MOI duong dan co #fragment tro vao /onboarding, o BAT KY file noi dung nao.
// Phep do o muc 6 chi soi quiz.content.ts nen da bo sot `/onboarding#wifi`
// trong home.content.ts (QUICK_LINKS) khi doi bo cuc 04/09/2026 — bam vao chi
// dung yen, khong 404, khong loi.
console.log('\n6b) Mọi đường dẫn #fragment vào /onboarding trong file nội dung');
{
  const { readdir } = await import('node:fs/promises');
  const thuMuc = 'src/app/content';
  const files = (await readdir(thuMuc)).filter(f => f.endsWith('.ts'));
  const link = [];
  for (const f of files) {
    const nd = await readFile(`${thuMuc}/${f}`, 'utf8');
    for (const m of nd.matchAll(/'(\/onboarding[^'#]*)#([a-z0-9-]+)'/g))
      link.push({ f, path: m[1], frag: m[2] });
  }
  say(true, `tìm thấy ${link.length} đường dẫn có #fragment`);
  const theo = new Map();
  for (const l of link) (theo.get(l.path) ?? theo.set(l.path, []).get(l.path)).push(l);
  for (const [path, ls] of theo) {
    await go(path);
    const thieu = await p.evaluate(fs => fs.filter(f => !document.getElementById(f)), ls.map(l => l.frag));
    say(thieu.length === 0, `${path}: đủ ${ls.length} đích đến`,
        `thiếu ${thieu.join(', ')} — khai ở ${[...new Set(ls.map(l => l.f))].join(', ')}`);
  }
}

console.log('\n7) Lỗi JavaScript');
say(errs.length === 0, 'không có lỗi JS trong suốt phép đo', errs.slice(0, 3).join(' | '));

await b.close(); srv.close();
console.log(fail ? `\n${fail} LỖI.` : '\nKhông lỗi.');
process.exit(fail ? 1 : 0);
