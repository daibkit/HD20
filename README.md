# Anh em ơi! Về nhà — 20 năm Đội SVTN Đồng hương Hải Dương - NEU

Website công khai triển khai trên Vercel (https://hdx20y.vercel.app).

| Đường dẫn | Tệp | Nội dung |
|---|---|---|
| `/` | `index.html` | Trang sự kiện (xuất từ artifact thiết kế), có mục menu "Tin tức" |
| `/tin-tuc` | `tin-tuc.html` | Tin tức: đọc trực tiếp từ Supabase (dự phòng: `content.json`) |
| `/admin` | `admin.html` | Trang quản trị: đăng nhập admin, thêm/sửa/xoá chuyên mục, danh mục, bài viết, tải ảnh |

`config.js` chứa địa chỉ Supabase và khoá **anon** (khoá công khai — an toàn vì quyền ghi được bảo vệ bằng RLS).

## Cài đặt Supabase (làm một lần)

1. Vào https://supabase.com → **New project** (Region: Southeast Asia (Singapore)). Ghi nhớ mật khẩu database.
2. **SQL Editor → New query**: dán toàn bộ `supabase/schema.sql` → **Run**. Sau đó dán `supabase/seed.sql` → **Run** (dữ liệu mẫu).
   - Email admin được khai báo ở đầu `schema.sql` (bảng `admins`). Đổi nếu cần.
3. **Authentication → Users → Add user → Create new user**: nhập email admin + mật khẩu, tick **Auto Confirm User**.
4. **Authentication → Sign In / Providers → Email**: tắt **Allow new users to sign up** (không ai tự đăng ký được).
5. **Authentication → URL Configuration**: Site URL = `https://hdx20y.vercel.app`; thêm Redirect URLs
   `https://hdx20y.vercel.app/admin` và `https://hdx20y.vercel.app/admin.html` (để link "Quên mật khẩu" hoạt động).
6. **Project Settings → API**: chép **Project URL** và khoá **anon public** vào `config.js`, commit → Vercel tự triển khai.

## Bảo mật
- Khách (anon) chỉ đọc được chuyên mục/danh mục đang hiển thị và bài **đã xuất bản**.
- Chỉ email trong bảng `admins` mới ghi được dữ liệu và tải ảnh (kiểm tra ở database, không chỉ ở giao diện).
- Mọi thay đổi gửi qua hàm `apply_ops` trong một giao dịch: không bao giờ để lại bài viết mất danh mục.
- Thêm admin khác: `insert into public.admins(email) values ('email@...');` rồi tạo user tương ứng ở bước 3.

## Cập nhật trang sự kiện
Trang sự kiện là bản xuất từ artifact thiết kế; nội dung của nó không sửa qua admin. Khi thiết kế đổi, xuất lại `index.html`.

## Sửa nội dung TRANG CHỦ trong admin

Ngoài Tin tức, admin có mục **Trang chủ** để sửa: Lịch sử 20 năm, Giải thể thao, Hoạt động ngày hội, HD Radioshow, Tiếng gọi HDX, Liên hệ, Lời hẹn ước và Cài đặt chung (video giới thiệu, đồng hồ đếm ngược, mở/đóng đăng ký).

Chạy **một lần** tệp `supabase/site_content.sql` trong Supabase (SQL Editor → New query → dán → Run). Chưa có dữ liệu thì trang chủ dùng nội dung gốc; bấm “Lưu thay đổi” ở admin là trang chủ dùng nội dung mới (người xem thấy sau khi tải lại trang).

## Chỉnh sửa trực tiếp trên website

Đăng nhập ở `/admin` một lần, rồi mở trang chủ hoặc trang Tin tức: góc dưới bên trái có nút **✎ Chỉnh sửa trang** (chỉ admin thấy).
- **Trang chủ:** bật chế độ, bấm vào chữ có viền cam (lịch sử, giải thể thao, hoạt động, radio, bài hát, liên hệ, lời hẹn ước) → sửa trong hộp thoại → Lưu.
- **Bài viết (Tin tức):** bật chế độ, sửa trực tiếp tiêu đề, mô tả ngắn, nội dung (có thanh định dạng) → Lưu bài.
Quyền ghi do Supabase kiểm tra, người không phải admin không lưu được. Cần đã chạy `supabase/site_content.sql` cho phần trang chủ.

## Bảo tàng ký ức: ảnh theo thư mục khóa, lưu trên Google Drive

1. Chạy `supabase/museum.sql` trong Supabase (SQL Editor) — bảng lưu danh sách ảnh (id Drive + tiêu đề, năm, chú thích).
2. Trong admin → **Bảo tàng ký ức** → làm theo 4 bước ở khung “Kết nối Google Drive” (tạo Google Apps Script từ mã mẫu `apps-script/Code.gs.txt`, triển khai ứng dụng web, dán địa chỉ `/exec` vào admin).
3. Chọn khóa (K48–K67) → chọn nhiều ảnh hoặc kéo thả. Ảnh được thu nhỏ rồi lưu vào thư mục `HDX20 - Bảo tàng ký ức/K50/…` trên Drive của bạn, và hiện ngay trên trang chủ (mục Bảo tàng ký ức). Có thể sửa tiêu đề/năm/chú thích, đổi thứ tự, xoá; nút “Đồng bộ từ Drive” thêm các ảnh bạn tự bỏ vào thư mục trên Drive.
Chỉ tài khoản admin mới tải lên / xoá được (Apps Script kiểm tra lại với Supabase).
