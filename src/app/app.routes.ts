import { Routes } from '@angular/router';

/** Tieu de trang: hien tren tab trinh duyet, bookmark, va la chieu "Page title"
 *  trong bao cao GA4. Truoc 18/08/2026 ca 20 route dung chung mot chuoi nen moi
 *  bao cao gop lam mot dong — dat rieng tung trang moi doc duoc. */
const BRAND = 'AVP Group';
const title = (page: string) => page + ' — ' + BRAND;

export const routes: Routes = [
  { path: '', loadComponent: () => import('./features/home/home').then((m) => m.Home), title: 'AVP Group - Cổng thông tin nội bộ' },
  { path: 'onboarding', loadComponent: () => import('./features/onboarding/onboarding').then((m) => m.Onboarding), title: title('Hội nhập') },
  // Bai kiem tra sau buoi hoi nhap IT. Duong dan tieng Viet vi link nay duoc
  // doc len trong buoi training va dan trong email moi nhan vien moi.
  { path: 'onboarding/kiem-tra', loadComponent: () => import('./features/onboarding/quiz').then((m) => m.Quiz), title: title('Kiểm tra hội nhập IT') },
  { path: 'onboarding/cam-ket', loadComponent: () => import('./features/onboarding/cam-ket').then((m) => m.CamKet), title: title('Cam kết bảo mật') },
  // BAT BUOC dat SAU hai route cu the o tren: Angular khop route theo THU TU,
  // de truoc thi 'kiem-tra' bi hieu la ten mot phong ban va trang bai kiem tra
  // BIEN MAT ma khong bao gi. Cung cai bay 'gallery/manage' trong CLAUDE.md.
  // Hang RESERVED trong onboarding.content.ts giu cho hai ten do; co test khoa.
  { path: 'onboarding/:phong', loadComponent: () => import('./features/onboarding/phong').then((m) => m.OnboardingPhong), title: title('Hội nhập') },
  { path: 'portal', loadComponent: () => import('./features/portal/portal').then((m) => m.Portal), title: title('Công cụ') },
  { path: 'directory', loadComponent: () => import('./features/directory/directory').then((m) => m.Directory), title: title('Liên hệ') },
  { path: 'policies', loadComponent: () => import('./features/policies/policies').then((m) => m.Policies), title: title('Chính sách') },
  { path: 'tuyen-dung', loadComponent: () => import('./features/recruit/recruit').then((m) => m.Recruit), title: title('Tuyển dụng') },
  { path: 'regulations', loadComponent: () => import('./features/regulations/regulations').then((m) => m.Regulations), title: title('Quy định IT') },
  { path: 'help', loadComponent: () => import('./features/help/help').then((m) => m.Help), title: title('Hỗ trợ') },
  { path: 'faq', loadComponent: () => import('./features/faq/faq').then((m) => m.Faq), title: title('FAQ') },
  { path: 'news', loadComponent: () => import('./features/news/news').then((m) => m.News), title: title('Tin tức') },
  { path: 'news/new', loadComponent: () => import('./features/news/news-editor').then((m) => m.NewsEditor), title: title('Viết tin mới') },
  { path: 'news/:id/edit', loadComponent: () => import('./features/news/news-editor').then((m) => m.NewsEditor), title: title('Sửa tin') },
  { path: 'news/:id', loadComponent: () => import('./features/news/news-detail').then((m) => m.NewsDetail), title: title('Chi tiết tin') },
  { path: 'gallery', loadComponent: () => import('./features/gallery/gallery').then((m) => m.Gallery), title: title('Hình ảnh') },
  // PHAI khai TRUOC 'gallery/:slug', neu khong 'manage' bi coi la ten album.
  // Backend cung giu 'manage' trong RESERVED de khong album nao chiem ten do.
  { path: 'gallery/manage', loadComponent: () => import('./features/gallery/manage').then((m) => m.GalleryManage), title: title('Quản lý thư viện ảnh') },
  { path: 'gallery/:slug', loadComponent: () => import('./features/gallery/gallery').then((m) => m.Gallery), title: title('Hình ảnh') },
  { path: 'feed', loadComponent: () => import('./features/feed/feed').then((m) => m.Feed), title: title('Đời sống') },
  { path: 'chat', loadComponent: () => import('./features/chat/chat').then((m) => m.Chat), title: title('Trò chuyện') },
  { path: 'profile', loadComponent: () => import('./features/profile/profile').then((m) => m.Profile), title: title('Hồ sơ của tôi') },
  { path: 'profile/:username', loadComponent: () => import('./features/profile/profile').then((m) => m.Profile), title: title('Hồ sơ nhân viên') },
  { path: 'admin', loadComponent: () => import('./features/admin/admin').then((m) => m.Admin), title: title('Quản trị') },
  // Bang dieu khien la MOT component, tab nam trong duong dan: /admin/errors,
  // /admin/analytics... Giu nguyen /admin/errors?id=123 ma thong bao loi tu
  // server van dang gui di (xem telemetry.py) — doi duong dan la lam hong het
  // cac thong bao da nam trong hop thu nguoi dung.
  { path: 'admin/:tab', loadComponent: () => import('./features/admin/admin').then((m) => m.Admin), title: title('Quản trị') },
  { path: '**', redirectTo: '' },
];
