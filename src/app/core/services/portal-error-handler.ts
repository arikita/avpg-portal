import { ErrorHandler, inject, Injectable } from '@angular/core';
import { TelemetryService } from './telemetry.service';

/**
 * Thay ErrorHandler mac dinh cua Angular de moi loi chua bat deu duoc ghi lai.
 *
 * KHONG can tu gan window.onerror / unhandledrejection: app.config.ts da co
 * `provideBrowserGlobalErrorListeners()`, no dang ky san hai listener do va
 * dan ca hai vao ErrorHandler nay. Tu gan them = bao cao trung moi loi hai lan.
 */
@Injectable()
export class PortalErrorHandler implements ErrorHandler {
  private readonly telemetry = inject(TelemetryService);

  handleError(error: unknown): void {
    try {
      const err = unwrap(error);
      this.telemetry.report({
        kind: kindOf(err),
        message: messageOf(err),
        stack: err instanceof Error ? err.stack || '' : '',
      });
    } catch {
      // Bao loi that bai thi thoi, tuyet doi khong nem tiep tu trong ErrorHandler.
    }
    // Van in ra console: nguoi dev mo F12 phai thay loi nhu truoc khi co telemetry.
    console.error(error);
  }
}

/** Angular boc loi trong `rejection` khi no den tu promise bi tu choi. */
function unwrap(error: unknown): unknown {
  const e = error as { rejection?: unknown } | null;
  return e && typeof e === 'object' && 'rejection' in e && e.rejection ? e.rejection : error;
}

/**
 * ChunkLoadError duoc tach rieng CO CHU DICH: do chinh la dau hieu cua bay
 * "chunk rac" tung lam trang trang ngay 13/08 — trinh duyet giu index.html cu
 * trong cache roi doi mot chunk khong con ton tai. Server xep no muc critical.
 */
function kindOf(err: unknown): string {
  const name = (err as Error)?.name || '';
  const msg = messageOf(err);
  if (name === 'ChunkLoadError' || /Failed to fetch dynamically imported module|Loading chunk \S+ failed/i.test(msg)) {
    return 'ChunkLoadError';
  }
  if (err instanceof Error) return name || 'Error';
  return 'UnhandledRejection';
}

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message || String(err);
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err).slice(0, 1000);
  } catch {
    return String(err);
  }
}
