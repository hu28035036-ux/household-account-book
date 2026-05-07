import type { SupabaseClient } from '@supabase/supabase-js';
import { llmGenerate } from '@/lib/ai/llmRouter';
import { buildSystemPrompt, type AssistantContext } from '@/lib/ai/assistantPrompt';
import { parseIntent, type Intent } from '@/lib/ai/assistantSchema';
import { createTransaction, deleteTransaction, updateTransaction } from '@/services/transactionService';
import { createCategory, deleteCategory, listCategories } from '@/services/categoryService';
import {
  createPaymentMethod,
  deletePaymentMethod,
  listPaymentMethods,
} from '@/services/paymentMethodService';
import { upsertBudget } from '@/services/budgetService';

// =============================================================================
// 컨텍스트 수집 — system prompt 에 카테고리/결제수단 이름 주입
// =============================================================================
export async function buildAssistantContext(
  supabase: SupabaseClient,
  userId: string,
): Promise<AssistantContext> {
  const [cats, pms] = await Promise.all([
    listCategories(supabase, userId).catch(() => []),
    listPaymentMethods(supabase, userId).catch(() => []),
  ]);
  return {
    todayKst: todayKstYmd(),
    categoryNames: (cats ?? []).map((c: { name: string }) => c.name).slice(0, 40),
    paymentMethodNames: (pms ?? []).map((p: { name: string }) => p.name).slice(0, 20),
  };
}

// =============================================================================
// LLM 호출 → Intent 추출
// =============================================================================
export async function parseUserCommand(
  command: string,
  ctx: AssistantContext,
): Promise<Intent> {
  if (!command.trim()) {
    return { type: 'unknown', reason: '명령이 비어있습니다.' };
  }
  const system = buildSystemPrompt(ctx);
  const prompt = `${system}\n\n사용자 입력: "${command.trim()}"\nJSON 응답:`;

  let raw: string;
  try {
    const result = await llmGenerate({ prompt, temperature: 0.1 });
    raw = result.content;
  } catch (e) {
    return {
      type: 'unknown',
      reason: 'AI 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.',
    };
  }
  // 일부 LLM 은 ```json ... ``` 으로 감쌈 — 안쪽만 추출
  const cleaned = stripCodeFence(raw);
  return parseIntent(cleaned);
}

function stripCodeFence(s: string): string {
  const m = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  return (m ? m[1] : s).trim();
}

// =============================================================================
// Intent 실행 (서버 측). 모든 mutation 은 user_id 격리.
// 'navigate' / 'clarify' / 'unknown' 은 클라이언트가 처리.
// =============================================================================
export type ExecuteResult =
  | { ok: true; kind: Intent['type']; data: unknown; message: string }
  | { ok: false; error: string };

