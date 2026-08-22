/**
 * Nap that ban build trong trinh duyet va kiem app CO BOOTSTRAP DUOC khong.
 *
 * VI SAO CAN — su co 22/08/2026: mot vong lap phu thuoc DI (NG0200) lam app
 * khong khoi dong noi, nguoi dung thay TRANG TRANG. No lot qua HET moi hang
 * rao: `tsc` xanh, `ng build` xanh, 12 test Karma xanh, smoke_test xanh.
 * Ly do: khong mot cai nao THAT SU nap app trong trinh duyet.
 *
 * Bo e2e Playwright bat duoc loi nay, nhung no can tai khoan AD de qua
 * Kerberos. Cong cu nay CHU Y khong can tai khoan nao: no phuc vu thu muc
 * dist bang mot HTTP server tam, nen luon chay duoc — ke ca truoc khi co
 * tai khoan test.
 *
 *   node tools/boot_check.mjs [duong/dan/toi/dist]
 *
 * Ma thoat khac 0 = app khong render duoc => TUYET DOI khong deploy.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');

const DIST = resolve(process.argv[2] || 'dist/avp-portal/browser');
const PORT = Number(process.env.BOOT_CHECK_PORT || 8899);
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.jpg': 'image/jpeg',
};

// Server tam: bat chuoc FallbackResource cua Apache (moi duong dan khong phai
// file deu tra index.html) de router cua SPA hoat dong dung nhu that.
const server = createServer(async (req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  let file = join(DIST, url);
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
  } catch {
    file = join(DIST, 'index.html');
  }
  try {
    const buf = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(buf);
  } catch {
    res.writeHead(404).end('khong co');
  }
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

const browser = await chromium.launch({
  executablePath: process.env.CHROME_BIN || undefined,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();

const fatal = [];
page.on('pageerror', (e) => fatal.push('PAGEERROR: ' + (e.message || String(e))));
page.on('console', (m) => {
  const t = m.text();
  // 404 cua /api/* la binh thuong: o day khong co backend. Chi bat loi JS.
  if (m.type() === 'error' && !/Failed to load resource|favicon|\/api\//.test(t)) {
    fatal.push('CONSOLE: ' + t);
  }
});

let ok = true;
const say = (name, good, extra = '') => {
  console.log(`  [${good ? 'OK ' : 'LOI'}] ${name}${good ? '' : (extra ? ' — ' + extra : '')}`);
  if (!good) ok = false;
};

try {
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle', timeout: 25_000 });
  await page.waitForTimeout(2500);

  const navbar = await page.locator('header.navbar').count();
  const text = (await page.locator('body').innerText().catch(() => '')).trim();

  say('app bootstrap (co <header class="navbar">)', navbar > 0,
      'app khong khoi dong duoc — xem loi ben duoi');
  say('body co noi dung that', text.length > 200, `chi co ${text.length} ky tu`);
  say('khong co loi JS lam sap app', fatal.length === 0);
  for (const f of fatal.slice(0, 6)) console.log('        ! ' + f.slice(0, 240));

  // NG0200 la loi da gay su co that — goi ten no ro rang de lan sau doc log hieu ngay.
  if (fatal.some((f) => f.includes('NG0200'))) {
    console.log('\n  >>> NG0200 = VONG LAP PHU THUOC DI. Thuong do mot service duoc');
    console.log('      ErrorHandler inject lai di inject Router/HttpClient o cap field.');
    console.log('      Cach sua: giu Injector roi lay MUON trong init().');
  }
} catch (e) {
  say('nap duoc trang', false, String(e).slice(0, 200));
} finally {
  await browser.close();
  server.close();
}

console.log(ok ? '\nBOOTSTRAP DAT.' : '\nBOOTSTRAP HONG — KHONG DUOC DEPLOY.');
process.exit(ok ? 0 : 1);
