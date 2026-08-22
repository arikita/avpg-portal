import { expect, test } from '@playwright/test';

/**
 * Kiem chung CHINH HE THONG BAT LOI — thu de nghiem thu quan trong nhat.
 *
 * Mot he giam sat khong duoc tu tin la minh dang chay: neu duong ong telemetry
 * chet thi /admin/errors trong tron, va im lang se bi hieu nham la khoe manh.
 */

test('@readonly duong ong telemetry con song', async ({ request }) => {
  const res = await request.get('/api/telemetry/metrics');
  expect(res.status(), 'Zabbix cung goi duong nay').toBe(200);
  const m = (await res.json()) as Record<string, number | string>;
  expect(m['enabled'], 'TELEMETRY_ENABLED dang tat!').toBe(1);
  expect(m['db_ok'], 'telemetry khong noi duoc DB').toBe(1);
});

test('loi phia trinh duyet co di toi server', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });

  const posted = page.waitForRequest(
    (r) => r.url().includes('/api/telemetry/client') && r.method() === 'POST',
    { timeout: 20_000 },
  );

  // Nem mot loi that su chua bat, giong het loi that.
  await page.evaluate(() => {
    setTimeout(() => {
      throw new Error('e2e-kiem-tra-duong-ong');
    }, 0);
  });

  const req = await posted;
  const body = JSON.parse(req.postData() || '{}') as { events?: { message?: string }[] };
  expect(
    (body.events || []).some((e) => (e.message || '').includes('e2e-kiem-tra-duong-ong')),
    'lo gui len khong chua loi vua nem',
  ).toBe(true);
});

test('nut Bao loi co mat tren moi trang', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.locator('app-bug-report button.bug-btn')).toBeVisible();
});
