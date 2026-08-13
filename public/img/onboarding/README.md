# Ảnh hướng dẫn (screenshots) cho Onboarding

Thả các ảnh chụp màn hình thật vào thư mục này, ví dụ:
`outlook-setup.png`, `wifi-connect.png`, `workit-booking.png`, `change-password.png`…

Chúng được phục vụ tại đường dẫn `/img/onboarding/<tên-file>`.

## Cách chèn ảnh vào một mục hướng dẫn
Mở `src/app/content/onboarding.content.ts`, thêm một block dạng `image` vào mảng
`blocks` của mục tương ứng:

```ts
{
  kind: 'image',
  src: '/img/onboarding/outlook-setup.png',
  alt: { vi: 'Màn hình cài đặt Outlook', en: 'Outlook setup screen' },
  caption: { vi: 'Bước 1: nhập email công ty', en: 'Step 1: enter your company email' },
},
```

Ảnh sẽ tự canh chiều rộng, bo góc và hiện chú thích (caption) song ngữ.
Định dạng nên dùng: PNG hoặc WebP, chiều rộng ~1000–1400px là đủ nét.
