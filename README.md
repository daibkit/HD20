# Anh em ơi! Về nhà — 20 năm Đội SVTN Đồng hương Hải Dương - NEU

Website công khai triển khai trên Vercel (https://hdx20y.vercel.app).

| Đường dẫn | Tệp | Nội dung |
|---|---|---|
| `/` | `index.html` | Trang sự kiện (xuất từ artifact thiết kế), có mục menu "Tin tức" |
| `/thu-moi` | `thu-moi.html` | Thư mời: điền tên người được mời vào ảnh thư mời và tải ảnh JPG/PNG, chia sẻ qua Zalo/Messenger. `img/thu-moi-mau.jpg` là mẫu gốc (hiện khi chưa nhập tên), `img/thu-moi-nen.jpg` là mẫu đã xoá 2 dòng lời chào chung để in "Thân gửi + tên" vào. Nút "Thư mời" nằm cạnh "Trang chủ" trên menu |
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
3. Chọn khóa (K48–K67) → chọn nhiều ảnh hoặc kéo thả. Ảnh và video (không giới hạn dung lượng, gửi từng phần 3 MB) được lưu nguyên bản vào thư mục `HDX20 - Bảo tàng ký ức/K50/…` trên Drive của bạn, và hiện ngay trên trang chủ (mục Bảo tàng ký ức). Có thể sửa tiêu đề/năm/chú thích, đổi thứ tự, xoá; nút “Đồng bộ từ Drive” thêm các ảnh bạn tự bỏ vào thư mục trên Drive.
Chỉ tài khoản admin mới tải lên / xoá được (Apps Script kiểm tra lại với Supabase).

Lưu ý khi nâng cấp: chạy lại `supabase/museum.sql` (thêm cột `kind` cho video), dán lại mã Apps Script mới (nút “Sao chép mã”) rồi **Triển khai → Phiên bản mới**; lần đầu Google sẽ hỏi cấp lại quyền Drive.

## Đăng ký tham dự → tab “Đăng ký” trong admin
1. Supabase → SQL Editor → dán và chạy `supabase/registrations.sql` (một lần).
2. Form “Đăng ký” trên trang chủ gửi thẳng vào bảng `registrations`. Người xem website **chỉ gửi được, không đọc được** danh sách.
3. Admin → tab **Đăng ký**: xem thống kê, tìm/lọc (khóa, ngày tham dự, đã liên hệ), đánh dấu đã liên hệ, ghi chú nội bộ, xoá, xuất CSV (mở được bằng Excel/Google Sheets).
4. Cùng tên + cùng số điện thoại chỉ được ghi một lần (bấm gửi 2 lần không bị trùng).

## HD Radioshow: nhúng YouTube hoặc tải tệp lên
1. Supabase → SQL Editor → chạy `supabase/radio.sql` (một lần) để tạo kho tệp `radio` (tối đa 50 MB/tệp).
2. Admin → **Trang chủ** → tab **HD Radioshow**: mỗi số radio có ô **Link hoặc ID YouTube** (dán nguyên link, hệ thống tự lấy ID) và nút **Tải tệp lên** (MP3/M4A/WAV/OGG hoặc MP4/WebM/MOV). Có cả hai thì ưu tiên tệp tải lên. Bấm **Lưu thay đổi**.
3. Tệp lớn hơn 50 MB: đăng lên YouTube rồi dán link. Ô YouTube ở “Tiếng gọi HDX” và video giới thiệu cũng nhận nguyên link.

## Mục Video trên trang chủ
Admin bật “Sửa trang” trên website rồi bấm vào tiêu đề, mô tả, nút hoặc khung video để sửa chữ và dán link YouTube (hoặc sửa ở Trang chủ → Cài đặt chung). Để trống link thì ẩn video.

### Video giới thiệu tải lên
Admin → Trang chủ → Cài đặt chung (hoặc “Sửa trang” → bấm vào mục Video) → **Tải video lên**: tệp được lưu trên Google Drive của bạn (thư mục “Video giới thiệu”), tự phát (tắt tiếng) khi mở trang và được ưu tiên hơn link YouTube. Video YouTube không tự phát. Cần **dán lại mã Apps Script mới** (`apps-script/Code.gs.txt`) và triển khai “Phiên bản mới”.


### Thư mục Drive & xoá ảnh (Bảo tàng ký ức)
- Admin → Bảo tàng ký ức → **Tạo thư mục Drive**: tạo sẵn đủ K48–K67 và “Video giới thiệu” trong thư mục gốc trên Google Drive (cần dán lại mã Apps Script mới và Triển khai → Phiên bản mới).
- **Xoá** một ảnh chỉ gỡ nó khỏi website (cột `hidden`): dòng dữ liệu và tệp trên Drive được giữ nguyên, khôi phục ở mục “Ảnh đã gỡ”. Cần chạy lại `supabase/museum.sql` một lần để có cột `hidden`.

## Bài viết chi tiết cho “Chuỗi hoạt động”
- Mỗi thẻ trong “Chuỗi hoạt động” (trang chủ) có thể có bài viết chi tiết: khách bấm thẻ (hoặc “Đọc bài chi tiết →”) để mở trang bài viết (`#/hoat-dong/<số>`).
- Admin bật “Chỉnh sửa trang”: bấm thẻ để sửa tên/mô tả hoặc xoá; “＋ Thêm hoạt động” để thêm; bấm **Viết bài chi tiết →** trên thẻ để soạn nội dung ngay trên trang (đậm, nghiêng, tiêu đề phụ, danh sách, trích dẫn, liên kết, chèn **ảnh** — lưu bucket `media` của Supabase — và **video**: YouTube, Google Drive hoặc tải lên Drive qua Apps Script). Bấm **Lưu bài**.
- Nội dung bài được làm sạch (chỉ giữ thẻ an toàn, iframe chỉ YouTube/Google Drive) và lưu trong cột `body` của mục `chain` trong bảng `site_content`.

## Hoạt động trong năm (trang Giới thiệu Đội)

Mục "Một năm của Đội" lấy dữ liệu từ khóa `activities`. Ở chế độ chỉnh sửa: bấm thẻ để sửa nhóm/tên/mô tả/ảnh, "＋ Thêm hoạt động trong năm" để thêm; "Viết bài chi tiết →" để soạn bài (ảnh, video, liên kết) tại `#/ngay-hoi/N`. Không cần chạy thêm SQL.

## Thống kê truy cập & click

Chạy `supabase/stats.sql` một lần. Website ghi lượt truy cập, lượt xem trang và lượt click từng mục (ẩn danh, qua hàm `hit()`). Admin xem chi tiết ở tab "Thống kê". Không đếm khi đang bật chế độ chỉnh sửa; muốn tắt đếm trên một trình duyệt: `localStorage.hdx_nostat='1'`.

## Sửa chữ khối Hero

Ở chế độ chỉnh sửa, bấm vào tiêu đề/mô tả/ngày/địa điểm ở đầu trang chủ để sửa (lưu trong `settings`: heroAccent, heroTitle, heroDesc, heroDate, heroPlace). Favicon: `img/favicon.png`.

## Bảo tàng ký ức & form đăng ký (trang chủ)

Mục "Bảo tàng ký ức" nằm cuối trang chủ (sau form đăng ký). Ở chế độ chỉnh sửa, bấm vào tiêu đề của nó, hoặc vào chữ bên cạnh form đăng ký, để sửa (lưu trong `settings`: kyLabel, kyTitle, regLabel, regTitle, regText, regInfo).

## Chữ ở trang Bảo tàng ký ức và chân trang

Chế độ chỉnh sửa: bấm vào đoạn đầu trang Bảo tàng, vào tagline/tiêu đề/mô tả của từng mục 01 · 02 · 03, hoặc vào 2 cột chữ ở chân trang để sửa (lưu trong `settings`). Tên 3 nút ở đầu trang Bảo tàng lấy theo tiêu đề từng mục.

Trang Giới thiệu Đội: bấm vào tagline/tiêu đề/mô tả đầu trang để sửa. Ba nhóm "Một năm của Đội" luôn theo thứ tự: Sự kiện nội bộ → Tình nguyện thường kỳ → Chương trình lớn trong năm.

## Đăng ký → Google Sheet

Mỗi lượt đăng ký vẫn lưu vào Supabase (bản chính) và đồng thời tự thêm một dòng vào Google Sheet "HDX20 - Đăng ký tham dự" ở Drive của bạn (qua Apps Script, cần đã dán mã mới + chạy `authorize()` + "Phiên bản mới"). Sheet nằm riêng, không nằm trong thư mục ảnh chia sẻ công khai. Admin → Đăng ký → "Đẩy tất cả sang Google Sheet" để ghi lại toàn bộ danh sách (chạy lại không bị trùng, kèm trạng thái "Đã liên hệ" và ghi chú BTC).

Báo lỗi quyền Drive: lỗi từ Apps Script giờ ghi rõ bước + thư mục nào (kèm ID) bị chặn, và có nút "Kiểm tra quyền thư mục" (Admin → Bảo tàng ký ức) liệt kê từng thư mục gốc/K48–K67/Video/Sheet đăng ký: ✅ có quyền, ❌ lỗi gì. Cần dán lại mã Apps Script mới + "Phiên bản mới".

Thống kê: log click ghi theo dạng "Trang › Khu vực › Thẻ › Nút" (VD: Bảo tàng ký ức › Tiếng gọi HDX › Bài trước); các bảng và biểu đồ ngày có phân trang (15 mục/trang, 10 ngày/trang).

## Nhiều bộ sưu tập Bảo tàng ký ức (nhiều thư mục Drive)

- Trang quản trị → Bảo tàng ký ức → **Bộ sưu tập**: “Thêm bộ sưu tập” để *tạo thư mục Drive mới* (“HDX20 - …”) hoặc *gắn thư mục có sẵn* (dán link). Mỗi bộ có các thư mục con K48–K67 riêng; tải ảnh / đồng bộ / tạo thư mục / kiểm tra quyền đều làm trên bộ đang chọn.
- “Quản lý”: đổi tên, chọn **một** bộ “Hiện trên website”, gỡ bộ khỏi danh sách (ảnh và thư mục Drive giữ nguyên). Danh sách lưu ở `settings.albums`.
- Trang Bảo tàng ký ức chỉ hiển thị MỘT bộ (bộ được chọn ở “Quản lý”), không có nút chọn bộ cho khách.
- Khi nâng cấp: chạy lại `supabase/museum.sql` (thêm cột `album`), dán lại mã Apps Script, **Triển khai → Phiên bản mới**.

- **Đồng bộ từ Drive** (tab Bảo tàng ký ức) giờ khớp hai chiều: thêm ảnh mới trong thư mục Drive, và hỏi xác nhận để **xoá khỏi website** những ảnh không còn nằm trong thư mục đó (đã xoá/chuyển đi). Chỉ ảnh của khóa + bộ sưu tập đang chọn bị ảnh hưởng.
- Nút **Đồng bộ cả bộ sưu tập** đồng bộ lần lượt tất cả K48–K67 của bộ đang chọn (thêm ảnh mới), rồi hỏi **một lần** để xoá các ảnh không còn trên Drive. Thư mục nào lỗi (VD thiếu quyền) thì bỏ qua, không xoá gì ở thư mục đó.

## Lời bài hát (mục Tiếng gọi HDX)

Mỗi bài hát có ô **Lời bài hát** (tối đa 6000 ký tự, mỗi câu một dòng, dòng trống để tách đoạn): sửa ở Admin → Trang chủ → Tiếng gọi HDX, hoặc bật “Chỉnh sửa trang” rồi bấm vào bài hát. Bài có lời hiện nhãn “Có lời” trong danh sách; khi bấm phát một bài có lời, khung lời tự hiện ở cột bên phải trình phát (trên điện thoại: bên dưới danh sách bài). Nút ✕ hoặc **Ẩn lời bài hát** để đóng; đã đóng thì các bài sau không tự mở lại cho tới khi bấm **Xem lời bài hát**. Không cần chạy SQL.
