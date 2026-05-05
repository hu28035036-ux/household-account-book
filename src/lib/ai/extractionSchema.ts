import { z } from 'zod';

export const ExtractedTransaction = z.object({
  transaction_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  type: z.enum(['income', 'expense', 'transfer']),
  merchant_name: z.string().max(200).nullable().optional(),
  description: z.string().max(500).default(''),
  amount: z.number().nullable().optional(),
  category_suggestion: z.string().max(80).nullable().optional(),
  payment_method_suggestion: z.string().max(80).nullable().optional(),
  confidence: z.number().min(0).max(1).default(0.5),
  raw_text_basis: z.string().max(500).default(''),
  warnings: z.array(z.string()).default([]),
});
export type ExtractedTransaction = z.infer<typeof ExtractedTransaction>;

export const ExtractionResult = z.object({
  document_type: z.enum(['receipt', 'card_capture', 'bank_capture', 'sms', 'other']).default('other'),
  transactions: z.array(ExtractedTransaction).default([]),
  global_warnings: z.array(z.string()).default([]),
});
export type ExtractionResult = z.infer<typeof ExtractionResult>;

/**
 * Ollama 응답을 가능한 한 관대하게 JSON으로 만들어 본다.
 * - 코드블록 제거
 * - 앞뒤 비-JSON 텍스트 절단
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
