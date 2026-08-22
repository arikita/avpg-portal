import { ChangeDetectionStrategy, Component, HostListener, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api';
import { LanguageService } from '../../../core/services/language.service';
import { TelemetryService } from '../../../core/services/telemetry.service';
import { IconComponent } from '../icon/icon';

/**
 * Nut "Bao loi" noi o goc duoi-phai.
 *
 * Ly do ton tai: nhan vien o day hiem khi mo ticket — ho chiu dung hoac nhan
 * Zalo cho dong nghiep. Mot nut ngay tren trang, kem san ngu canh ky thuat,
 * la cach re nhat de bien "portal dao nay lag" thanh mot dong co the tra duoc.
 *
 * Goc duoi-phai da co 2 nut (chat 22px, len-dau-trang 88px) nen nut nay dung
 * o 154px. Tu an khi nguoi dung dang go chu de khong che o nhap lieu.
 */
@Component({
  selector: 'app-bug-report',
  imports: [FormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bug-report.html',
  styleUrl: './bug-report.scss',
})
export class BugReport {
  private readonly api = inject(ApiService);
  private readonly telemetry = inject(TelemetryService);
  readonly lang = inject(LanguageService).lang;

  readonly open = signal(false);
  readonly typing = signal(false);
  readonly sending = signal(false);
  readonly desc = signal('');
  readonly attach = signal(true);
  readonly code = signal('');
  readonly error = signal('');

  @HostListener('document:focusin', ['$event'])
  onFocusIn(ev: FocusEvent): void {
    if (this.open()) return;
    const el = ev.target as HTMLElement | null;
    this.typing.set(!!el?.closest('input,textarea,[contenteditable="true"]'));
  }

  @HostListener('document:focusout')
  onFocusOut(): void {
    this.typing.set(false);
  }

  toggle(): void {
    this.open.update((v) => !v);
    if (this.open()) {
      this.code.set('');
      this.error.set('');
      this.typing.set(false);
    }
  }

  async send(): Promise<void> {
    const description = this.desc().trim();
    if (!description || this.sending()) return;
    this.sending.set(true);
    this.error.set('');

    const snap = this.telemetry.snapshot();
    const body: Record<string, unknown> = { description, route: snap.route };
    if (this.attach()) {
      body['url'] = snap.route;
      body['requestId'] = snap.requestId;
      body['breadcrumbs'] = snap.breadcrumbs;
      body['build'] = snap.build;
      body['screen'] = `${window.innerWidth}x${window.innerHeight}`;
    }

    const res = await this.api.json<{ ok: boolean; code: string }>('/api/telemetry/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    this.sending.set(false);

    if (!res?.ok) {
      this.error.set(
        this.lang() === 'vi'
          ? 'Không gửi được. Vui lòng thử lại hoặc báo trực tiếp cho IT.'
          : 'Could not send. Please retry or contact IT directly.',
      );
      return;
    }
    this.code.set(res.code || '');
    this.desc.set('');
  }
}
