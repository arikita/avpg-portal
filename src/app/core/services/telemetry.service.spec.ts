import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TelemetryService } from './telemetry.service';

/**
 * Chi test nhung luat mà neu hong se lam HAI thay vi giup:
 * gop trung, tran moi phien, va cong tac tat.
 */
describe('TelemetryService', () => {
  let svc: TelemetryService;
  let sent: number;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    svc = TestBed.inject(TelemetryService);
    sent = 0;
    spyOn(window, 'fetch').and.callFake(() => {
      sent++;
      return Promise.resolve(new Response(null, { status: 204 }));
    });
  });

  it('gop trung: cung mot loi lap nhieu lan chi gui MOT', () => {
    for (let i = 0; i < 20; i++) svc.report({ kind: 'Error', message: 'giong het nhau' });
    expect(queueSize(svc)).toBe(1);
  });

  it('tran moi phien: khong vuot qua 30 su kien', () => {
    for (let i = 0; i < 100; i++) svc.report({ kind: 'Error', message: `khac nhau ${i}` });
    expect(countSent(svc)).toBeLessThanOrEqual(30);
  });

  it('tat thi khong thu thap gi nua', () => {
    svc.setEnabled(false);
    svc.report({ kind: 'Error', message: 'sau khi tat' });
    expect(queueSize(svc)).toBe(0);
  });

  it('breadcrumb khong giu qua 20 muc', () => {
    for (let i = 0; i < 50; i++) svc.crumb('click', `nut ${i}`);
    expect(svc.snapshot().breadcrumbs.length).toBe(20);
  });

  it('snapshot khong nem khi chua co build.json', () => {
    expect(() => svc.snapshot()).not.toThrow();
  });
});

// Doc field rieng tu qua ep kieu: test o day co chu dich bam vao noi bo, vi
// chinh cac gioi han noi bo la thu can duoc bao ve.
function queueSize(svc: TelemetryService): number {
  return (svc as unknown as { queue: unknown[] }).queue.length;
}
function countSent(svc: TelemetryService): number {
  return (svc as unknown as { sentCount: number }).sentCount;
}

/**
 * Chan tai dien su co 22/08/2026 (trang trang, NG0200).
 *
 * PortalErrorHandler duoc dang ky lam ErrorHandler va inject TelemetryService.
 * Angular tao ErrorHandler rat som, truoc Router. Neu TelemetryService doi
 * Router ngay luc khoi tao thi thanh vong ErrorHandler -> Telemetry -> Router
 * -> ErrorHandler, va app KHONG bootstrap duoc.
 */
describe('TelemetryService — khong duoc keo Router vao luc khoi tao', () => {
  it('tao duoc khi KHONG co Router trong injector', () => {
    TestBed.resetTestingModule();
    // Co y KHONG provideRouter(): giong het hoan canh ErrorHandler duoc tao som.
    TestBed.configureTestingModule({ providers: [] });
    expect(() => TestBed.inject(TelemetryService)).not.toThrow();
  });
});
