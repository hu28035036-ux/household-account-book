import type { SupabaseClient } from '@supabase/supabase-js';
import {
  decryptCredentials,
  encryptCredentials,
  type EncryptedCredentials,
} from '@/lib/banking/crypto';
import { getActiveProvider, getProviderById, type ProviderId } from '@/lib/banking/providers';
import type { ProviderTxn } from '@/lib/banking/types';
import { findBank } from '@/lib/banking/banks';
import { applyLearningPostprocess } from './learningService';
import { suggestCategoryByMerchant } from '@/lib/import/categoryHeuristic';

export type LinkedAccount = {
  id: string;
  user_id: string;
  household_id: string | null;
  provider: ProviderId;
  provider_account_id: string;
  bank_code: string;
  bank_name: string;
  account_type: 'checking' | 'savings' | 'card' | 'loan' | 'other';
  account_number_masked: string;
  holder_name: string | null;
  nickname: string | null;
  last_sync_at: string | null;
  last_sync_status: 'never' | 'pending' | 'ok' | 'failed';
  last_sync_error: string | null;
  balance: number | null;
  active: boolean;
  linked_at: string;
};

const ACCOUNT_COLUMNS =
  'id, user_id, household_id, provider, provider_account_id, bank_code, bank_name, account_type, account_number_masked, holder_name, nickname, last_sync_at, last_sync_status, last_sync_error, balance, active, linked_at';

