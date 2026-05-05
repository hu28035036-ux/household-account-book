import type { SupabaseClient } from '@supabase/supabase-js';
import { maskAll } from '@/lib/security/masking';
import { getLatestOcrResult } from './ocrService';
import { getFile, setFileStatus } from './fileService';
import { ollamaGenerate, OllamaUnavailableError } from '@/lib/ollama/client';
import { buildExtractionPrompt } from '@/lib/ai/prompt';
import { parseExtractionLoose, type ExtractionResult } from '@/lib/ai/extractionSchema';
import { checkDuplicate } from '@/lib/duplicate/check';
import { inputHash } from '@/lib/learning/hash';
import {
  getLearningHints,
  getCachedExtraction,
  setCachedExtraction,
  applyLearningPostprocess,
} from './learningService';

export async function runExtractionForFile(
  supabase: SupabaseClient,
  userId: string,
  uploadedFileId: string,
) {
  const file = await getFile(supabase, userId, uploadedFileId);
  if (!file) throw new Error('파일이 없습니다.');
  const ocr = await getLatestOcrResult(supabase, userId, uploadedFileId);
  if (!ocr || !ocr.masked_text) throw new Error('OCR 결과가 없습니다.');

  await setFileStatus(supabase, userId, uploadedFileId, 'ai_processing');

  const masked = maskAll(ocr.masked_text);
  const hash = inputHash(masked);
  const sourceType = inferSourceType(file.file_type, file.file_name);

  let extraction: ExtractionResult;
  let hitCache = false;
  let modelName = process.env.OLLAMA_MODEL ?? 'gemma4:e4b';

  // 1) 캐시 적중 시 Ollama 호출 생략
  const cached = await getCachedExtraction(supabase, userId, hash);
  if (cached) {
    extraction = parseExtractionLoose(JSON.stringify(cached));
    hitCache = true;
  } else {
    // 2) 학습 힌트
    const hints = await getLearningHints(supabase, userId);
    const prompt = buildExtractionPrompt(masked, hints);

    // 3) ai_extraction_jobs 시작 기록
    const { data: jobRow } = await supabase
      .from('ai_extraction_jobs')
      .insert({
        user_id: userId,
        uploaded_file_id: uploadedFileId,
        ocr_result_id: ocr.id,
        model_name: modelName,
        status: 'running',
        input_text_masked: masked,
      })
      .select('*')
      .single();

    try {
      let raw: string;
      try {
        raw = await ollamaGenerate({ prompt, format: 'json', temperature: 0.1 });
      } catch (e) {
        if (e instanceof OllamaUnavailableError) {
          await supabase
            .from('ai_extraction_jobs')
            .update({ status: 'failed', error_message: e.message })
            .eq('id', jobRow!.id);
          await setFileStatus(supabase, userId, uploadedFileId, 'failed');
          throw e;
        }
        throw e;
      }

      try {
        extraction = parseExtractionLoose(raw);
      } catch {
        // 1회 재시도 (temperature 0)
        const raw2 = await ollamaGenerate({ prompt, format: 'json', temperature: 0 });
        extraction = parseExtractionLoose(raw2);
      }

      await supabase
        .from('ai_extraction_jobs')
        .update({ status: 'success', extracted_json: extraction as any })
        .eq('id', jobRow!.id);
    } catch (e) {
      await supabase
        .from('ai_extraction_jobs')
        .update({ status: 'failed', error_message: e instanceof Error ? e.message : 'unknown' })
        .eq('id', jobRow!.id);
      await setFileStatus(supabase, userId, uploadedFileId, 'failed');
      throw e;
    }

    await setCachedExtraction(supabase, userId, hash, sourceType, extraction);
  }

  // 4) 환각 검증 + 학습 후처리 + 중복 검사 + 후보 insert
  const ocrTextNoSpace = masked.replace(/\s+/g, '');

  // 최근 30일 거래만 비교
  const thirty = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data: recentTx } = await supabase
    .from('transactions')
    .select('transaction_date, amount, merchant_name, payment_method_id')
    .eq('user_id', userId)
    .gte('transaction_date', thirty);

  const inserted: any[] = [];
  for (const t of extraction.transactions) {
    const warnings: string[] = [...(t.warnings ?? [])];
    if (t.transaction_date == null) warnings.push('date_uncertain');
    if (t.amount == null) warnings.push('amount_uncertain');
    if (t.merchant_name == null) warnings.push('merchant_uncertain');

    if (t.raw_text_basis) {
      const basisNoSpace = t.raw_text_basis.replace(/\s+/g, '');
      if (basisNoSpace && !ocrTextNoSpace.includes(basisNoSpace)) {
        warnings.push('basis_not_found');
        t.confidence = Math.max(0, t.confidence - 0.15);
      }
    }

    let candidate = {
      merchant_name: t.merchant_name ?? null,
      category_suggestion: t.category_suggestion ?? null,
      payment_method_suggestion: t.payment_method_suggestion ?? null,
      confidence: t.confidence ?? 0.5,
      warnings,
    };
    candidate = await applyLearningPostprocess(supabase, userId, candidate);

    const dup = checkDuplicate(
      {
        transaction_date: t.transaction_date ?? null,
        amount: t.amount ?? null,
        merchant_name: candidate.merchant_name,
        payment_method_suggestion: candidate.payment_method_suggestion,
      },
      (recentTx ?? []) as any[],
    );

    const { data: row, error } = await supabase
      .from('transaction_candidates')
      .insert({
        user_id: userId,
        uploaded_file_id: uploadedFileId,
        transaction_date: t.transaction_date ?? null,
        type: t.type,
        amount: t.amount ?? null,
        merchant_name: candidate.merchant_name,
        description: t.description ?? '',
        category_suggestion: candidate.category_suggestion,
        payment_method_suggestion: candidate.payment_method_suggestion,
        confidence: candidate.confidence,
        duplicate_status: dup,
        raw_text_basis: t.raw_text_basis ?? null,
        warnings: candidate.warnings as any,
        user_action: 'pending',
      })
      .select('*')
      .single();
    if (error) throw error;
    inserted.push(row);
  }

  await setFileStatus(supabase, userId, uploadedFileId, 'parsed');
  return { hitCache, candidates: inserted, document_type: extraction.document_type, global_warnings: extraction.global_warnings };
}

function inferSourceType(fileType: string | null, fileName: string): string {
  if (fileType?.startsWith('image/')) return 'receipt_image';
  if (/\.pdf$/i.test(fileName)) return 'pdf';
  if (/\.csv$/i.test(fileName)) return 'csv';
  if (/\.xlsx?$/i.test(fileName)) return 'excel';
  return 'receipt_image';
}
