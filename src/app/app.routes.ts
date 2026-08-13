import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./features/home/home').then((m) => m.Home), title: 'AVP Group - Cổng thông tin nội bộ' },
  { path: 'onboarding', loadComponent: () => import('./features/onboarding/onboarding').then((m) => m.Onboarding), title: 'AVP Group - Cổng thông tin nội bộ' },
  { path: 'portal', loadComponent: () => import('./features/portal/portal').then((m) => m.Portal), title: 'AVP Group - Cổng thông tin nội bộ' },
  { path: 'directory', loadComponent: () => import('./features/directory/directory').then((m) => m.Directory), title: 'AVP Group - Cổng thông tin nội bộ' },
  { path: 'policies', loadComponent: () => import('./features/policies/policies').then((m) => m.Policies), title: 'AVP Group - Cổng thông tin nội bộ' },
  { path: 'regulations', loadComponent: () => import('./features/regulations/regulations').then((m) => m.Regulations), title: 'AVP Group - Cổng thông tin nội bộ' },
  { path: 'help', loadComponent: () => import('./features/help/help').then((m) => m.Help), title: 'AVP Group - Cổng thông tin nội bộ' },
  { path: 'faq', loadComponent: () => import('./features/faq/faq').then((m) => m.Faq), title: 'AVP Group - Cổng thông tin nội bộ' },
  { path: 'news', loadComponent: () => import('./features/news/news').then((m) => m.News), title: 'AVP Group - Cổng thông tin nội bộ' },
  { path: 'news/new', loadComponent: () => import('./features/news/news-editor').then((m) => m.NewsEditor), title: 'AVP Group - Cổng thông tin nội bộ' },
  { path: 'news/:id/edit', loadComponent: () => import('./features/news/news-editor').then((m) => m.NewsEditor), title: 'AVP Group - Cổng thông tin nội bộ' },
  { path: 'news/:id', loadComponent: () => import('./features/news/news-detail').then((m) => m.NewsDetail), title: 'AVP Group - Cổng thông tin nội bộ' },
  { path: 'gallery', loadComponent: () => import('./features/gallery/gallery').then((m) => m.Gallery), title: 'AVP Group - Cổng thông tin nội bộ' },
  { path: 'gallery/:slug', loadComponent: () => import('./features/gallery/gallery').then((m) => m.Gallery), title: 'AVP Group - Cổng thông tin nội bộ' },
  { path: 'feed', loadComponent: () => import('./features/feed/feed').then((m) => m.Feed), title: 'AVP Group - Cổng thông tin nội bộ' },
  { path: 'chat', loadComponent: () => import('./features/chat/chat').then((m) => m.Chat), title: 'AVP Group - Cổng thông tin nội bộ' },
  { path: 'profile', loadComponent: () => import('./features/profile/profile').then((m) => m.Profile), title: 'AVP Group - Cổng thông tin nội bộ' },
  { path: 'profile/:username', loadComponent: () => import('./features/profile/profile').then((m) => m.Profile), title: 'AVP Group - Cổng thông tin nội bộ' },
  { path: 'admin', loadComponent: () => import('./features/admin/admin').then((m) => m.Admin), title: 'AVP Group - Cổng thông tin nội bộ' },
  { path: '**', redirectTo: '' },
];
