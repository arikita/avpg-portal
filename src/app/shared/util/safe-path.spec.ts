import { safePath } from './safe-path';

/**
 * Luat loc PII nay duoc DUNG O BA NOI: analytics (gui ra Google),
 * telemetry (luu DB noi bo) va `_safe_path()` ben server/app/telemetry.py.
 * Lech mot noi la so lieu khong doi chieu duoc — va khong co gi bao loi.
 */
describe('safePath', () => {
  it('bo ten nguoi dung khoi /profile', () => {
    expect(safePath('/profile/haivl')).toBe('/profile/*');
    expect(safePath('/profile/nguyen.van.a')).toBe('/profile/*');
  });

  it('bo ten nguoi dung khoi /wall', () => {
    expect(safePath('/wall/haivl')).toBe('/wall/*');
  });

  it('giu nguyen duong dan khong co dinh danh', () => {
    expect(safePath('/feed')).toBe('/feed');
    expect(safePath('/news/42')).toBe('/news/42');
    expect(safePath('/')).toBe('/');
  });

  it('cat query va fragment — o do hay lot ten dang nhap', () => {
    expect(safePath('/feed?user=haivl')).toBe('/feed');
    expect(safePath('/profile/haivl?tab=posts#top')).toBe('/profile/*');
  });

  it('chi thay doan DAU, khong an nham doan sau', () => {
    expect(safePath('/news/profile/haivl')).toBe('/news/profile/haivl');
  });

  it('chiu duoc dau vao rong / khong hop le', () => {
    expect(safePath('')).toBe('');
    expect(safePath(undefined as unknown as string)).toBe('');
  });

  it('cat do dai de khong lam phinh ban ghi', () => {
    expect(safePath('/x'.repeat(400)).length).toBe(300);
  });
});