export async function listLinkedAccounts(
  supabase: SupabaseClient,
  userId: string,
  householdId: string | null,
): Promise<LinkedAccount[]> {
  let q = supabase
    .from('linked_accounts')
    .select(ACCOUNT_COLUMNS)
    .eq('active', true)
    .order('linked_at', { ascending: false });
  if (householdId) {
    q = q.or(`user_id.eq.${userId},household_id.eq.${householdId}`);
  } else {
    q = q.eq('user_id', userId).is('household_id', null);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as LinkedAccount[];
}

/** 연동 완료 결과를 DB 에 반영 */
export async function persistLinkedAccount(
  supabase: SupabaseClient,
  userId: string,
  householdId: string | null,
  payload: {
    provider: ProviderId;
    providerAccountId: string;
    bankCode: string;
    bankName: string;
    accountType: 'checking' | 'savings' | 'card' | 'loan' | 'other';
    accountNumberMasked: string;
    holderName: string | null;
    balance: number | null;
    plaintextCredentials: string;
  },
): Promise<LinkedAccount> {
  const blob = encryptCredentials(payload.plaintextCredentials);
  const { data, error } = await supabase
    .from('linked_accounts')
    .insert({
      user_id: userId,
      household_id: householdId,
      provider: payload.provider,
      provider_account_id: payload.providerAccountId,
      bank_code: payload.bankCode,
      bank_name: payload.bankName,
      account_type: payload.accountType,
      account_number_masked: payload.accountNumberMasked,
      holder_name: payload.holderName,
      balance: payload.balance,
      credentials_encrypted: blob.ciphertext,
      credentials_iv: blob.iv,
      credentials_tag: blob.tag,
      last_sync_status: 'never',
    })
    .select(ACCOUNT_COLUMNS)
    .single();
  if (error) throw error;
  return data as LinkedAccount;
}

export async function unlinkAccount(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<void> {
  const { data: row, error: rowErr } = await supabase
    .from('linked_accounts')
    .select('id, provider, provider_account_id, credentials_encrypted, credentials_iv, credentials_tag')
    .eq('user_id', userId)
    .eq('id', id)
    .single();
  if (rowErr) throw rowErr;
  // provider 측 토큰 무효화 시도 (실패해도 진행)
  try {
    if (row.credentials_encrypted && row.credentials_iv && row.credentials_tag) {
      const plain = decryptCredentials({
        ciphertext: row.credentials_encrypted,
        iv: row.credentials_iv,
        tag: row.credentials_tag,
      });
      const provider = getProviderById(row.provider as ProviderId);
      await provider.unlink(plain, row.provider_account_id);
    }
  } catch (e) {
    // swallow — 사용자 측에서는 어차피 해제됨
    console.warn('provider.unlink failed:', e);
  }
  const { error } = await supabase
    .from('linked_accounts')
    .delete()
    .eq('user_id', userId)
    .eq('id', id);
  if (error) throw error;
}

/** 동기화 — 거래내역 가져와서 transaction_candidates 로 적재. */
export async function syncLinkedAccount(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  opts?: { fromDate?: string; toDate?: string },
): Promise<{
  fetched: number;
  candidatesCreated: number;
  fromDate: string;
  toDate: string;
}> {
  const { data: row, error: rowErr } = await supabase
    .from('linked_accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('id', id)
    .single();
  if (rowErr) throw rowErr;

  const fromDate = opts?.fromDate ?? defaultFromDate(row.last_sync_at);
  const toDate = opts?.toDate ?? todayKstYmd();

  // 동기화 row 시작
  const { data: syncRow } = await supabase
    .from('linked_account_syncs')
    .insert({
      linked_account_id: id,
      user_id: userId,
      status: 'pending',
      date_from: fromDate,
      date_to: toDate,
    })
    .select('id')
    .single();

  await supabase
    .from('linked_accounts')
    .update({ last_sync_status: 'pending', last_sync_error: null })
    .eq('id', id);

  try {
    if (!row.credentials_encrypted || !row.credentials_iv || !row.credentials_tag) {
      throw new Error('NO_CREDENTIALS');
    }
    const plain = decryptCredentials({
      ciphertext: row.credentials_encrypted,
      iv: row.credentials_iv,
      tag: row.credentials_tag,
    });
    const provider = getProviderById(row.provider as ProviderId);
    const result = await provider.fetchTransactions({
      credentials: plain,
      providerAccountId: row.provider_account_id,
      bankCode: row.bank_code,
      fromDate,
      toDate,
    });

    const candidatesCreated = await pushTransactionsAsCandidates(
      supabase,
      userId,
      row.id,
      result.transactions,
    );

    // 자격증명 회전 + 잔액 갱신
    const updatePatch: Record<string, unknown> = {
      last_sync_at: new Date().toISOString(),
      last_sync_status: 'ok',
      last_sync_error: null,
    };
    if (typeof result.latestBalance === 'number') updatePatch.balance = result.latestBalance;
    if (result.rotatedCredentials) {
      const rotated = encryptCredentials(result.rotatedCredentials);
      updatePatch.credentials_encrypted = rotated.ciphertext;
      updatePatch.credentials_iv = rotated.iv;
      updatePatch.credentials_tag = rotated.tag;
    }
    await supabase.from('linked_accounts').update(updatePatch).eq('id', id);

    if (syncRow?.id) {
      await supabase
        .from('linked_account_syncs')
        .update({
          status: 'ok',
          finished_at: new Date().toISOString(),
          transactions_fetched: result.transactions.length,
          candidates_created: candidatesCreated,
        })
        .eq('id', syncRow.id);
    }

    return {
      fetched: result.transactions.length,
      candidatesCreated,
      fromDate,
      toDate,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'SYNC_FAILED';
    await supabase
      .from('linked_accounts')
      .update({ last_sync_status: 'failed', last_sync_error: msg })
      .eq('id', id);
    if (syncRow?.id) {
      await supabase
        .from('linked_account_syncs')
        .update({
          status: 'failed',
          finished_at: new Date().toISOString(),
          error: msg,
        })
        .eq('id', syncRow.id);
    }
    throw e;
  }
}

async function pushTransactionsAsCandidates(
  supabase: SupabaseClient,
  userId: string,
  linkedAccountId: string,
  txns: ProviderTxn[],
): Promise<number> {
  if (txns.length === 0) return 0;

  // 1) heuristic 채우기
  type CandidateRow = {
    user_id: string;
    linked_account_id: string;
    transaction_date: string;
    type: 'income' | 'expense' | 'transfer';
    amount: number;
    merchant_name: string | null;
    description: string;
    category_suggestion: string | null;
    payment_method_suggestion: string | null;
    confidence: number;
    duplicate_status: 'none';
    raw_text_basis: string | null;
    warnings: string[];
    user_action: 'pending';
  };
  let rows: CandidateRow[] = txns.map((t) => ({
    user_id: userId,
    linked_account_id: linkedAccountId,
    transaction_date: t.date,
    type: t.type,
    amount: Math.abs(t.amount),
    merchant_name: t.merchantName,
    description: t.description ?? '',
    category_suggestion: suggestCategoryByMerchant(t.merchantName ?? '', t.type) ?? null,
    payment_method_suggestion: null,
    confidence: 0.6,
    duplicate_status: 'none',
    raw_text_basis: null,
    warnings: [],
    user_action: 'pending',
  }));

  // 2) 학습 규칙 후처리 (사용자 본인 패턴 우선)
  rows = await Promise.all(
    rows.map(async (r) => {
      const post = await applyLearningPostprocess(supabase, userId, {
        merchant_name: r.merchant_name,
        category_suggestion: r.category_suggestion,
        payment_method_suggestion: r.payment_method_suggestion,
        confidence: r.confidence,
        warnings: r.warnings,
      });
      return { ...r, ...post };
    }),
  );

  // 3) 카테고리 미정 → 사용자에게 알림
  rows = rows.map((r) =>
    r.category_suggestion
      ? r
      : { ...r, warnings: [...(r.warnings ?? []), 'category_uncertain'] },
  );

  // 4) upsert (계좌별 dedup unique index 존재 → 충돌 시 무시)
  const { data, error } = await supabase
    .from('transaction_candidates')
    .upsert(rows, {
      onConflict: 'linked_account_id,transaction_date,amount,merchant_name',
      ignoreDuplicates: true,
    })
    .select('id');
  if (error) throw error;
  return data?.length ?? 0;
}

function todayKstYmd(): string {
  const now = new Date();
  // KST = UTC + 9
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

/** 첫 동기화는 30일치, 이후는 마지막 동기화 시점 - 3일 (지연 거래 흡수). */
function defaultFromDate(lastSyncAt: string | null): string {
  const now = new Date();
  if (!lastSyncAt) {
    now.setUTCDate(now.getUTCDate() - 30);
  } else {
    const last = new Date(lastSyncAt);
    last.setUTCDate(last.getUTCDate() - 3);
    if (last.getTime() < now.getTime()) {
      return last.toISOString().slice(0, 10);
    }
  }
  return now.toISOString().slice(0, 10);
}

/** 활성 provider 의 supports 와 BANKS 를 교집합해서 UI 가 보여줄 후보 은행 반환 */
export function listSupportedBanks() {
  const provider = getActiveProvider();
  const supports = new Set(provider.supportedBankCodes());
  return supports.size > 0 ? supports : null;
}
