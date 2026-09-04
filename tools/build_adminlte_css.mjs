#!/usr/bin/env node
/**
 * Nhot toan bo AdminLTE (da goi san Bootstrap 5.3) xuong duoi MOT lop `.lte`.
 *
 * VI SAO PHAI LAM: `adminlte.min.css` dinh nghia `.container`, `.card`, `.btn`,
 * `.row` va reset ca `body`/`h1`/`a`. Portal cung dung dung nhung ten do o
 * /feed, /news, /profile. Nap thang file nay vao `styles` cua angular.json la
 * vo giao dien toan site — khong phai "co the vo", la CHAC CHAN vo.
 *
 * Cach lam: doc tung selector, doi goc cua no:
 *   :root | html | body           -> .lte          (lop boc dong vai <body>)
 *   .layout-fixed .sidebar-open … -> .lte.layout-fixed …   (xem WRAPPER ben duoi)
 *   [data-bs-theme=…] | [data-lte-…] -> phat CA HAI dang: gan vao .lte (khi
 *       thuoc tinh nam tren the goc) VA lam con chau (aside.app-sidebar cua
 *       AdminLTE tu mang data-bs-theme="dark" — thieu dang nay la sidebar
 *       mat mau toi).
 *   *                             -> .lte, .lte *  (chinh .lte cung can
 *                                                   box-sizing cua Bootstrap)
 *   con lai X                     -> .lte X
 * Bo qua rule trong @keyframes (selector la 0%/from/to, khong phai selector).
 *
 * Chay: node tools/build_adminlte_css.mjs
 * Ket qua `public/vendor/adminlte-<ver>.css` ĐƯỢC COMMIT — deploy tren .136
 * chi copy asset, khong phai chay lai buoc nay.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import postcss from 'postcss';

const SCOPE = '.lte';
const PKG = JSON.parse(readFileSync('node_modules/admin-lte/package.json', 'utf8'));
const SRC = 'node_modules/admin-lte/dist/css/adminlte.min.css';
const OUT = `public/vendor/adminlte-${PKG.version}.css`;

/** Goc cua selector la the goc trang (html/body/:root) hay khong. */
const ROOT_TOKEN = /^(:root|html|body)(?![\w-])/;
/** Thuoc tinh AdminLTE/Bootstrap dat duoc o CA the goc lan the con. */
const DUAL_ATTR = /^\[data-(bs-theme|lte-[\w-]+)[^\]]*\]/;

/**
 * Cac lop TRANG THAI ma AdminLTE dat tren <body>, tuc tren lop boc `.lte` cua
 * ta. Selector kieu `.sidebar-expand-lg .app-sidebar` PHAI thanh
 * `.lte.sidebar-expand-lg .app-sidebar` (dinh lien), khong duoc thanh
 * `.lte .sidebar-expand-lg .app-sidebar` (con chau) — dinh lien moi khop.
 *
 * Do that 25/08/2026: thieu danh sach nay thi TOAN BO bo cuc dap ung chet am
 * tham. O 820px thanh ben dang le truot han ra ngoai man hinh; thuc te no cu
 * dung do chiem 250px, con nut ☰ va lop phu bam ra ngoai de dong thi khong
 * lam gi ca — khong loi console, khong loi build, nhin qua van "chay".
 *
 * THEM LOP MOI VAO THE BOC TRONG admin.html THI PHAI THEM VAO DAY. Script tu
 * kiem dieu do o cuoi file va bao loi neu quen.
 */
const WRAPPER = new Set([
  'layout-fixed', 'layout-boxed', 'layout-navbar-fixed', 'layout-footer-fixed',
  'fixed-header', 'fixed-footer', 'fixed-sidebar',
  'sidebar-expand', 'sidebar-expand-sm', 'sidebar-expand-md', 'sidebar-expand-lg',
  'sidebar-expand-xl', 'sidebar-expand-xxl',
  'sidebar-open', 'sidebar-collapse', 'sidebar-mini', 'sidebar-without-hover',
  'sidebar-horizontal', 'sidebar-is-opening', 'control-sidebar-slide-open',
  'hold-transition', 'app-loaded', 'dark-mode', 'text-sm', 'compact-mode',
  'nav-compact', 'nav-indent', 'nav-child-indent', 'nav-flat', 'nav-legacy',
  'bg-body-tertiary', 'bg-body-secondary', 'bg-body',
]);

/** Lay compound dau tien cua selector (phan truoc dau cach / > / + / ~). */
function firstCompound(sel) {
  let depth = 0;
  for (let i = 0; i < sel.length; i++) {
    const c = sel[i];
    if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    else if (depth === 0 && ' >+~'.includes(c)) return sel.slice(0, i);
  }
  return sel;
}

