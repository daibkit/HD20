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
