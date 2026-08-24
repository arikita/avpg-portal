/**
 * Kiem o an `httpd_location` cua trang dang nhap portal.
 *
 *   CHROME_BIN=<chromium> node tools/audit_login_redirect.mjs
 *
 * Chay tu clasvr, danh thang vao https://portal.anvietphatgroup.com (may nay
 * KHONG cau hinh Kerberos nen trinh duyet cu xu nhu may khong join domain —
 * dung canh can kiem).
 *
 * Hai cau hoi:
 *   1. Mo /news/43 roi dang nhap thi co ve DUNG /news/43 khong (hay bi nem ve
 *      trang chu). O an nay lay tu location.pathname, ma thanh dia chi van giu
 *      duong dan goc vi Apache tra trang login lam THAN cua 401, khong redirect.
 *   2. Co chan duoc chuyen huong ra ngoai khong. Gia tri nay di THANG vao header
 *      Location cua Apache; "//host-khac" hay "/\host-khac" la duong dan tuong
 *      doi giao thuc, trinh duyet hieu la sang host khac => lo hong chuyen huong
 *      mo. Bai kiem danh thu ca ba dang.
 *
 * KHONG dung tai khoan that: chi doc gia tri o an, va mot lan nhap sai co y de
 * kiem xem dich con duoc nho qua man hinh bao loi khong.
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/home/clasvr/avpg/portal-avpg/node_modules/playwright-core');
const B = 'https://portal.anvietphatgroup.com';
const b = await chromium.launch({ executablePath: process.env.CHROME_BIN, args:['--no-sandbox'] });
let fail = 0;
const say = (ok, m, x='') => { console.log(`  [${ok?'OK ':'LOI'}] ${m}${ok?'':' -> '+x}`); if(!ok) fail++; };

async function dich(url, ctxDung) {
  const ctx = ctxDung || await b.newContext({ ignoreHTTPSErrors:true });
  const p = await ctx.newPage();
  await p.goto(url, { waitUntil:'domcontentloaded', timeout:30000 }).catch(()=>{});
  await p.waitForTimeout(900);
  const v = await p.locator('input[name="httpd_location"]').getAttribute('value').catch(()=>null);
  if (!ctxDung) { await p.close(); await ctx.close(); }
  return { v, p, ctx };
}

console.log('--- đưa về đúng trang người dùng định vào');
say((await dich(B + '/news/43')).v === '/news/43', 'mở /news/43 -> httpd_location = /news/43');
say((await dich(B + '/feed')).v === '/feed', 'mở /feed -> /feed');
say((await dich(B + '/profile/haivl')).v === '/profile/haivl', 'mở /profile/haivl -> giữ nguyên');
say((await dich(B + '/news?q=an%20toan')).v === '/news?q=an%20toan', 'giữ cả query string');
say((await dich(B + '/')).v === '/', 'trang chủ -> /');
say((await dich(B + '/dang-nhap/')).v === '/', 'vào thẳng /dang-nhap/ -> / (không dùng lại đích cũ)');

console.log('\n--- chặn chuyển huớng ra ngoài (đường dẫn tương đối giao thức)');
for (const [u, ten] of [
  [B + '//vidu-doc-hai.com', '//vidu-doc-hai.com'],
  [B + '/%2F%2Fvidu-doc-hai.com', '/%2F%2F...'],
  [B + '/\\vidu-doc-hai.com', '/\\vidu-doc-hai.com'],
]) {
  const v = (await dich(u)).v;
  // v === null nghia la Apache tra 404/loi, KHONG render form => cang an toan
  // (vd /%2F%2F... bi chan boi AllowEncodedSlashes Off, khong co form de loi dung).
  const an = v === null || v === '/'
             || (v.charAt(0) === '/' && v.charAt(1) !== '/' && v.charAt(1) !== '\\');
  say(an, `${ten} -> không thành đích ngoài`, String(v));
}

console.log('\n--- nhớ đích qua lần nhập sai mật khẩu');
const ctx = await b.newContext({ ignoreHTTPSErrors:true });
const p = await ctx.newPage();
await p.goto(B + '/news/43', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(700);
await p.fill('input[name="httpd_username"]', 'khong-he-co-tai-khoan-nay');
await p.fill('input[name="httpd_password"]', 'sai-hoan-toan');
await p.click('button[type=submit]');
await p.waitForTimeout(2500);
const sau = await p.locator('input[name="httpd_location"]').getAttribute('value').catch(()=>null);
say(sau === '/news/43', 'sai mật khẩu xong vẫn nhớ /news/43', `${p.url()} -> ${sau}`);
await ctx.close();
await b.close();
console.log(fail ? `\n  ${fail} MỤC HỎNG` : '\n  TOÀN BỘ ĐẠT.');
process.exit(fail?1:0);
