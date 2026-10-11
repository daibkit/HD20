# Anh em ơi! Về nhà — 20 năm Đội SVTN Đồng hương Hải Dương - NEU

Website công khai (tĩnh) cho dịp kỷ niệm 20 năm. Nội dung nằm trong `content.json`, được xuất từ CMS
("Sao lưu & Xuất" → "Tải content.json").

## Cập nhật nội dung
1. Sửa và xuất bản bài trong CMS.
2. Tải `content.json` từ CMS.
3. Trên GitHub: **Add file → Upload files** → kéo `content.json` vào → **Commit changes**.
4. Khoảng 1 phút sau GitHub Pages cập nhật website.

## Cấu trúc
- `index.html` — trang web (đọc `content.json`, điều hướng bằng `#/chuyen-muc/...`, `#/bai-viet/...`)
- `content.json` — chuyên mục, danh mục và bài viết đã xuất bản
- `img/` — logo và ảnh
- `.nojekyll` — để GitHub Pages phục vụ tệp nguyên trạng
