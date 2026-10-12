-- =====================================================================
-- HDX20 — Bảo tàng ký ức: danh sách ảnh theo thư mục khóa (K48…K67).
-- File ảnh nằm trên Google Drive của bạn; bảng này chỉ lưu id file + chú thích.
-- Chạy MỘT LẦN: Supabase → SQL Editor → New query → dán → Run. Chạy lại vẫn an toàn.
-- =====================================================================
create table if not exists public.museum_photos (
  id         text primary key check (id ~ '^[A-Za-z0-9_.~:@+-]{1,80}$'),
  k          text not null check (k ~ '^K[0-9]{1,3}$'),
  drive_id   text not null check (drive_id ~ '^[A-Za-z0-9_-]{10,100}$'),
  title      text not null default '' check (length(title) <= 120),
  year       text not null default '' check (length(year) <= 20),
  caption    text not null default '' check (length(caption) <= 400),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint museum_photos_drive_key unique (k, drive_id)
);
alter table public.museum_photos add column if not exists kind text not null default 'image' check (kind in ('image','video'));
-- “Xoá” ảnh trong admin chỉ gỡ khỏi website (hidden = true): dòng dữ liệu và tệp trên Drive được giữ nguyên, có thể khôi phục.
alter table public.museum_photos add column if not exists hidden boolean not null default false;
create index if not exists museum_photos_k_idx on public.museum_photos(k, sort_order);
alter table public.museum_photos enable row level security;
drop policy if exists "doc_cong_khai" on public.museum_photos;
create policy "doc_cong_khai" on public.museum_photos for select using (true);
drop policy if exists "admin_ghi" on public.museum_photos;
create policy "admin_ghi" on public.museum_photos for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.museum_photos to anon, authenticated;
grant insert, update, delete on public.museum_photos to authenticated;
