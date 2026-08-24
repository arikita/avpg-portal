import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { LanguageService } from '../../../core/services/language.service';
import { UserService } from '../../../core/services/user.service';
import { IconComponent } from '../../../shared/components/icon/icon';
import { AdmTrend, Point, compact } from '../charts';
import { AdminStore, dayLabel, when } from '../admin.store';

/** Mot dong "viec can lam" da dich sang tieng nguoi. */
const TODO_TEXT: Record<string, { vi: (n: number) => string; en: (n: number) => string }> = {
  errors_critical: { vi: (n) => `${n} lỗi nghiêm trọng chưa xử lý`, en: (n) => `${n} critical errors unhandled` },
  errors_error: { vi: (n) => `${n} lỗi mới chưa xem`, en: (n) => `${n} new errors unreviewed` },
  news_overdue: { vi: (n) => `${n} bài hẹn giờ đã quá hạn mà chưa lên sóng`, en: (n) => `${n} scheduled posts past due` },
  news_soon: { vi: (n) => `${n} bài sẽ tự lên sóng trong 24 giờ tới`, en: (n) => `${n} posts publish within 24h` },
  telemetry_off: {
    vi: () => 'Thu thập lỗi đang TẮT — sẽ không có lỗi nào được ghi nhận',
    en: () => 'Telemetry is OFF — no errors are being recorded',
  },
  no_traffic: {
    vi: () => 'Không có request nào trong 5 phút qua — hoặc không ai dùng, hoặc bộ đếm đã chết',
    en: () => 'No requests in the last 5 minutes — nobody online, or the counter died',
  },
};

@Component({
  selector: 'app-admin-overview',
  imports: [RouterLink, IconComponent, AdmTrend],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './overview.html',
})
export class AdminOverview {
  readonly store = inject(AdminStore);
  readonly lang = inject(LanguageService).lang;
  private readonly user = inject(UserService);
  private readonly router = inject(Router);

  readonly vi = computed(() => this.lang() === 'vi');
  readonly me = this.user.me;
  readonly ov = this.store.overview;

  readonly viewSeries = computed<Point[]>(() =>
    (this.ov()?.series ?? []).map((d) => ({ label: dayLabel(d.date), value: d.views })),
  );
  readonly userSeries = computed<Point[]>(() =>
    (this.ov()?.series ?? []).map((d) => ({ label: dayLabel(d.date), value: d.users })),
  );

  /** Chenh lech so voi hom qua, tinh theo %. null = hom qua bang 0 (chia cho 0). */
  readonly deltaUsers = computed(() => this.delta('users'));
  readonly deltaViews = computed(() => this.delta('views'));

  private delta(k: 'users' | 'views'): number | null {
    const o = this.ov();
    if (!o || !o.yesterday[k]) return null;
    return Math.round(((o.today[k] - o.yesterday[k]) / o.yesterday[k]) * 100);
  }

  readonly errorTotal = this.store.newErrors;

  todoText(key: string, n: number): string {
    const t = TODO_TEXT[key];
    if (!t) return key;
    return this.vi() ? t.vi(n) : t.en(n);
  }

  todoIcon(level: string): string {
    return level === 'critical' ? 'alert-triangle' : level === 'warning' ? 'bell' : 'info';
  }

  fmt = compact;
  when = when;

  /** Bam mot dong "viec can lam" thi nhay sang dung tab xu ly no. */
  go(tab: string): void {
    void this.router.navigate(['/admin', tab]);
  }

  reload(): void {
    void this.store.load(true);
  }
}
