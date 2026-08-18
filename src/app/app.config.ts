import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter, TitleStrategy, withInMemoryScrolling, withViewTransitions } from '@angular/router';

import { routes } from './app.routes';
import { AnalyticsService, AnalyticsTitleStrategy } from './core/services/analytics.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
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
