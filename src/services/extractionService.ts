import type { SupabaseClient } from '@supabase/supabase-js';
import { maskAll } from '@/lib/security/masking';
import { getLatestOcrResult } from './ocrService';
import { getFile, getSignedUrl, setFileStatus } from './fileService';
import { llmGenerate, LLMUnavailableError } from '@/lib/ai/llmRouter';
import { buildExtractionPrompt } from '@/lib/ai/prompt';
import { parseExtractionLoose, type ExtractionResult } from '@/lib/ai/extractionSchema';
import { checkDuplicate } from '@/lib/duplicate/check';
import { inputHash } from '@/lib/learning/hash';
import { todayKSTISO } from '@/lib/formatting/date';
import {
  getLearningHints,
  getCachedExtraction,
  setCachedExtraction,
  applyLearningPostprocess,
} from './learningService';

/**
 * 1차(detail:low) 결과의 품질이 낮을 때 2차(detail:high)로 승급할지 판단.
 * 은행/카드 거래내역 캡처처럼 작은 글자가 빽빽한 케이스에서 low 가 거의 못 읽는 경우를 잡아낸다.
 * 영수증/카드 1건 케이스에서는 보통 1차에서 성공하므로 비용 회귀 없음.
 */
export function shouldUpgradeToHigh(extraction: ExtractionResult): boolean {
  const txs = extraction.transactions ?? [];
  if (txs.length === 0) return true;
  const allDatesNull = txs.every((t) => t.transaction_date == null);
  const allAmountsNull = txs.every((t) => t.amount == null);
  if (allDatesNull || allAmountsNull) return true;
  const avgConf = txs.reduce((s, t) => s + (t.confidence ?? 0), 0) / txs.length;
  if (avgConf < 0.4) return true;
  return false;
}

/**
 * extraction.document_type 가 은행/카드 캡처로 판정되면 캐시 source_type 도 동일하게 보정.
 * 그렇지 않으면 파일 MIME 기반 기본값(inferSourceType)을 그대로 사용.
 */
/**
 * 한국 영수증/거래내역의 일반 금액 범위(100원 ~ 1억원) 밖이면 자릿수 인식 오류 의심.
 * 0 은 검증 제외 (LLM 이 모르면 null 을 쓰므로 0 자체가 거의 안 옴).
 */
export function isAmountSuspicious(amount: number): boolean {
  const abs = Math.abs(amount);
  if (abs === 0) return false;
  return abs < 100 || abs > 100_000_000;
}

export function effectiveSourceType(
  inferred: string,
  documentType: ExtractionResult['document_type'],
): string {
  if (documentType === 'bank_capture' || documentType === 'card_capture' || documentType === 'sms') {
    return documentType;
  }
  return inferred;
}

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
    const prompt = buildExtractionPrompt(masked, hints, todayKSTISO());

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
      // 1차: imageDetail='high' (영수증·은행·카드 캡처 모두 high — 사용자 보고에 따라
      // 금액 자릿수/날짜 숫자 인식 오류가 low 다운샘플에서 발생. 비용 증가는 건당 약
      // $0.001-0.003 이지만 사용자 신뢰가 우선). 텍스트(PDF/OCR) 흐름에는 imageDetail 무관.
      let raw: string;
      try {
        const r = await llmGenerate({
          prompt,
          temperature: 0.1,
          imageUrls,
          imageDetail: imageUrls ? 'high' : undefined,
          maxTokens: imageUrls ? 2500 : undefined,
          timeoutMs: imageUrls ? 90_000 : undefined,
        });
        raw = r.content;
        modelName = imageUrls ? `${r.model}:high` : r.model;
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

      let parseFailed = false;
      try {
        extraction = parseExtractionLoose(raw);
      } catch {
        parseFailed = true;
        extraction = { document_type: 'other', transactions: [], global_warnings: [] };
      }

      // 2차(안전망): 이미지가 있고 1차가 파싱 실패/빈약하면 temperature 0 으로 재호출.
      // 1차가 이미 high 라서 해상도 추가 승급은 없음 — 결정적 디코딩만 시도.
      if (imageUrls && (parseFailed || shouldUpgradeToHigh(extraction))) {
        try {
          const r2 = await llmGenerate({
            prompt,
            temperature: 0,
            imageUrls,
            imageDetail: 'high',
            maxTokens: 2500,
            timeoutMs: 90_000,
          });
          extraction = parseExtractionLoose(r2.content);
          modelName = `${r2.model}:high:retry`;
        } catch (e) {
          // 2차 실패 시 1차 결과 유지 (없으면 빈 결과)
          if (parseFailed) throw e;
        }
      } else if (parseFailed) {
        // 이미지가 없거나 (PDF/텍스트) 흐름에서 파싱 실패 — 기존처럼 temperature 0 으로 재시도
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

    const cacheSourceType = effectiveSourceType(sourceType, extraction.document_type);
    await setCachedExtraction(supabase, userId, hash, cacheSourceType, extraction);
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

    // amount sanity: 한국 영수증/거래내역의 일반 범위는 100원 ~ 1억원. 그 밖이면
    // 자릿수 누락/추가 가능성이 높아 사용자가 검토하도록 warning 부여 + confidence 하향.
    if (t.amount != null && isAmountSuspicious(t.amount)) {
      warnings.push('amount_suspicious_magnitude');
      t.confidence = Math.max(0, t.confidence - 0.1);
    }

    // 이미지 단독(masked 가 빈 문자열)인 경우 OCR 텍스트가 없으므로
    // basis_not_found 검사는 의미가 없다(LLM 의 raw_text_basis 가 무엇이든 항상 false 가 됨).
    // 이미지+OCR 병존이거나 OCR-only 인 경우에만 환각 검증을 수행.
    const hasOcr = !!masked;
    if (t.raw_text_basis && hasOcr) {
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
