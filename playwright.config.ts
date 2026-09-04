import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright vua la kiem thu e2e, vua la synthetic monitoring.
 *
 * Xac thuc di duong BASIC: Apache co nhanh `AuthType Basic` -> LDAP, nen chi
 * can httpCredentials — khoi phai dung ve Kerberos trong runner.
 *
 * BO CHAY DUOC CHI TU 10.10.100.128 (hcm-clasvr). Tu 25/08/2026 nhanh Basic bi
 * gioi han IP: trinh duyet nguoi dung nao con nho mat khau Basic cu se tu gui
 * lai header do, roi vao nhanh Basic va an POPUP CU cua trinh duyet — dung cai
 * ma trang /dang-nhap sinh ra de thay the. Chay bo nay tu may khac se ra 401
 * kem trang dang nhap chu khong xac thuc duoc; doi IP thi sua allowlist trong
 * server/apache/avp-portal.conf.
 *
 * Mat khau doc tu bien moi truong, TUYET DOI khong commit:
 *
 *   PORTAL_USER=... PORTAL_PASS=... npx playwright test
 *
 * Chay hai che do:
 *   - `npx playwright test`            sau moi deploy (co ca luong GHI)
 *   - `SYNTHETIC=1 npx playwright test --grep @readonly`  dinh ky 30 phut
 *
 * Che do dinh ky CHI CHAY LUONG DOC. Ly do: /feed gop bai tuong cua MOI NGUOI,
 * nen kich ban "dang bai roi xoa" chay 30 phut/lan se rai bai test cho ca cong
 * ty nhin thay trong khoang giua hai buoc. Da co tien le phai don 8 bai
 * claude-demo-* + 7 bai TEST ngay 20/08.
 */
const BASE = process.env['PORTAL_URL'] || 'https://portal.anvietphatgroup.com';

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env['CI'] ? 1 : 0,
  reporter: [['list'], ['json', { outputFile: 'e2e/.report.json' }]],
  use: {
    baseURL: BASE,
    ignoreHTTPSErrors: true,
    httpCredentials:
      process.env['PORTAL_USER'] && process.env['PORTAL_PASS']
        ? { username: process.env['PORTAL_USER'], password: process.env['PORTAL_PASS'] }
        : undefined,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          // May chu nay khong bat duoc sandbox cua nhan (VM khong co user namespace).
          args: ['--no-sandbox', '--disable-dev-shm-usage'],
          executablePath: process.env['CHROME_BIN'] || undefined,
        },
      },
    },
  ],
});
