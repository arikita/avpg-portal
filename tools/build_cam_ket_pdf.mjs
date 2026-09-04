/**
 * Sinh PDF ban cam ket bao mat + DO LUON toa do cac o ky cho Documenso.
 *
 *   CHROME_BIN=~/chrome-cft/chrome-linux64/chrome node tools/build_cam_ket_pdf.mjs
 *
 * Ra 2 file:
 *   docs/cam-ket-bao-mat.pdf        — nap len Documenso lam template
 *   docs/cam-ket-fields.json        — toa do % cua tung o, dung cho /template/field/create-many
 *
 * VI SAO DO BANG SCRIPT CHU KHONG GO TAY: noi dung ban cam ket con duoc sua.
 * Them mot dong o Dieu 5 la khoi ky truot xuong, ma PDF van trong binh thuong —
 * chi den luc nhan vien ky moi thay chu ky nam de len chu. Script do lai sau moi
 * lan render nen hai thu khong bao gio lech nhau.
 *
 * Toa do Documenso (pageX/pageY/width/height) la PHAN TRAM cua kich thuoc trang.
 * File HTML dat @page margin 0 va moi .page dung 210x297mm, nho vay phep do tren
 * man hinh bang dung voi trang in — khong can he so quy doi nao.
 */
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('/home/clasvr/avpg/portal-avpg/node_modules/playwright-core');

const ROOT = resolve(import.meta.dirname, '..');
const SRC  = resolve(ROOT, 'docs/cam-ket-bao-mat.html');
const PDF  = resolve(ROOT, 'docs/cam-ket-bao-mat.pdf');
const OUT  = resolve(ROOT, 'docs/cam-ket-fields.json');

// id trong HTML -> dinh nghia field Documenso.
// 'prefill' = portal bom gia tri tu AD luc tao tai lieu; nguoi ky KHONG sua duoc.
// NAME/EMAIL/DATE Documenso tu dien tu recipient, khong can prefill.
const FIELDS = [
  { id: 'v-hoten',    key: 'ho_ten',    type: 'NAME',      label: 'Họ và tên' },
  { id: 'v-chucdanh', key: 'chuc_danh', type: 'TEXT',      label: 'Chức danh',          prefill: true },
  { id: 'v-phongban', key: 'phong_ban', type: 'TEXT',      label: 'Phòng / Ban',        prefill: true },
  { id: 'v-email',    key: 'email',     type: 'EMAIL',     label: 'Email công ty' },
  { id: 'v-ngayky',   key: 'ngay_ky',   type: 'DATE',      label: 'Ngày ký' },
  { id: 'v-chuky',    key: 'chu_ky',    type: 'SIGNATURE', label: 'Chữ ký' },
  { id: 'v-hoten2',   key: 'ho_ten_2',  type: 'NAME',      label: 'Họ tên dưới chữ ký' },
];

const browser = await chromium.launch({
  executablePath: process.env.CHROME_BIN?.replace(/^~/, process.env.HOME),
});
const page = await browser.newPage();
await page.goto(pathToFileURL(SRC).href, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);

const measured = await page.evaluate((defs) => {
  const pages = [...document.querySelectorAll('.page')];
  const out = { pageCount: pages.length, tran: [], fields: [], missing: [], logo: null };

  // Logo nap bang duong dan tuong doi. Anh hong/sai duong dan thi Chrome ve o
  // trong, PDF van ra 3 trang "binh thuong" — khong co gi bao. Hoi thang.
  const lg = document.getElementById('logo');
  out.logo = lg ? { ok: lg.complete && lg.naturalWidth > 0, w: lg.naturalWidth, h: lg.naturalHeight,
                    hienW: Math.round(lg.getBoundingClientRect().width) } : { ok: false, thieu: true };

  // Trang nao bi tran noi dung? overflow:hidden nen PDF trong van "sach" —
  // phai hoi thang scrollHeight, khong thi mat chu ma khong ai biet.
  pages.forEach((p, i) => {
    const b = p.querySelector('.body');
    if (b.scrollHeight > b.clientHeight + 1)
      out.tran.push({ trang: i + 1, thua_px: b.scrollHeight - b.clientHeight });
  });

  for (const d of defs) {
    const el = document.getElementById(d.id);
    if (!el) { out.missing.push(d.id); continue; }
    const host = el.closest('.page');
    const pi = pages.indexOf(host);
    const pr = host.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const pc = (v, total) => +(v / total * 100).toFixed(3);
    out.fields.push({
      ...d,
      pageNumber: pi + 1,
      pageX: pc(r.left - pr.left, pr.width),
      pageY: pc(r.top - pr.top, pr.height),
      width: pc(r.width, pr.width),
      height: pc(Math.max(r.height, 18), pr.height),
    });
  }
  return out;
}, FIELDS);

await page.pdf({ path: PDF, width: '210mm', height: '297mm', printBackground: true,
                 margin: { top: 0, right: 0, bottom: 0, left: 0 } });
await browser.close();

let loi = 0;
if (measured.missing.length) { console.log('LOI  thieu o trong HTML:', measured.missing.join(', ')); loi++; }
if (!measured.logo.ok) { console.log('LOI  logo khong nap duoc —', JSON.stringify(measured.logo)); loi++; }
else console.log(`logo ok (${measured.logo.w}x${measured.logo.h}px, in ra rong ${measured.logo.hienW}px)`);
for (const t of measured.tran) { console.log(`LOI  trang ${t.trang} TRAN noi dung ${t.thua_px}px — chu bi cat`); loi++; }
for (const f of measured.fields) {
  if (f.width < 3 || f.height < 1)
    { console.log(`LOI  o "${f.key}" gan nhu khong co kich thuoc (${f.width}% x ${f.height}%)`); loi++; }
}

await writeFile(OUT, JSON.stringify({ pageCount: measured.pageCount, fields: measured.fields }, null, 2));
console.log(`\n${PDF}\n${OUT}`);
console.log(`${measured.pageCount} trang, ${measured.fields.length} o:`);
for (const f of measured.fields)
  console.log(`  ${f.key.padEnd(11)} ${f.type.padEnd(9)} trang ${f.pageNumber}  ` +
              `x=${f.pageX}% y=${f.pageY}%  ${f.width}%x${f.height}%${f.prefill ? '  (prefill AD)' : ''}`);
console.log(loi ? `\n${loi} LOI — sua truoc khi nap len Documenso.` : '\nKhong loi.');
process.exit(loi ? 1 : 0);
