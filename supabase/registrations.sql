-- =====================================================================
-- HDX20 — Đăng ký tham dự (form trên trang chủ) → xem/quản lý trong admin, tab “Đăng ký”.
-- Chạy MỘT LẦN: Supabase → SQL Editor → New query → dán → Run. Chạy lại vẫn an toàn.
-- Người xem website CHỈ gửi (insert) được, không đọc được danh sách; chỉ admin đọc/sửa/xoá.
-- =====================================================================
create table if not exists public.registrations (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name       text not null check (length(trim(name)) between 1 and 80),
  k          text not null check (length(k) between 1 and 20),
  phone      text not null check (phone ~ '^[0-9+ .]{9,20}$'),
  guests     text not null default '' check (length(guests) <= 20),
  kids       text not null default '' check (length(kids) <= 20),
  days       text[] not null default '{}' check (cardinality(days) <= 6),
  dinner     text not null default '' check (length(dinner) <= 20),
  note       text not null default '' check (length(note) <= 600),
  handled    boolean not null default false,
  admin_note text not null default '' check (length(admin_note) <= 600)
);
-- Bảng đã tạo trước đó: thêm cột “Tham gia tiệc tối” (chạy lại tệp này là đủ).
alter table public.registrations add column if not exists dinner text not null default '' check (length(dinner) <= 20);
-- Cùng tên + cùng số điện thoại chỉ ghi một lần (bấm gửi 2 lần không bị trùng).
create unique index if not exists registrations_person_key on public.registrations (lower(trim(name)), regexp_replace(phone, '[^0-9+]', '', 'g'));
create index if not exists registrations_created_idx on public.registrations (created_at desc);
alter table public.registrations enable row level security;
drop policy if exists "gui_dang_ky" on public.registrations;
create policy "gui_dang_ky" on public.registrations for insert to anon, authenticated
  with check (handled = false and admin_note = '');
drop policy if exists "admin_doc_ghi" on public.registrations;
create policy "admin_doc_ghi" on public.registrations for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant insert on public.registrations to anon;
grant select, insert, update, delete on public.registrations to authenticated;
