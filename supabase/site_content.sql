-- =====================================================================
-- HDX20 — nội dung TRANG CHỦ chỉnh được trong admin (Lịch sử, Thể thao, Hoạt động, Lịch trình 24.10,
-- Radio, Bài hát, Liên hệ, Lời hẹn ước, Cài đặt).
-- Chạy MỘT LẦN: Supabase → SQL Editor → New query → dán → Run. Chạy lại vẫn an toàn.
-- Không cần dữ liệu mẫu: chưa có dòng nào thì trang chủ dùng nội dung gốc.
-- =====================================================================
create table if not exists public.site_content (
  key        text primary key check (key in ('history','sports','activities','radios','songs','contacts','slides','settings','agenda')),
  data       jsonb not null check (jsonb_typeof(data) in ('array','object') and pg_column_size(data) < 200000),
  updated_at timestamptz not null default now()
);
-- Bảng đã tạo từ trước: mở rộng danh sách khóa cho phép (thêm 'agenda' = Lịch trình 24.10).
alter table public.site_content drop constraint if exists site_content_key_check;
alter table public.site_content add constraint site_content_key_check check (key in ('history','sports','activities','radios','songs','contacts','slides','settings','agenda'));
alter table public.site_content enable row level security;
drop policy if exists "doc_cong_khai" on public.site_content;
create policy "doc_cong_khai" on public.site_content for select using (true);
drop policy if exists "admin_ghi" on public.site_content;
create policy "admin_ghi" on public.site_content for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.site_content to anon, authenticated;
grant insert, update, delete on public.site_content to authenticated;
