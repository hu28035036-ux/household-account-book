-- Supabase Storage 정책 — 'receipts' 버킷, 사용자 폴더 격리
-- 버킷 생성은 Dashboard에서 수행 (private)

-- 기존 정책이 있으면 정리
drop policy if exists "user_can_read_own_files" on storage.objects;
drop policy if exists "user_can_upload_own_files" on storage.objects;
drop policy if exists "user_can_update_own_files" on storage.objects;
drop policy if exists "user_can_delete_own_files" on storage.objects;

create policy "user_can_read_own_files"
on storage.objects for select to authenticated
using (
  bucket_id = 'receipts'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "user_can_upload_own_files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'receipts'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "user_can_update_own_files"
on storage.objects for update to authenticated
using (
  bucket_id = 'receipts'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "user_can_delete_own_files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'receipts'
  and auth.uid()::text = (storage.foldername(name))[1]
);
