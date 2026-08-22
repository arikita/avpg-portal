import {
  ApplicationConfig,
  ErrorHandler,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter, TitleStrategy, withInMemoryScrolling, withViewTransitions } from '@angular/router';

import { routes } from './app.routes';
import { AnalyticsService, AnalyticsTitleStrategy } from './core/services/analytics.service';
import { PortalErrorHandler } from './core/services/portal-error-handler';
import { TelemetryService } from './core/services/telemetry.service';

export const appConfig: ApplicationConfig = {
  providers: [
    // provideBrowserGlobalErrorListeners da dang ky window.error +
    // unhandledrejection va dan ca hai vao ErrorHandler => chi can thay
    // ErrorHandler la bat tron ca ba nguon, khong tu gan listener thu cong.
    provideBrowserGlobalErrorListeners(),
    { provide: ErrorHandler, useClass: PortalErrorHandler },
    provideAppInitializer(() => inject(TelemetryService).init()),
    provideAppInitializer(() => inject(AnalyticsService).init()),
    // Dat tieu de trang xong moi bao page_view cho GA4. Router phat
    // NavigationEnd TRUOC khi doi title, bao ngay luc do la GA nhan nham
    // tieu de cua trang truoc do.
    { provide: TitleStrategy, useClass: AnalyticsTitleStrategy },
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      withInMemoryScrolling({ anchorScrolling: 'enabled', scrollPositionRestoration: 'enabled' }),
      withViewTransitions(),
    ),
  ],
};
