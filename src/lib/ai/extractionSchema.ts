import { z } from 'zod';

// LLM 응답이 일부 필드에 null 을 보내거나(특히 description / raw_text_basis)
// 빈 객체로 줄여 보내는 경우가 잦다. 한 행 때문에 전체 추출이 실패하지
// 않도록 sane default 로 fallback 한다 (.catch).
export const ExtractedTransaction = z.object({
  transaction_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional()
    .catch(null),
  type: z.enum(['income', 'expense', 'transfer']).catch('expense'),
  merchant_name: z.string().max(200).nullable().optional().catch(null),
  description: z.string().max(500).default('').catch(''),
  amount: z.number().nullable().optional().catch(null),
  category_suggestion: z.string().max(80).nullable().optional().catch(null),
  payment_method_suggestion: z.string().max(80).nullable().optional().catch(null),
  confidence: z.number().min(0).max(1).default(0.5).catch(0.5),
  raw_text_basis: z.string().max(500).default('').catch(''),
  warnings: z.array(z.string()).default([]).catch([]),
});
export type ExtractedTransaction = z.infer<typeof ExtractedTransaction>;

export const ExtractionResult = z.object({
  document_type: z
    .enum(['receipt', 'card_capture', 'bank_capture', 'sms', 'other'])
    .default('other')
    .catch('other'),
  transactions: z.array(ExtractedTransaction).default([]).catch([]),
  global_warnings: z.array(z.string()).default([]).catch([]),
});
export type ExtractionResult = z.infer<typeof ExtractionResult>;

/**
 * LLM(OpenAI/Ollama) 응답을 가능한 한 관대하게 JSON 으로 만들어 본다.
 * - 코드블록 제거
 * - 앞뒤 비-JSON 텍스트 절단
 * - .catch fallback 으로 일부 필드 null/형식 어긋남도 흡수
 */
export function parseExtractionLoose(raw: string): ExtractionResult {
  let s = raw.trim();
  s = s.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start >= 0 && end > start) s = s.slice(start, end + 1);
  const parsed = JSON.parse(s);
  return ExtractionResult.parse(parsed);
}
