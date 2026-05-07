import { z } from 'zod';

// AI 입력 명령의 의도(Intent) — discriminated union.
// LLM 이 자연어를 이 구조 중 하나로 정확히 매핑해서 응답해야 함.
// 모호하면 'unknown' 으로 fallback.

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const ym = z.string().regex(/^\d{4}-\d{2}$/);

// ============================================================================
// 1) 거래 (transactions)
// ============================================================================
export const AddTransactionData = z.object({
  type: z.enum(['income', 'expense', 'transfer']),
  date: ymd,
  amount: z.number().int().positive(),
  merchant_name: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  category_name: z.string().nullable().optional(), // AI 가 추정한 이름 — 서버가 id 매칭
  payment_method_name: z.string().nullable().optional(),
});

export const UpdateTransactionTarget = z.object({
  /**
   * 'last' = 가장 최근 거래 1건
   * 'recent_match' = 조건과 일치하는 가장 최근 거래
   * 'date_merchant' = 특정 날짜 + 가맹점 매칭
   */
  selector: z.enum(['last', 'recent_match', 'date_merchant']),
  date: ymd.nullable().optional(),
  merchant_name: z.string().nullable().optional(),
});

export const UpdateTransactionPatch = z.object({
  amount: z.number().int().positive().nullable().optional(),
  merchant_name: z.string().nullable().optional(),
  category_name: z.string().nullable().optional(),
  payment_method_name: z.string().nullable().optional(),
  date: ymd.nullable().optional(),
});

export const DeleteTransactionTarget = z.object({
  selector: z.enum(['last', 'recent_match', 'date_merchant', 'duplicate']),
  date: ymd.nullable().optional(),
  merchant_name: z.string().nullable().optional(),
});

// ============================================================================
// 2) 메타 데이터 (categories / payment methods / budgets / recurring)
// ============================================================================
export const CreateCategoryData = z.object({
  name: z.string().min(1).max(40),
  type: z.enum(['income', 'expense', 'common']).default('common'),
});

export const DeleteCategoryData = z.object({
  name: z.string().min(1),
});

export const CreatePaymentMethodData = z.object({
  name: z.string().min(1).max(40),
  type: z.enum(['card', 'bank', 'cash', 'pay', 'other']).default('card'),
});

export const DeletePaymentMethodData = z.object({
  name: z.string().min(1),
});

export const SetBudgetData = z.object({
  year_month: ym,                       // 'YYYY-MM'
  amount: z.number().int().nonnegative(),
  category_name: z.string().nullable().optional(), // null = 전체 예산
});

export const CreateRecurringData = z.object({
  type: z.enum(['income', 'expense', 'transfer']),
  amount: z.number().int().positive(),
  merchant_name: z.string().nullable().optional(),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  day_of_week: z.number().int().min(0).max(6).nullable().optional(),
  day_of_month: z.number().int().min(1).max(31).nullable().optional(),
  month_of_year: z.number().int().min(1).max(12).nullable().optional(),
  category_name: z.string().nullable().optional(),
  payment_method_name: z.string().nullable().optional(),
  auto_post: z.boolean().default(false),
});

// ============================================================================
// 3) 페이지 이동 (navigation)
// ============================================================================
export const NavigateData = z.object({
  destination: z.enum([
    'calendar',     // /dashboard
    'stats',        // /stats
    'transactions',
    'candidates',
    'budgets',
    'categories',
    'payment_methods',
    'recurring',
    'households',
    'ai_history',
    'files',
    'guide',
    'settings',
  ]),
  /** stats / calendar 에 적용. 'YYYY-MM' 또는 'this_month' / 'last_month' */
  year_month_hint: z.string().nullable().optional(),
});

// ============================================================================
// 통합 Intent (LLM 출력)
// ============================================================================
export const Intent = z.discriminatedUnion('type', [
  z.object({ type: z.literal('add_transaction'), data: AddTransactionData }),
  z.object({
    type: z.literal('update_transaction'),
    target: UpdateTransactionTarget,
    patch: UpdateTransactionPatch,
  }),
  z.object({ type: z.literal('delete_transaction'), target: DeleteTransactionTarget }),

  z.object({ type: z.literal('create_category'), data: CreateCategoryData }),
  z.object({ type: z.literal('delete_category'), data: DeleteCategoryData }),
  z.object({ type: z.literal('create_payment_method'), data: CreatePaymentMethodData }),
  z.object({ type: z.literal('delete_payment_method'), data: DeletePaymentMethodData }),
  z.object({ type: z.literal('set_budget'), data: SetBudgetData }),
  z.object({ type: z.literal('create_recurring'), data: CreateRecurringData }),

  z.object({ type: z.literal('navigate'), data: NavigateData }),

  z.object({
    type: z.literal('clarify'),
    /** AI 가 사용자에게 되묻고 싶을 때 — 입력이 모호함 */
    question: z.string(),
    suggestions: z.array(z.string()).default([]),
  }),
  z.object({
    type: z.literal('unknown'),
    reason: z.string(),
  }),
]);

export type Intent = z.infer<typeof Intent>;
export type IntentType = Intent['type'];

/** LLM 응답 파싱 — invalid JSON 도 unknown 으로 강등해서 클라이언트에 보냄 */
export function parseIntent(raw: string): Intent {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { type: 'unknown', reason: 'AI 응답을 해석할 수 없었습니다.' };
  }
  const result = Intent.safeParse(json);
  if (!result.success) {
    return {
      type: 'unknown',
      reason: 'AI 응답이 예상 형식과 일치하지 않습니다.',
    };
  }
  return result.data;
}
