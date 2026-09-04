/**
 * Soat trang Hinh anh — luoi justified, cuon vo han, gom theo ngay, xem anh lon.
 *
 *   CHROME_BIN=... node tools/audit_gallery.mjs <thu-muc-dist> <fixture.json>
 *
 * VI SAO DO NHUNG THU NAY:
 *  - Album that co 1687 anh. Ba thu de hong ma `ng build` khong bao:
 *    (1) do het the <img> mot luc => treo trinh duyet;
 *    (2) luoi o vuong cat cut anh doc => chan dung mat dau;
 *    (3) hang cuoi bi keo gian ra qua kho khi thieu the chen day.
 *  - `w`/`h` tu API dung de giu CHO TRUOC. Thieu no thi bo cuc nhay lien tuc
 *    trong luc cuon — do bang cach so vi tri mot phan tu truoc va sau khi anh
 *    tai xong.
 *
 * Fixture: file JSON dang {"/api/gallery": {...}, "/api/gallery/<slug>": {...}}.
 * Du lieu that co ten/email nhan vien — DUNG commit fixture that vao repo.
 */
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(resolve('node_modules/playwright-core'));

const DIST = resolve(process.argv[2] ?? 'dist/avp-portal/browser');
const API = JSON.parse(await readFile(process.argv[3] ?? 'tools/fixtures/admin_api.json', 'utf8'));
const PORT = 8951;
const SLUG = 'avp-cup-2026';
const TYPES = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json',
                '.svg':'image/svg+xml','.ico':'image/x-icon','.woff2':'font/woff2','.png':'image/png','.jpg':'image/jpeg' };

// Anh gia 1x1 trong suot: khong can file that ma the <img> van "tai xong".
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64');

