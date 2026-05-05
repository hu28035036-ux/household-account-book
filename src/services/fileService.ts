import type { SupabaseClient } from '@supabase/supabase-js';

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? 'receipts';

function buildPath(userId: string, ext: string): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const uuid = crypto.randomUUID();
  const safeExt = (ext || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${userId}/${yyyy}/${mm}/${uuid}.${safeExt}`;
}

export async function uploadFile(
  supabase: SupabaseClient,
  userId: string,
  file: File,
) {
  const ext = (file.name.split('.').pop() || '').slice(0, 8);
  const storagePath = buildPath(userId, ext);

  const arrayBuffer = await file.arrayBuffer();
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, arrayBuffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });
  if (upErr) throw upErr;

  const { data, error } = await supabase
    .from('uploaded_files')
    .insert({
      user_id: userId,
      file_name: file.name,
      file_type: file.type || null,
      file_size: file.size,
      storage_path: storagePath,
      status: 'uploaded',
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function listFiles(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('uploaded_files')
    .select('*')
    .eq('user_id', userId)
    .neq('status', 'deleted')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return data ?? [];
}

export async function getFile(supabase: SupabaseClient, userId: string, id: string) {
  const { data, error } = await supabase
    .from('uploaded_files')
    .select('*')
    .eq('user_id', userId)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getSignedUrl(
  supabase: SupabaseClient,
  storagePath: string,
  ttlSeconds = 60,
) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, ttlSeconds);
  if (error) throw error;
  return data.signedUrl;
}

export async function softDeleteFile(supabase: SupabaseClient, userId: string, id: string) {
  const file = await getFile(supabase, userId, id);
  if (!file) return;

  // Storage 삭제
  await supabase.storage.from(BUCKET).remove([file.storage_path]);

  // 상태만 soft delete (감사 흔적 유지)
  const { error } = await supabase
    .from('uploaded_files')
    .update({ status: 'deleted' })
    .eq('user_id', userId)
    .eq('id', id);
  if (error) throw error;
}

export async function setFileStatus(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  status:
    | 'uploaded'
    | 'ocr_processing'
    | 'ocr_done'
    | 'ai_processing'
    | 'parsed'
    | 'failed'
    | 'approved'
    | 'deleted',
) {
  const { error } = await supabase
    .from('uploaded_files')
    .update({ status })
    .eq('user_id', userId)
    .eq('id', id);
  if (error) throw error;
}
