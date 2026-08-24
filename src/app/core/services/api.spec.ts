import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ApiService } from './api';
import { TelemetryService } from './telemetry.service';

/**
 * Chi test dung mot luat, nhung la luat quyet dinh bang loi co dang doc khong:
 * KHI NAO mot "Failed to fetch" duoc coi la loi that.
 *
 * Boi canh 24/08/2026: `lienttk` sinh hai NetworkError luc 10:20:22, nhung log
 * Apache cho thay ca hai request do tra 200 trong 40ms ngay sau do, va nguoi do
 * khong goi API nao suot 81 phut truoc đó. May ngu day / Edge dong bang tab nen
 * => trinh duyet huy fetch dang do. Bao nhung lan nhu vay chi lam ban bang loi.
 */
describe('ApiService — khi nao bao NetworkError', () => {
  let api: ApiService;
  let reported: { kind: string; message: string }[];

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    api = TestBed.inject(ApiService);
    reported = [];
    const tel = TestBed.inject(TelemetryService);
    spyOn(tel, 'report').and.callFake((e) => {
      reported.push({ kind: e.kind, message: e.message });
    });
  });

  /** Gia lap trang thai tab / mang ma khong dung toi bien that. */
  function setState(visibility: 'visible' | 'hidden', online: boolean): void {
    spyOnProperty(document, 'visibilityState', 'get').and.returnValue(visibility);
    spyOnProperty(navigator, 'onLine', 'get').and.returnValue(online);
  }

  async function failingCall(): Promise<void> {
    spyOn(window, 'fetch').and.returnValue(Promise.reject(new TypeError('Failed to fetch')));
    await api.fetch('/api/notifications').catch(() => undefined);
  }

  it('nguoi dung DANG NHIN va CO MANG: bao — day moi la API hong that', async () => {
    setState('visible', true);
    await failingCall();
    expect(reported.map((r) => r.kind)).toContain('NetworkError');
  });

  it('tab dang an (may ngu / Edge dong bang tab): KHONG bao', async () => {
    setState('hidden', true);
    await failingCall();
    expect(reported.length).toBe(0);
  });

  it('may mat mang: KHONG bao — do la mang cua nguoi dung, khong phai portal hong', async () => {
    setState('visible', false);
    await failingCall();
    expect(reported.length).toBe(0);
  });

  it('van nem loi ra ngoai de noi goi tu lui ve, du khong bao cao', async () => {
    setState('hidden', true);
    spyOn(window, 'fetch').and.returnValue(Promise.reject(new TypeError('Failed to fetch')));
    await expectAsync(api.fetch('/api/notifications')).toBeRejected();
  });
});
