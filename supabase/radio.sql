-- =====================================================================
-- HDX20 — Kho tệp cho HD Radioshow (âm thanh / video tải lên từ admin).
-- Chạy MỘT LẦN: Supabase → SQL Editor → New query → dán → Run. Chạy lại vẫn an toàn.
-- Giới hạn mỗi tệp 50 MB (mức tối đa của gói miễn phí Supabase).
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('radio', 'radio', true, 52428800,
  array['audio/mpeg','audio/mp3','audio/mp4','audio/x-m4a','audio/aac','audio/wav','audio/x-wav','audio/ogg','video/mp4','video/webm','video/quicktime'])
on conflict (id) do update set public = true, file_size_limit = 52428800, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "radio_admin_insert" on storage.objects;
create policy "radio_admin_insert" on storage.objects for insert to authenticated with check (bucket_id = 'radio' and public.is_admin());
drop policy if exists "radio_admin_update" on storage.objects;
create policy "radio_admin_update" on storage.objects for update to authenticated using (bucket_id = 'radio' and public.is_admin());
drop policy if exists "radio_admin_delete" on storage.objects;
create policy "radio_admin_delete" on storage.objects for delete to authenticated using (bucket_id = 'radio' and public.is_admin());
