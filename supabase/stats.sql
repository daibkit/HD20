-- =====================================================================
-- HDX20 — Đếm lượt truy cập & lượt click từng mục (xem trong admin, tab “Thống kê”).
-- Chạy MỘT LẦN: Supabase → SQL Editor → New query → dán → Run. Chạy lại vẫn an toàn.
-- Người xem chỉ GHI được qua hàm hit(); chỉ admin đọc được chi tiết. Tổng lượt truy cập công khai.
-- =====================================================================
create table if not exists public.site_hits (
  k     text   not null check (k ~ '^[a-z0-9:_./#-]{1,90}$'),
  day   date   not null default (now() at time zone 'Asia/Ho_Chi_Minh')::date,
  label text   not null default '',
  n     bigint not null default 0,
  primary key (k, day)
);
alter table public.site_hits enable row level security;
drop policy if exists "admin_doc_hits" on public.site_hits;
create policy "admin_doc_hits" on public.site_hits for select to authenticated using (public.is_admin());
drop policy if exists "admin_xoa_hits" on public.site_hits;
create policy "admin_xoa_hits" on public.site_hits for delete to authenticated using (public.is_admin());
grant select, delete on public.site_hits to authenticated;

create or replace function public.hit(p_k text, p_label text default '') returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_k is null or p_k !~ '^[a-z0-9:_./#-]{1,90}$' then return; end if;
  insert into public.site_hits(k, day, label, n)
  values (p_k, (now() at time zone 'Asia/Ho_Chi_Minh')::date, left(coalesce(p_label,''), 80), 1)
  on conflict (k, day) do update set n = site_hits.n + 1;
end $$;
grant execute on function public.hit(text, text) to anon, authenticated;

create or replace function public.visit_total() returns bigint
language sql security definer set search_path = public stable as $$
  select coalesce(sum(n), 0)::bigint from public.site_hits where k = 'visit';
$$;
grant execute on function public.visit_total() to anon, authenticated;
