'use client';

import { useEffect, useState } from 'react';
import { Card, CardSubtle, CardTitle } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { Modal } from '@/components/common/Modal';
import { formatDateKST } from '@/lib/formatting/date';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type Me = { id: string; email: string | null; created_at: string; display_name: string | null };
type AiProvider = { provider: 'openai' | 'ollama'; ok: boolean; model: string; reason?: string };
const PROVIDER_LABEL: Record<AiProvider['provider'], string> = {
  openai: 'OpenAI',
  ollama: 'Ollama',
};

export function SettingsClient() {
  const [me, setMe] = useState<Me | null>(null);
  const [aiOk, setAiOk] = useState<'unknown' | 'ok' | 'down'>('unknown');
  const [aiReason, setAiReason] = useState<string | null>(null);
  const [aiProviders, setAiProviders] = useState<AiProvider[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/me').then((r) => r.json()).then((j) => setMe(j?.data ?? null));
    fetch('/api/ai-status').then((r) => r.json()).then((j) => {
      const ok = j?.data?.ok;
      setAiOk(ok ? 'ok' : 'down');
      setAiProviders((j?.data?.providers as AiProvider[]) ?? []);
      if (!ok) setAiReason(j?.data?.reason ?? null);
    });
  }, []);

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  async function deleteAccount() {
    if (confirmText !== 'DELETE') {
      setError('DELETE를 정확히 입력하세요.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch('/api/account', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ confirm: 'DELETE' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? '삭제 실패');
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
      window.location.href = '/login';
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제 실패');
    } finally {
      setPending(false);
    }
  }

  const ttl = process.env.NEXT_PUBLIC_RAW_TEXT_TTL_DAYS ?? '7';

  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-semibold text-textPrimary">설정</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardTitle>계정</CardTitle>
          {me ? (
            <div className="mt-3 text-sm space-y-1">
              <div>
                <span className="text-textSecondary">이메일</span>{' '}
                <span className="text-textPrimary">{me.email ?? '-'}</span>
              </div>
              <div>
                <span className="text-textSecondary">가입일</span>{' '}
                <span className="text-textPrimary">{formatDateKST(me.created_at)}</span>
              </div>
            </div>
          ) : (
            <CardSubtle className="mt-1">불러오는 중…</CardSubtle>
          )}
          <div className="mt-4 flex justify-end">
            <Button variant="ghost" onClick={signOut}>
              로그아웃
            </Button>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>AI 서버</CardTitle>
            {aiOk === 'ok' && <Badge tone="success">연결됨</Badge>}
            {aiOk === 'down' && <Badge tone="warning">연결 안 됨</Badge>}
          </div>
          {aiProviders.length === 0 ? (
            <CardSubtle className="mt-1">
              AI 공급자가 설정되어 있지 않습니다. 환경변수 OPENAI_API_KEY 또는 OLLAMA_API_BASE_URL을
              등록해 주세요.
            </CardSubtle>
          ) : (
            <ul className="mt-2 text-sm space-y-1">
              {aiProviders.map((p) => (
                <li key={p.provider} className="flex items-center justify-between gap-3">
                  <span>
                    <span className="text-textPrimary">{PROVIDER_LABEL[p.provider]}</span>{' '}
                    <span className="font-mono text-xs text-textSecondary">{p.model}</span>
                  </span>
                  {p.ok ? (
                    <Badge tone="success">정상</Badge>
                  ) : (
                    <Badge tone="warning">{p.reason ?? '연결 실패'}</Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
          {aiProviders.length > 1 && (
            <CardSubtle className="mt-2">
              상위에 적힌 공급자가 1순위로 호출되고, 실패 시 다음 공급자로 자동 전환됩니다.
            </CardSubtle>
          )}
          {aiOk === 'down' && aiReason && (
            <p className="mt-2 text-xs rounded-md bg-warningSoft text-warning px-3 py-2">{aiReason}</p>
          )}
        </Card>

        <Card>
          <CardTitle>보안 / 원본 데이터</CardTitle>
          <ul className="mt-3 text-sm space-y-1 list-disc pl-5 text-textSecondary">
            <li>카드/계좌/주민/전화/사업자번호는 자동 마스킹 후 저장됩니다.</li>
            <li>OCR 원문 텍스트는 분석 후 <b className="text-textPrimary">{ttl}일</b>이 지나면 자동 폐기됩니다.</li>
            <li>모든 데이터는 사용자별 RLS로 격리되어 다른 사용자가 볼 수 없습니다.</li>
            <li>원본 파일은 ‘원본 파일’ 화면에서 직접 삭제할 수 있습니다.</li>
          </ul>
        </Card>

        <Card>
          <CardTitle>데이터 내보내기</CardTitle>
          <CardSubtle className="mt-1">본인 데이터만 받습니다.</CardSubtle>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href="/api/export" className="inline-flex">
              <Button variant="secondary">전체 JSON</Button>
            </a>
            <a href="/api/export/transactions" className="inline-flex">
              <Button variant="secondary">거래 CSV</Button>
            </a>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardTitle className="text-danger">계정 삭제</CardTitle>
          <CardSubtle className="mt-1">
            계정과 관련 데이터(거래·후보·파일·OCR·AI 결과·학습 규칙·로그)를 모두 영구 삭제합니다.
            되돌릴 수 없습니다. 진행 전 데이터 내보내기를 권장합니다.
          </CardSubtle>
          <div className="mt-3 flex justify-end">
            <Button variant="danger" onClick={() => setConfirmOpen(true)}>
              계정 삭제
            </Button>
          </div>
        </Card>
      </div>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="계정 삭제 확인">
        <div className="space-y-3">
          <p className="text-sm text-textSecondary">
            이 작업은 되돌릴 수 없습니다. 진행하려면 아래 입력란에 <b className="text-textPrimary">DELETE</b>를 정확히 입력하세요.
          </p>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="DELETE"
            className="w-full h-11 px-3 rounded-lg border border-borderDefault bg-white text-textPrimary"
          />
          {error && <p className="text-sm rounded-md bg-dangerSoft text-danger px-3 py-2">{error}</p>}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={pending}>
              취소
            </Button>
            <Button variant="danger" onClick={deleteAccount} disabled={pending || confirmText !== 'DELETE'}>
              {pending ? '삭제 중…' : '영구 삭제'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
