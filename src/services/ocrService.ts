import type { SupabaseClient } from '@supabase/supabase-js';
import { maskAll } from '@/lib/security/masking';
import { setFileStatus } from './fileService';

type SaveOcrInput = {
  uploadedFileId: string;
  rawText: string;
  maskedText?: string;
  confidence: number;
  engine: 'tesseract_js' | 'manual' | 'other';
};

export async function saveOcrResult(
  supabase: SupabaseClient,
  userId: string,
  input: SaveOcrInput,
) {
  // 서버에서 한 번 더 마스킹 적용 (이중 안전망)
  const masked = maskAll(input.maskedText ?? input.rawText ?? '');

  const { data, error } = await supabase
    .from('ocr_results')
    .insert({
      user_id: userId,
      uploaded_file_id: input.uploadedFileId,
      raw_text: input.rawText, // 7일 후 NULL 처리(별도 잡)
      masked_text: masked,
      confidence: input.confidence,
      engine: input.engine,
    })
    .select('*')
    .single();
  if (error) throw error;

  await setFileStatus(supabase, userId, input.uploadedFileId, 'ocr_done');
  return data;
}

export async function getLatestOcrResult(
  supabase: SupabaseClient,
  userId: string,
  uploadedFileId: string,
) {
  const { data, error } = await supabase
    .from('ocr_results')
    .select('*')
    .eq('user_id', userId)
    .eq('uploaded_file_id', uploadedFileId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * 7일 경과 raw_text 폐기. cron 또는 관리자 잡에서 호출.
 */
export async function purgeOldRawText(supabase: SupabaseClient, ttlDays = 7) {
  const cutoff = new Date(Date.now() - ttlDays * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase
    .from('ocr_results')
    .update({ raw_text: null, raw_text_purged_at: new Date().toISOString() })
    .lt('created_at', cutoff)
    .is('raw_text_purged_at', null);
  if (error) throw error;
}
