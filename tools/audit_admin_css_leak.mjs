/**
 * Soat RO RI CSS giua portal va AdminLTE tren trang /admin.
 *
 *   CHROME_BIN=... node tools/audit_admin_css_leak.mjs <thu-muc-dist> [fixtures]
 *
 * VAN DE NO BAT:
 * AdminLTE goi san Bootstrap 5.3 nen dinh nghia dung nhung ten lop ma portal
 * cung dung o cho khac: `.row` `.btn` `.card` `.navbar` `.container`. CSS cua
 * AdminLTE da duoc nhot xuong `.lte` (tools/build_adminlte_css.mjs) nen selector
 * cua no cu the hon va thang o moi thuoc tinh NO CO KHAI BAO — nhung thuoc tinh
 * nao Bootstrap khong noi den thi ban cua portal VAN AP DUNG.
 *
 * Do la mot lop lai am tham: khong loi build, khong loi console, khong loi test.
 * Do that 25/08/2026: `.row{display:flex;align-items:center;gap:12px}` cua
 * portal lot vao luoi 12 cot cua Bootstrap (luoi do dung margin am + padding,
 * KHONG dung `gap`) => bon o `col-lg-3` khong con vua mot hang va hai the
 * `col-lg-6` xep chong len nhau. Nhin anh chup thi thay, nhung phai biet ma
 * nhin; bo do nay thi khong can biet truoc.
 *
 * CACH DO: ve trang hai lan — lan hai TAT han stylesheet toan cuc cua portal —
 * roi so computed style cua tung phan tu duoi `.lte`. Cho nao lech tuc la
 * portal dang quyet dinh bo cuc cua trang quan tri.
 *
 * Chi so cac thuoc tinh anh huong BO CUC. KHONG so `width`/`height`: do la ket
 * qua chu khong phai khai bao, va tat stylesheet portal la mat luon font
 * (`--font-sans`) nen moi the co chu deu doi be rong vai pixel — nhieu den muc
 * chon mat cho ro ri that. `font-family` bo vi cung ly do: portal cho ca site
 * dung Inter va /admin thua ke la dung y.
 *
 * Ra 0 khi sach. Co ro ri thi in ra selector + thuoc tinh + hai gia tri, va
 * ra 1 — cach sua la them mot dong vao khoi "GO ANH HUONG..." cuoi admin.scss.
 */
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(resolve('node_modules/playwright-core'));

const DIST = resolve(process.argv[2] ?? 'dist/avp-portal/browser');
const API = JSON.parse(await readFile(process.argv[3] ?? 'tools/fixtures/admin_api.json', 'utf8'));
const PORT = 8914;
const TABS = ['', 'content', 'news', 'users', 'analytics', 'errors', 'system'];

/** Thuoc tinh quyet dinh BO CUC. Them vao day khi gap kieu ro ri moi. */
const PROPS = [
  'display', 'position', 'top', 'right', 'bottom', 'left', 'z-index', 'overflow-x',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'row-gap', 'column-gap', 'align-items', 'justify-content',
  'flex-grow', 'flex-shrink', 'flex-basis', 'flex-wrap', 'flex-direction',
  'grid-template-columns', 'float', 'white-space', 'line-height',
  'border-radius', 'border-top-width', 'border-bottom-width',
  'box-shadow', 'background-image', 'transform', 'backdrop-filter',
  // `color` PHAI co trong danh sach. Portal co `p{color:var(--text-2)}` — mot
  // selector THE TRAN. Gia tri ke thua bao gio cung thua mot khai bao truc
  // tiep, du khai bao do yeu den may: nen `.text-bg-success{color:#fff}` dat
  // tren the cha KHONG voi toi duoc the <p> ben trong. Do that 25/08/2026:
  // nhan cua o so lieu ra #59617a tren nen xanh #198754 — tuong phan 2:1.
  'color', 'font-size', 'font-weight', 'letter-spacing',
];

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
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

/**
 * Chup computed style cua moi phan tu duoi `.lte`.
 * `portalOn=false` => tat stylesheet toan cuc cua portal (styles-*.css) truoc
 * khi doc. KHONG tat cac the <style> cua Angular: admin.scss nam trong do va
 * no la phan CUA trang quan tri, khong phai thu di lac vao.
 */
const snap = (props, portalOn) =>
  page.evaluate(([props, portalOn]) => {
    for (const l of document.querySelectorAll('link[rel=stylesheet]')) {
      if (/\/styles-[^/]*\.css$/.test(l.href)) l.disabled = !portalOn;
    }
    document.body.getBoundingClientRect(); // ep tinh lai
    const out = {};
    const root = document.querySelector('.lte');
    if (!root) return out;
    let i = 0;
    for (const el of root.querySelectorAll('*')) {
      const cs = getComputedStyle(el);
      const key = `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string'
        ? '.' + el.className.trim().split(/\s+/).slice(0, 4).join('.') : ''}#${i++}`;
      out[key] = props.map((p) => cs.getPropertyValue(p));
    }
    return out;
  }, [props, portalOn]);

let leaks = 0;
const seen = new Set();

for (const t of TABS) {
  await page.goto(`http://127.0.0.1:${PORT}/admin${t ? '/' + t : ''}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);

  const withPortal = await snap(PROPS, true);
  const without = await snap(PROPS, false);
  await snap(PROPS, true); // bat lai, tranh anh huong lan sau

  const bad = [];
  for (const [key, vals] of Object.entries(withPortal)) {
    const other = without[key];
    if (!other) continue; // phan tu doi cho vi bo cuc doi — bo qua, lan sau bat
    vals.forEach((v, i) => {
      if (v === other[i]) return;
      const sel = key.replace(/#\d+$/, '');
      const line = `${sel} { ${PROPS[i]}: ${v} }  <- portal ghi de (khong portal: ${other[i]})`;
      if (seen.has(line)) return;
      seen.add(line);
      bad.push(line);
    });
  }
  const name = t || 'overview';
  if (bad.length) {
    leaks += bad.length;
    console.log(`  [LOI] /admin/${name}: ${bad.length} thuoc tinh bi portal quyet dinh`);
    for (const b of bad.slice(0, 12)) console.log(`         ${b}`);
    if (bad.length > 12) console.log(`         … con ${bad.length - 12} dong nua`);
  } else {
    console.log(`  [OK ] /admin/${name}: style toan cuc cua portal khong cham vao bo cuc`);
  }
}

await browser.close();
srv.close();
console.log(leaks ? `\n  ${leaks} CHO RO RI — them dong go o cuoi admin.scss.` : '\n  KHONG CO RO RI.');
process.exit(leaks ? 1 : 0);