export async function executeIntent(
  supabase: SupabaseClient,
  userId: string,
  householdId: string | null,
  intent: Intent,
): Promise<ExecuteResult> {
  try {
    switch (intent.type) {
      case 'add_transaction': {
        const d = intent.data;
        const categoryId = d.category_name
          ? await findCategoryIdByName(supabase, userId, d.category_name)
          : null;
        const paymentMethodId = d.payment_method_name
          ? await findPaymentMethodIdByName(supabase, userId, d.payment_method_name)
          : null;

        const tx = await createTransaction(supabase, userId, {
          transaction_date: d.date,
          type: d.type,
          amount: d.amount,
          merchant_name: d.merchant_name ?? null,
          description: d.description ?? '',
          category_id: categoryId,
          payment_method_id: paymentMethodId,
          household_id: householdId ?? null,
        });
        return {
          ok: true,
          kind: intent.type,
          data: tx,
          message: `${d.type === 'income' ? '+' : '-'}${d.amount.toLocaleString('ko-KR')}원 추가됨`,
        };
      }

      case 'update_transaction': {
        const target = await resolveTransaction(supabase, userId, intent.target);
        if (!target) {
          return { ok: false, error: '수정할 거래를 찾지 못했어요.' };
        }
        const patch: Record<string, unknown> = {};
        if (intent.patch.amount != null) patch.amount = intent.patch.amount;
        if (intent.patch.merchant_name != null) patch.merchant_name = intent.patch.merchant_name;
        if (intent.patch.date != null) patch.transaction_date = intent.patch.date;
        if (intent.patch.category_name) {
          patch.category_id = await findCategoryIdByName(
            supabase,
            userId,
            intent.patch.category_name,
          );
        }
        if (intent.patch.payment_method_name) {
          patch.payment_method_id = await findPaymentMethodIdByName(
            supabase,
            userId,
            intent.patch.payment_method_name,
          );
        }
        const updated = await updateTransaction(supabase, userId, target.id, patch);
        return { ok: true, kind: intent.type, data: updated, message: '거래를 수정했어요.' };
      }

      case 'delete_transaction': {
        const target = await resolveTransaction(supabase, userId, intent.target);
        if (!target) {
          return { ok: false, error: '삭제할 거래를 찾지 못했어요.' };
        }
        await deleteTransaction(supabase, userId, target.id);
        return { ok: true, kind: intent.type, data: target, message: '거래를 삭제했어요.' };
      }

      case 'create_category': {
        const cat = await createCategory(supabase, userId, intent.data);
        return {
          ok: true,
          kind: intent.type,
          data: cat,
          message: `"${intent.data.name}" 카테고리를 추가했어요.`,
        };
      }

      case 'delete_category': {
        const id = await findCategoryIdByName(supabase, userId, intent.data.name);
        if (!id) return { ok: false, error: `"${intent.data.name}" 카테고리를 찾지 못했어요.` };
        await deleteCategory(supabase, userId, id);
        return {
          ok: true,
          kind: intent.type,
          data: { id, name: intent.data.name },
          message: `"${intent.data.name}" 카테고리를 삭제했어요.`,
        };
      }

      case 'create_payment_method': {
        const pm = await createPaymentMethod(supabase, userId, {
          name: intent.data.name,
          type: intent.data.type,
        });
        return {
          ok: true,
          kind: intent.type,
          data: pm,
          message: `"${intent.data.name}" 결제수단을 추가했어요.`,
        };
      }

      case 'delete_payment_method': {
        const id = await findPaymentMethodIdByName(supabase, userId, intent.data.name);
        if (!id) return { ok: false, error: `"${intent.data.name}" 결제수단을 찾지 못했어요.` };
        await deletePaymentMethod(supabase, userId, id);
        return {
          ok: true,
          kind: intent.type,
          data: { id, name: intent.data.name },
          message: `"${intent.data.name}" 결제수단을 삭제했어요.`,
        };
      }

      case 'set_budget': {
        const categoryId = intent.data.category_name
          ? await findCategoryIdByName(supabase, userId, intent.data.category_name)
          : null;
        const budget = await upsertBudget(
          supabase,
          userId,
          {
            category_id: categoryId,
            year_month: intent.data.year_month,
            amount: intent.data.amount,
          },
          householdId,
        );
        return {
          ok: true,
          kind: intent.type,
          data: budget,
          message: `${intent.data.year_month} 예산을 ${intent.data.amount.toLocaleString('ko-KR')}원으로 설정했어요.`,
        };
      }

      case 'create_recurring': {
        const d = intent.data;
        const categoryId = d.category_name
          ? await findCategoryIdByName(supabase, userId, d.category_name)
          : null;
        const paymentMethodId = d.payment_method_name
          ? await findPaymentMethodIdByName(supabase, userId, d.payment_method_name)
          : null;
        const today = todayKstYmd();
        const { data, error } = await supabase
          .from('recurring_rules')
          .insert({
            user_id: userId,
            household_id: householdId,
            type: d.type,
            amount: d.amount,
            merchant_name: d.merchant_name ?? null,
            description: null,
            category_id: categoryId,
            payment_method_id: paymentMethodId,
            frequency: d.frequency,
            day_of_week: d.day_of_week ?? null,
            day_of_month: d.day_of_month ?? null,
            month_of_year: d.month_of_year ?? null,
            start_date: today,
            active: true,
            auto_post: d.auto_post,
            notify_days_before: 0,
          })
          .select('*')
          .single();
        if (error) throw error;
        return {
          ok: true,
          kind: intent.type,
          data,
          message: `고정 거래를 등록했어요. (${labelFrequency(d.frequency, d.day_of_month, d.day_of_week)})`,
        };
      }

      // 클라이언트가 처리해야 함 — 여기 도달하면 안 되지만 안전 폴백
      case 'navigate':
      case 'clarify':
      case 'unknown':
        return { ok: false, error: '이 명령은 클라이언트에서 처리됩니다.' };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '실행 실패' };
  }
}

// =============================================================================
// 헬퍼들
// =============================================================================
function todayKstYmd(): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(new Date());
}

function labelFrequency(
  f: 'daily' | 'weekly' | 'monthly' | 'yearly',
  dom?: number | null,
  dow?: number | null,
) {
  if (f === 'daily') return '매일';
  if (f === 'weekly') return `매주 ${['일', '월', '화', '수', '목', '금', '토'][dow ?? 0]}요일`;
  if (f === 'monthly') return `매월 ${dom ?? 1}일`;
  return '매년';
}

async function findCategoryIdByName(
  supabase: SupabaseClient,
  userId: string,
  name: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('categories')
    .select('id')
    .eq('user_id', userId)
    .ilike('name', name)
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

async function findPaymentMethodIdByName(
  supabase: SupabaseClient,
  userId: string,
  name: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('payment_methods')
    .select('id')
    .eq('user_id', userId)
    .ilike('name', name)
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

/**
 * update_transaction / delete_transaction 의 target selector 를 실 거래 1건으로 해석.
 * - last: 가장 최근 거래
 * - recent_match / date_merchant: 조건 매칭 + 가장 최근
 * 'duplicate' 는 동일 (date, amount, merchant) 2건 중 1건 — 1차에선 last 와 동일 처리
 */
async function resolveTransaction(
  supabase: SupabaseClient,
  userId: string,
  target: {
    selector: 'last' | 'recent_match' | 'date_merchant' | 'duplicate';
    date?: string | null;
    merchant_name?: string | null;
  },
): Promise<{ id: string; transaction_date: string; merchant_name: string | null; amount: number } | null> {
  let q = supabase
    .from('transactions')
    .select('id, transaction_date, merchant_name, amount')
    .eq('user_id', userId);

  if (target.selector === 'last' || target.selector === 'duplicate') {
    // no extra filter
  } else {
    if (target.date) q = q.eq('transaction_date', target.date);
    if (target.merchant_name) q = q.ilike('merchant_name', `%${target.merchant_name}%`);
  }

  const { data, error } = await q
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data;
}
