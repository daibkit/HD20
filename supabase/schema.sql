-- =====================================================================
-- HDX20 — cơ sở dữ liệu Tin tức + tài khoản admin (Supabase / Postgres)
-- Chạy MỘT LẦN trong Supabase: SQL Editor → New query → dán toàn bộ → Run.
-- Chạy lại cũng an toàn (dùng IF NOT EXISTS / OR REPLACE).
-- =====================================================================

-- ---------- 1. Admin ----------
-- Email được phép quản trị. Đổi email bên dưới nếu cần, hoặc thêm dòng sau:
--   insert into public.admins(email) values ('email-khac@example.com');
create table if not exists public.admins (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);
insert into public.admins(email) values ('dainn.bkit@gmail.com') on conflict do nothing;
alter table public.admins enable row level security;  -- không có policy: không ai đọc/ghi qua API

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where email = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------- 2. Bảng nội dung ----------
create table if not exists public.sections (
  id          text primary key check (id ~ '^[A-Za-z0-9_.~:@+-]{1,80}$'),
  name        text not null check (length(trim(name)) between 1 and 120),
  slug        text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 90),
  description text not null default '' check (length(description) <= 600),
  image       text not null default '',
  sort_order  integer not null default 0 check (sort_order between 0 and 9999),
  status      text not null default 'active' check (status in ('active','inactive')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint sections_slug_key unique (slug) deferrable initially deferred
);

create table if not exists public.categories (
  id          text primary key check (id ~ '^[A-Za-z0-9_.~:@+-]{1,80}$'),
  section_id  text not null references public.sections(id) on update cascade on delete restrict deferrable initially deferred,
  name        text not null check (length(trim(name)) between 1 and 120),
  slug        text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 90),
  description text not null default '' check (length(description) <= 600),
  image       text not null default '',
  sort_order  integer not null default 0 check (sort_order between 0 and 9999),
  status      text not null default 'active' check (status in ('active','inactive')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint categories_section_slug_key unique (section_id, slug) deferrable initially deferred
);

create table if not exists public.articles (
  id           text primary key check (id ~ '^[A-Za-z0-9_.~:@+-]{1,80}$'),
  title        text not null check (length(trim(title)) between 1 and 200),
  slug         text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 90),
  excerpt      text not null default '' check (length(excerpt) <= 400),
  content      text not null default '' check (length(content) <= 250000),
  cover        text not null default '',
  section_id   text not null references public.sections(id) on delete restrict deferrable initially deferred,
  category_id  text not null references public.categories(id) on delete restrict deferrable initially deferred,
  author       text not null default '' check (length(author) <= 80),
  tags         text[] not null default '{}' check (cardinality(tags) <= 20),
  status       text not null default 'draft' check (status in ('draft','published','archived')),
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint articles_slug_key unique (slug) deferrable initially deferred
);
create index if not exists categories_section_idx on public.categories(section_id);
create index if not exists articles_category_idx on public.articles(category_id);
create index if not exists articles_status_pub_idx on public.articles(status, published_at desc);

-- Bài viết phải cùng chuyên mục với danh mục của nó (kiểm tra cuối giao dịch).
create or replace function public.check_article_section() returns trigger
language plpgsql as $$
begin
  if tg_table_name = 'articles' then
    if not exists (select 1 from public.categories c where c.id = new.category_id and c.section_id = new.section_id) then
      raise exception 'Bài viết "%" có chuyên mục không khớp với danh mục', new.title using errcode = '23514';
    end if;
  else
    if exists (select 1 from public.articles a where a.category_id = new.id and a.section_id <> new.section_id) then
      raise exception 'Danh mục "%" đổi chuyên mục nhưng bài viết chưa chuyển theo', new.name using errcode = '23514';
    end if;
  end if;
  return null;
end $$;
drop trigger if exists articles_section_check on public.articles;
create constraint trigger articles_section_check after insert or update on public.articles
  deferrable initially deferred for each row execute function public.check_article_section();
drop trigger if exists categories_section_check on public.categories;
create constraint trigger categories_section_check after update on public.categories
  deferrable initially deferred for each row execute function public.check_article_section();

-- ---------- 3. Quyền truy cập (RLS) ----------
alter table public.sections   enable row level security;
alter table public.categories enable row level security;
alter table public.articles   enable row level security;

drop policy if exists "doc_cong_khai" on public.sections;
create policy "doc_cong_khai" on public.sections for select using (status = 'active' or public.is_admin());
drop policy if exists "admin_ghi" on public.sections;
create policy "admin_ghi" on public.sections for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "doc_cong_khai" on public.categories;
create policy "doc_cong_khai" on public.categories for select using (
  public.is_admin() or (status = 'active' and exists (select 1 from public.sections s where s.id = categories.section_id and s.status = 'active')));
drop policy if exists "admin_ghi" on public.categories;
create policy "admin_ghi" on public.categories for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "doc_cong_khai" on public.articles;
create policy "doc_cong_khai" on public.articles for select using (
  public.is_admin() or (status = 'published' and exists (
    select 1 from public.categories c join public.sections s on s.id = c.section_id
    where c.id = articles.category_id and c.section_id = articles.section_id and c.status = 'active' and s.status = 'active')));
