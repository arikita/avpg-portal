import { expect, test, type Page } from '@playwright/test';

/**
 * Duyet moi route: khong loi console, khong request 4xx/5xx, co noi dung that.
 *
 * Gan @readonly de ban chay dinh ky 30 phut loc duoc bang --grep @readonly —
 * cac kich ban nay khong ghi gi vao he thong.
 */

/** Moi route cong khai + mot phan tu bat buoc phai co mat. */
const ROUTES: [string, string][] = [
  ['/', 'header.navbar'],
  ['/onboarding', 'main'],
  ['/portal', 'main'],
  ['/directory', 'main'],
  ['/policies', 'main'],
  ['/regulations', 'main'],
  ['/help', 'main'],
  ['/faq', 'main'],
  ['/news', 'main'],
  ['/gallery', 'main'],
  ['/feed', 'main'],
  ['/chat', 'main'],
  ['/profile', 'main'],
  // Bang dieu khien la mot component cho 7 tab; moi tab la mot component con
  // lazy nen phai mo tung cai — tab hong chi lo ra khi thuc su render.
  ['/admin', 'main'],
  ['/admin/content', 'main'],
  ['/admin/news', 'main'],
  ['/admin/users', 'main'],
  ['/admin/analytics', 'main'],
  ['/admin/errors', 'main'],
  ['/admin/system', 'main'],
];

/** Bo qua tieng on khong phai loi that cua ung dung. */
function isNoise(text: string): boolean {
  return /favicon|ResizeObserver loop|googletagmanager|gtag/i.test(text);
}

function watch(page: Page) {
  const consoleErrors: string[] = [];
  const badRequests: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && !isNoise(m.text())) consoleErrors.push(m.text());
  });
  page.on('response', (r) => {
    const u = r.url();
    // /api/ws dung ve mot lan, 401/403 o do la thiet ke chu khong phai loi.
    if (r.status() >= 400 && !isNoise(u) && !u.includes('/api/ws')) {
      badRequests.push(`${r.status()} ${u}`);
    }
  });
  return { consoleErrors, badRequests };
}

for (const [path, mustSee] of ROUTES) {
  test(`@readonly route ${path} mo duoc va sach loi`, async ({ page }) => {
    const seen = watch(page);
    const res = await page.goto(path, { waitUntil: 'networkidle' });
    expect(res?.status(), `HTTP cua ${path}`).toBeLessThan(400);
    await expect(page.locator(mustSee).first()).toBeVisible();
    expect(seen.badRequests, `request hong tren ${path}`).toEqual([]);
    expect(seen.consoleErrors, `loi console tren ${path}`).toEqual([]);
  });
}

test('@readonly khong co chunk nao thieu (bay da lam trang site 13/08)', async ({ page }) => {
  const missing: string[] = [];
  page.on('response', (r) => {
    if (r.status() === 404 && /\.(js|css)$/.test(r.url())) missing.push(r.url());
  });
  // Duyet vai trang de keo cac chunk lazy ve.
  for (const p of ['/', '/news', '/feed', '/directory', '/gallery']) {
    await page.goto(p, { waitUntil: 'networkidle' });
  }
  expect(missing, 'chunk thieu tren dia').toEqual([]);
});

test('@readonly /api/health tra ve moi muc ok', async ({ request }) => {
  const res = await request.get('/api/health');
  expect(res.status()).toBe(200);
  const h = (await res.json()) as Record<string, string>;
  for (const [k, v] of Object.entries(h)) {
    if (k === 'build') continue;
    expect(v, `health.${k}`).toBe('ok');
  }
});
