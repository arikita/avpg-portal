/**
 * Soat THANH MENU CUA PORTAL — 6 muc Tin tuc / Doi song / Hoi nhap / Hinh anh
 * / Lien he / Ho tro, o nhieu be rong man hinh.
 *
 *   CHROME_BIN=... node tools/audit_portal_nav.mjs <thu-muc-dist> [fixture.json]
 *
 * VI SAO CO FILE NAY (25/08/2026): ba lan deploy trong mot ngay deu duoc soat
 * bang audit_admin_ui.mjs — nhung bo do ay CHI mo /admin. Thanh menu cua chinh
 * portal, thu ma 850 nguoi bam moi ngay, khong he co mot phep thu nao. Khi user
 * bao "cac nut khong hoat dong" thi khong co gi de doi chieu ngoai viec bam tay.
 *
 * Bo do nay kiem BA thu:
 *   1. Bam tung muc co doi URL va co ra noi dung khong.
 *   2. O man hep (.nav-links an di) thi nut hamburger va menu dien thoai co
 *      thay the duoc khong.
 *   3. Tu /admin quay ve portal thi thanh menu co hien lai va con bam duoc
 *      khong — /admin an han thanh menu (xem isAdmin trong app.ts) nen day la
 *      cho de gay ma khong ai thay.
 *
 * Fixture: mac dinh dung tools/fixtures/admin_api.json cho tien. Muon do sat
 * that hon thi keo du lieu API that ve mot file JSON dang {"/api/me": {...}}
 * roi tro vao — LUU Y du lieu do co ten/email nhan vien, DUNG commit.
 */
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(resolve('node_modules/playwright-core'));

const DIST = resolve(process.argv[2] ?? 'dist/avp-portal/browser');
const API = JSON.parse(await readFile(process.argv[3] ?? 'tools/fixtures/admin_api.json', 'utf8'));
const PORT = 8943;
const MUC = ['Tin tức', 'Đời sống', 'Hội nhập', 'Hình ảnh', 'Liên hệ', 'Hỗ trợ'];
const TYPES = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json',
                '.svg':'image/svg+xml','.ico':'image/x-icon','.woff2':'font/woff2','.png':'image/png','.jpg':'image/jpeg' };

const srv = createServer(async (req, res) => {
  const u = decodeURIComponent((req.url || '/').split('?')[0]);
  if (u.startsWith('/api/')) {
    if (req.method !== 'GET') { for await (const c of req) {} return res.writeHead(204).end(); }
    const b = API[u];
    res.writeHead(b ? 200 : 404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(b ?? { detail: 'khong co' }));
  }
  let f = join(DIST, u);
  try { if ((await stat(f)).isDirectory()) f = join(f, 'index.html'); } catch { f = join(DIST, 'index.html'); }
  try { const b = await readFile(f); res.writeHead(200, { 'Content-Type': TYPES[extname(f)] || 'application/octet-stream' }); res.end(b); }
  catch { res.writeHead(404).end('x'); }
});
await new Promise((r) => srv.listen(PORT, '127.0.0.1', r));

const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN, args: ['--no-sandbox'] });
let fail = 0;
const say = (ok, m, extra = '') => { console.log(`  [${ok ? 'OK ' : 'LOI'}] ${m}${ok ? '' : ' — ' + extra}`); if (!ok) fail++; };
const url = (p) => new URL(p.url()).pathname;

// -------------------------------------------- 1) tung muc, nhieu be rong
for (const w of [1440, 1280, 1024, 900, 600, 390]) {
  const p = await browser.newPage({ viewport: { width: w, height: 900 } });
  const hong = [];
  for (const ten of MUC) {
    await p.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(500);
    const ngang = await p.locator('.nav-links a').first().isVisible().catch(() => false);
    try {
      if (ngang) {
        await p.locator('.nav-links a', { hasText: ten }).first().click({ timeout: 5000 });
      } else {
        await p.locator('.menu-btn').click({ timeout: 5000 });
        await p.waitForTimeout(400);
        await p.locator('.mobile-nav a', { hasText: ten }).first().click({ timeout: 5000 });
      }
    } catch {
      hong.push(`${ten}: khong bam duoc`);
      continue;
    }
    await p.waitForTimeout(700);
    const den = url(p);
    const chu = (await p.locator('main').innerText()).replace(/\s+/g, ' ').trim().length;
    if (den === '/') hong.push(`${ten}: URL khong doi`);
    else if (chu < 40) hong.push(`${ten}: ${den} chi ${chu} ky tu`);
  }
  say(!hong.length, `${w}px: ca 6 muc deu dieu huong va ra noi dung`, hong.join(' | '));
  await p.close();
}

// ------------------------------- 2) /admin an thanh menu, ve thi hien lai
{
  const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(`http://127.0.0.1:${PORT}/admin`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(900);
  say((await p.locator('header.navbar').count()) === 0, '/admin an han thanh menu portal');
  await p.locator('.app-header a[href="/"], .sidebar-menu a[href="/"]').first().click();
  await p.waitForTimeout(900);
  const hien = await p.locator('header.navbar').isVisible().catch(() => false);
  say(hien, 've portal thi thanh menu hien lai');
  if (hien) {
    await p.locator('.nav-links a', { hasText: 'Đời sống' }).first().click();
    await p.waitForTimeout(700);
    say(url(p) === '/feed', 'sau khi ve tu /admin, thanh menu van bam duoc', p.url());
  }
  await p.close();
}

// ------------------ 3) menu tai khoan dang mo khong duoc chan menu chinh
{
  const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  await p.locator('app-account-menu .acct-btn').click();
  await p.waitForTimeout(400);
  await p.locator('.nav-links a', { hasText: 'Hội nhập' }).first().click();
  await p.waitForTimeout(700);
  say(url(p) === '/onboarding', 'menu tai khoan dang mo khong chan menu chinh', p.url());
  await p.close();
}

await browser.close();
srv.close();
console.log(fail ? `\n  ${fail} MUC HONG` : '\n  TOAN BO DAT.');
process.exit(fail ? 1 : 0);