/** Compound chi gom cac lop nam tren the boc? (`:not(...)` bo qua noi dung.) */
function isWrapperCompound(compound) {
  const bare = compound.replace(/:[a-z-]+\([^)]*\)/gi, '');
  const classes = [...bare.matchAll(/\.([\w-]+)/g)].map((m) => m[1]);
  if (!classes.length) return false;
  // Con sot lai gi ngoai cac lop (the, thuoc tinh) thi khong phai the boc.
  if (bare.replace(/\.[\w-]+/g, '').replace(/:[a-z-]+/gi, '').trim()) return false;
  return classes.every((c) => WRAPPER.has(c));
}

function scopeOne(sel) {
  const s = sel.trim();
  if (!s) return [];
  if (s === '*') return [SCOPE, `${SCOPE} *`];

  const root = s.match(ROOT_TOKEN);
  if (root) return [SCOPE + s.slice(root[0].length)];

  const attr = s.match(DUAL_ATTR);
  if (attr) return [SCOPE + s, `${SCOPE} ${s}`];

  // Phat CA HAI dang. Dang dinh lien la thu CAN (`.lte.sidebar-expand-lg …`);
  // dang con chau giu cho cac lop vua o the boc vua dung duoc o cho khac —
  // `bg-body-secondary` chang han, the boc mang `bg-body-tertiary` con
  // <aside class="app-sidebar bg-body-secondary"> thi nam ben trong. Chi phat
  // dang dinh lien thi sidebar mat nen toi o man hep (dinh 25/08/2026).
  // Voi lop chi xuat hien o <body> thi dang con chau khong khop gi — vo hai.
  if (isWrapperCompound(firstCompound(s))) return [SCOPE + s, `${SCOPE} ${s}`];

  return [`${SCOPE} ${s}`];
}

const scoper = {
  postcssPlugin: 'avp-scope-adminlte',
  Rule(rule) {
    // 0% / 50% / from / to trong @keyframes khong phai selector.
    for (let p = rule.parent; p; p = p.parent) {
      if (p.type === 'atrule' && /keyframes$/i.test(p.name)) return;
    }
    rule.selectors = rule.selectors.flatMap(scopeOne);
  },
};

const css = readFileSync(SRC, 'utf8');
const result = await postcss([scoper]).process(css, { from: SRC, to: OUT });

const header =
  `/* AdminLTE v${PKG.version} — da nhot duoi \`${SCOPE}\`.\n` +
  `   SINH TU ĐỘNG boi tools/build_adminlte_css.mjs — ĐỪNG SỬA TAY.\n` +
  `   Sua template thi sua src/app/features/admin/*, sua bien mau thi sua admin.scss. */\n`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, header + result.css);

// Phien ban di kem ra file TS: ten file css co so phien ban, ma Admin lai
// phai tu chen <link> toi dung ten do. Sinh o day de khong bao gio lech —
// lech la trang admin nap mot file 404 va mat sach giao dien.
const VER_TS = 'src/app/features/admin/adminlte.version.ts';
writeFileSync(
  VER_TS,
  `// SINH TU DONG boi tools/build_adminlte_css.mjs — DUNG SUA TAY.\n` +
    `export const ADMINLTE_VERSION = '${PKG.version}';\n`,
);

// --- hang rao: the boc trong admin.html khai gi thi WRAPPER phai biet cai do -
const HTML = readFileSync('src/app/features/admin/admin.html', 'utf8');
const onWrapper = [
  ...(HTML.match(/class="(lte[^"]*)"/)?.[1].split(/\s+/) ?? []),
  ...[...HTML.matchAll(/\[class\.([\w-]+)\]="(?:railCollapsed|railOpen)\(\)"/g)].map((m) => m[1]),
];
const quen = onWrapper.filter((c) => c !== 'lte' && !WRAPPER.has(c));
if (quen.length) {
  console.error(
    `LOI: the boc .lte trong admin.html co lop ${quen.join(', ')} ma WRAPPER khong biet.\n` +
      `     Luat cua AdminLTE gan vao lop do se bien thanh selector CON CHAU va khong khop gi ca.\n` +
      `     Them chung vao WRAPPER trong ${import.meta.url.split('/').pop()} roi chay lai.`,
  );
  process.exit(1);
}

const kb = (n) => `${(n / 1024).toFixed(0)}KB`;
console.log(`${SRC} (${kb(css.length)}) -> ${OUT} (${kb(result.css.length)})`);
console.log(`${VER_TS} -> ${PKG.version}`);