drop policy if exists "admin_ghi" on public.articles;
create policy "admin_ghi" on public.articles for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on public.sections, public.categories, public.articles to anon, authenticated;
grant insert, update, delete on public.sections, public.categories, public.articles to authenticated;

-- ---------- 4. Ghi nhiều thay đổi trong MỘT giao dịch ----------
-- ops: [{"op":"put","kind":"articles","rec":{...cột snake_case...}}, {"op":"del","kind":"sections","id":"..."}]
-- Tất cả thành công hoặc không có gì thay đổi; RLS vẫn áp dụng (security invoker).
create or replace function public.apply_ops(ops jsonb) returns integer
language plpgsql security invoker set search_path = public as $$
declare o jsonb; r jsonb; n integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Tài khoản này không có quyền quản trị' using errcode = '42501';
  end if;
  if jsonb_typeof(ops) <> 'array' or jsonb_array_length(ops) > 2000 then
    raise exception 'Dữ liệu gửi lên không hợp lệ' using errcode = '22023';
  end if;
  for o in select * from jsonb_array_elements(ops) loop
    r := o -> 'rec';
    if o->>'op' = 'put' and o->>'kind' = 'sections' then
      insert into sections as t (id,name,slug,description,image,sort_order,status,created_at,updated_at)
      values (r->>'id', r->>'name', r->>'slug', coalesce(r->>'description',''), coalesce(r->>'image',''),
              coalesce((r->>'sort_order')::int,0), coalesce(r->>'status','active'),
              coalesce((r->>'created_at')::timestamptz, now()), coalesce((r->>'updated_at')::timestamptz, now()))
      on conflict (id) do update set name=excluded.name, slug=excluded.slug, description=excluded.description, image=excluded.image,
        sort_order=excluded.sort_order, status=excluded.status, updated_at=excluded.updated_at;
    elsif o->>'op' = 'put' and o->>'kind' = 'categories' then
      insert into categories as t (id,section_id,name,slug,description,image,sort_order,status,created_at,updated_at)
      values (r->>'id', r->>'section_id', r->>'name', r->>'slug', coalesce(r->>'description',''), coalesce(r->>'image',''),
              coalesce((r->>'sort_order')::int,0), coalesce(r->>'status','active'),
              coalesce((r->>'created_at')::timestamptz, now()), coalesce((r->>'updated_at')::timestamptz, now()))
      on conflict (id) do update set section_id=excluded.section_id, name=excluded.name, slug=excluded.slug, description=excluded.description,
        image=excluded.image, sort_order=excluded.sort_order, status=excluded.status, updated_at=excluded.updated_at;
    elsif o->>'op' = 'put' and o->>'kind' = 'articles' then
      insert into articles as t (id,title,slug,excerpt,content,cover,section_id,category_id,author,tags,status,published_at,created_at,updated_at)
      values (r->>'id', r->>'title', r->>'slug', coalesce(r->>'excerpt',''), coalesce(r->>'content',''), coalesce(r->>'cover',''),
              r->>'section_id', r->>'category_id', coalesce(r->>'author',''),
              coalesce(array(select jsonb_array_elements_text(coalesce(r->'tags','[]'::jsonb))), '{}'),
              coalesce(r->>'status','draft'), nullif(r->>'published_at','')::timestamptz,
              coalesce((r->>'created_at')::timestamptz, now()), coalesce((r->>'updated_at')::timestamptz, now()))
      on conflict (id) do update set title=excluded.title, slug=excluded.slug, excerpt=excluded.excerpt, content=excluded.content,
        cover=excluded.cover, section_id=excluded.section_id, category_id=excluded.category_id, author=excluded.author, tags=excluded.tags,
        status=excluded.status, published_at=excluded.published_at, updated_at=excluded.updated_at;
    elsif o->>'op' = 'del' and o->>'kind' = 'sections' then
      delete from sections where id = o->>'id';
    elsif o->>'op' = 'del' and o->>'kind' = 'categories' then
      delete from categories where id = o->>'id';
    elsif o->>'op' = 'del' and o->>'kind' = 'articles' then
      delete from articles where id = o->>'id';
    else
      raise exception 'Thao tác không hợp lệ: %', o using errcode = '22023';
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.apply_ops(jsonb) from public, anon;
grant execute on function public.apply_ops(jsonb) to authenticated;

-- ---------- 5. Kho ảnh ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "media_admin_insert" on storage.objects;
create policy "media_admin_insert" on storage.objects for insert to authenticated with check (bucket_id = 'media' and public.is_admin());
drop policy if exists "media_admin_update" on storage.objects;
create policy "media_admin_update" on storage.objects for update to authenticated using (bucket_id = 'media' and public.is_admin());
drop policy if exists "media_admin_delete" on storage.objects;
create policy "media_admin_delete" on storage.objects for delete to authenticated using (bucket_id = 'media' and public.is_admin());
