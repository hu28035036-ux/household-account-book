import type { SupabaseClient } from '@supabase/supabase-js';
import { maskAll } from '@/lib/security/masking';
import { getLatestOcrResult } from './ocrService';
import { getFile, getSignedUrl, setFileStatus } from './fileService';
import { llmGenerate, LLMUnavailableError } from '@/lib/ai/llmRouter';
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

  // 이미지면 vision 으로 직접 분석 가능 → OCR 없어도 진행. 비이미지는 OCR 필수.
  const isImage = !!file.file_type?.startsWith('image/');
  if (!isImage && (!ocr || !ocr.masked_text)) {
    throw new Error('OCR 결과가 없습니다.');
  }

  await setFileStatus(supabase, userId, uploadedFileId, 'ai_processing');

  const masked = ocr?.masked_text ? maskAll(ocr.masked_text) : '';
  // 이미지+OCR 조합일 때 동일 OCR 텍스트도 캐시 hit 가능. 이미지 단독일 땐 fileId 기반.
  const hash = inputHash(masked || `image:${uploadedFileId}`);
  const sourceType = inferSourceType(file.file_type, file.file_name);

  let extraction: ExtractionResult;
  let hitCache = false;
  let modelName = process.env.OPENAI_API_KEY
    ? process.env.OPENAI_MODEL ?? 'gpt-4o-mini'
    : process.env.OLLAMA_MODEL ?? 'gemma4:e4b';

  // 영수증/카드내역 이미지면 OpenAI Vision 으로 함께 분석 (OCR 보정).
  // 함수 상단에서 한 번 발급 — 캐시 hit 분기에서도 후처리 가드(basis_not_found)에 사용.
  let imageUrls: string[] | undefined;
  if (isImage && file.storage_path) {
    try {
      const signed = await getSignedUrl(supabase, file.storage_path, 600);
      if (signed) imageUrls = [signed];
    } catch {
      // 시그니처 실패해도 OCR 텍스트만으로 진행
    }
  }

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
        ocr_result_id: ocr?.id ?? null,
        model_name: modelName,
        status: 'running',
        input_text_masked: masked || '(image-only — OCR 텍스트 없음, vision 직접 분석)',
      })
      .select('*')
      .single();

    try {
      let raw: string;
      try {
        const r = await llmGenerate({ prompt, temperature: 0.1, imageUrls });
        raw = r.content;
        modelName = r.model;
      } catch (e) {
        if (e instanceof LLMUnavailableError) {
          await supabase
            .from('ai_extraction_jobs')
            .update({ status: 'failed', error_message: e.message, model_name: modelName })
            .eq('id', jobRow!.id);
          await setFileStatus(supabase, userId, uploadedFileId, 'failed');
          throw e;
        }
        throw e;
      }

      try {
        extraction = parseExtractionLoose(raw);
      } catch {
        // 1회 재시도 (temperature 0, 이미지도 그대로 전달)
        const r2 = await llmGenerate({ prompt, temperature: 0, imageUrls });
        extraction = parseExtractionLoose(r2.content);
        modelName = r2.model;
      }

      await supabase
        .from('ai_extraction_jobs')
        .update({ status: 'success', extracted_json: extraction as any, model_name: modelName })
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
      // Vision (이미지 직접 분석) 가 활성됐으면 raw_text_basis 가 OCR 텍스트와
      // 일치하지 않을 수 있음 — AI 가 이미지에서 본 정보가 OCR 에는 없을 수 있어
      // false positive 방지로 confidence 페널티 완화 + warning 만 부여.
      if (basisNoSpace && !ocrTextNoSpace.includes(basisNoSpace)) {
        warnings.push('basis_not_found');
        const penalty = imageUrls ? 0.05 : 0.15;
        t.confidence = Math.max(0, t.confidence - penalty);
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