const srv = createServer(async (req, res) => {
  const u = decodeURIComponent((req.url || '/').split('?')[0]);
  if (u.startsWith('/media/') || u.includes('/img/')) {
    res.writeHead(200, { 'Content-Type': 'image/png' });
    return res.end(PIXEL);
  }
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

const total = (API[`/api/gallery/${SLUG}`]?.photos ?? []).length;

// ------------------------------------------------ 1) trang danh sach album
for (const w of [1440, 1024, 600]) {
  const p = await browser.newPage({ viewport: { width: w, height: 900 } });
  await p.goto(`http://127.0.0.1:${PORT}/gallery`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(700);
  const albums = await p.locator('.alb').count();
  const years = await p.locator('.gal-year').count();
  const chips = await p.locator('.gal-chips button').count();
  const mosaic = await p.locator('.alb-cover img').count();
  const wide = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  say(albums > 0 && years > 0 && wide <= 1,
      `${w}px danh sach: ${albums} album, ${years} nhom nam, ${chips} chip loc, ${mosaic} anh bia`,
      `tran ngang ${wide}px`);

  // Ba co the album phai RA BE RONG KHAC NHAU that su. Co la thu Marketing
  // chon de bien tap bo mat trang — ba co ma nhin nhu nhau thi vo nghia.
  const co = await p.evaluate(() => {
    const g = (k) => [...document.querySelectorAll('.alb.' + k)]
      .map((e) => Math.round(e.getBoundingClientRect().width));
    return { noibat: g('noibat'), thuong: g('thuong'), gon: g('gon') };
  });
  if (co.noibat.length && co.thuong.length && co.gon.length) {
    // Tren dien thoai MOI the deu chiem ca hang — do la bo cuc dap ung dung,
    // khong phai co bi mat tac dung. Nhip bien tap la chuyen cua man rong.
    const hep = w < 1000;
    const ok = hep
      ? co.noibat[0] >= co.thuong[0] && co.thuong[0] > co.gon[0]
      : co.noibat[0] > co.thuong[0] && co.thuong[0] > co.gon[0];
    say(ok,
        `${w}px ba co: noi bat ${co.noibat[0]} ${hep ? '>=' : '>'} thuong ${co.thuong[0]} > gon ${co.gon[0]}`,
        JSON.stringify(co));
  } else {
    say(true, `${w}px fixture chua du ba co de do (${JSON.stringify(
      Object.fromEntries(Object.entries(co).map(([k, v]) => [k, v.length])))})`);
  }

  // MOI anh bia phai NAM TRON trong khung bia. Bay `1fr` = `minmax(auto,1fr)`
  // lay chieu cao toi thieu theo anh, lam luoi cao gap doi khung roi anh cuoi
  // bi `overflow:hidden` cat mat — nhin qua van thay 3 anh nen rat de bo sot.
  const tran = await p.evaluate(() => {
    const out = [];
    for (const c of document.querySelectorAll('.alb-cover')) {
      const b = c.getBoundingClientRect();
      const imgs = [...c.querySelectorAll('img')];
      const ngoai = imgs.filter((i) => {
        const r = i.getBoundingClientRect();
        return r.bottom > b.bottom + 1 || r.right > b.right + 1;
      }).length;
      if (ngoai) out.push(`${c.closest('.alb')?.className}: ${ngoai}/${imgs.length} anh bi cat`);
    }
    return out;
  });
  say(tran.length === 0, `${w}px moi anh bia nam tron trong khung`, tran.join(' | '));
  await p.close();
}

// --------------------------------------- 2) album: luoi, cuon, gom ngay
{
  const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e.message || e)));
  await p.goto(`http://127.0.0.1:${PORT}/gallery/${SLUG}`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(900);

  const first = await p.locator('.ph').count();
  say(first > 0 && first < total,
      `khong do het ${total} anh mot luc (dang hien ${first})`,
      `hien ${first}/${total}`);

  say((await p.locator('.gal-day').count()) > 0, 'co tieu de nhom theo ngay');

  // Luoi justified: cac anh trong CUNG mot hang phai cao bang nhau, va anh
  // doc phai HEP hon anh ngang (giu dung ti le, khong cat).
  const shape = await p.evaluate(() => {
    const cells = [...document.querySelectorAll('.gal-row .ph')].slice(0, 12);
    const r = cells.map((c) => c.getBoundingClientRect());
    const row0 = r.filter((b) => Math.abs(b.top - r[0].top) < 2);
    const hs = new Set(row0.map((b) => Math.round(b.height)));
    const ws = row0.map((b) => Math.round(b.width));
    return { cungHang: row0.length, cao: [...hs], rong: ws };
  });
  say(shape.cungHang >= 2 && shape.cao.length === 1,
      `anh cung hang cao bang nhau (${shape.cungHang} anh, cao ${shape.cao.join('/')}px)`,
      JSON.stringify(shape));
  // CHI doi be rong khac nhau khi album THAT SU co nhieu ti le. Album AVP Cup
  // chup het bang mot may (7008x4672) nen moi o rong bang nhau — do la dung,
  // khong phai luoi bi ep vuong. Bao dong gia o day thi lan sau khong ai doc
  // ket qua nua.
  const daDangTiLe = new Set(
    (API[`/api/gallery/${SLUG}`]?.photos ?? [])
      .slice(0, 24)
      .filter((p) => p.w && p.h)
      .map((p) => (p.w / p.h).toFixed(2)),
  ).size > 1;
  if (daDangTiLe) {
    say(new Set(shape.rong).size > 1,
        'anh ngang va anh doc rong khac nhau (giu dung ti le, khong cat vuong)',
        `rong: ${shape.rong.join(',')}`);
  } else {
    say(true, 'album chup cung mot ti le — o rong bang nhau la dung');
  }

  // Cuon toi day => tu nap them, khong phai bam "Xem them".
  const before = await p.locator('.ph').count();
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await p.waitForTimeout(1200);
  const after = await p.locator('.ph').count();
  say(after > before, `cuon toi day thi tu nap them (${before} -> ${after})`);

  // Xem anh lon: mo, sang anh ke, tai anh goc, dong.
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(400);
  await p.locator('.ph').first().click();
  await p.waitForTimeout(500);
  say(await p.locator('.lb-img').isVisible(), 'bam anh thi mo xem lon');
  say(await p.locator('.lb-dl').isVisible(), 'co nut tai anh goc');
  const c1 = await p.locator('.lb-count').innerText();
  await p.keyboard.press('ArrowRight');
  await p.waitForTimeout(400);
  const c2 = await p.locator('.lb-count').innerText();
  say(c1 !== c2, `phim mui ten sang anh ke (${c1.trim()} -> ${c2.trim()})`);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);
  say((await p.locator('.lb-img').count()) === 0, 'phim Esc dong xem lon');

  // Ba kieu bo cuc: moi kieu phai doi THAT container, va lua chon phai duoc
  // nho lai — nguoi ta co thoi quen xem, doi lai moi lan vao la phien.
  for (const [nut, sel] of [['Cột', '.gal-cols'], ['Điểm nhấn', '.gal-mos'],
                            ['Ô vuông', '.gal-sq'], ['Dòng', '.gal-row']]) {
    await p.locator('.gal-seg button', { hasText: nut }).first().click();
    await p.waitForTimeout(600);
    const n = await p.locator(`${sel} .ph`).count();
    say(n > 0, `kieu "${nut}": doi sang ${sel} (${n} anh)`);
  }
  await p.locator('.gal-seg button', { hasText: 'Cột' }).first().click();
  await p.waitForTimeout(400);
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(900);
  say((await p.locator('.gal-cols').count()) > 0, 'tai lai trang van giu dung kieu vua chon');

  // Diem nhan phai THAT SU co o to — day la ly do kieu nay ton tai.
  await p.locator('.gal-seg button', { hasText: 'Điểm nhấn' }).first().click();
  await p.waitForTimeout(700);
  const nhip = await p.evaluate(() => {
    const c = [...document.querySelectorAll('.gal-mos .ph')].slice(0, 16);
    const w = c.map((x) => Math.round(x.getBoundingClientRect().width));
    return { to: Math.max(...w), nho: Math.min(...w) };
  });
  say(nhip.to > nhip.nho * 1.5,
      `diem nhan co o to gap doi (${nhip.nho}px / ${nhip.to}px)`, JSON.stringify(nhip));

  // Trinh chieu: mo lightbox va TU chuyen anh.
  await p.locator('.gal-seg button', { hasText: 'Dòng' }).first().click();
  await p.waitForTimeout(400);
  await p.locator('.gal-play').click();
  await p.waitForTimeout(600);
  const s1 = await p.locator('.lb-count').innerText();
  await p.waitForTimeout(4600);
  const s2 = await p.locator('.lb-count').innerText();
  say(s1 !== s2, `trinh chieu tu chuyen anh (${s1.trim()} -> ${s2.trim()})`);
  await p.locator('.lb-play').click();
  await p.waitForTimeout(400);
  const s3 = await p.locator('.lb-count').innerText();
  await p.waitForTimeout(4600);
  say(s3 === (await p.locator('.lb-count').innerText()), 'bam Tam dung thi dung han');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);

  say(errs.length === 0, 'khong co loi JS', errs.slice(0, 2).join(' | '));
  await p.close();
}

// ------------------------------------------------- 3) trang quan ly
{
  const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(`http://127.0.0.1:${PORT}/gallery/manage`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  const rows = await p.locator('.mg-row').count();
  const btn = await p.locator('.mg-bar .btn').count();
  say(rows > 0 && btn > 0, `trang quan ly liet ke ${rows} album va co nut Them album`);
  await p.close();
}

await browser.close();
srv.close();
console.log(fail ? `\n  ${fail} MUC HONG` : '\n  TOAN BO DAT.');
process.exit(fail ? 1 : 0);
