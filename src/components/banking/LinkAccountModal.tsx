'use client';

import { useEffect, useMemo, useState } from 'react';
import { Building2, CreditCard, Loader2, ShieldCheck, Smartphone } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';

type BankItem = {
  code: string;
  name: string;
  kind: 'bank' | 'card';
  easyAuth: boolean;
  supported: boolean;
};

type AuthMethod =
  | { kind: 'easy_auth'; channel: 'kakao' | 'pass' | 'naver' | 'samsung' }
  | { kind: 'id_password'; idLabel: string; passwordLabel: string }
  | { kind: 'cert' };

type Props = {
  open: boolean;
  onClose: () => void;
  onLinked: () => void;
};

export function LinkAccountModal({ open, onClose, onLinked }: Props) {
  const [step, setStep] = useState<'bank' | 'auth' | 'submitting' | 'pending'>('bank');
  const [providerId, setProviderId] = useState<string>('mock');
  const [banks, setBanks] = useState<BankItem[] | null>(null);
  const [filter, setFilter] = useState<'all' | 'bank' | 'card'>('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<BankItem | null>(null);
  const [authMethod, setAuthMethod] = useState<AuthMethod | null>(null);
  const [loginId, setLoginId] = useState('');
  const [loginPw, setLoginPw] = useState('');
  const [fullName, setFullName] = useState('');
  const [birth, setBirth] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep('bank');
    setError(null);
    setSelected(null);
    setAuthMethod(null);
    setLoginId('');
    setLoginPw('');
    setFullName('');
    setBirth('');
    setPhone('');
    setQuery('');
    setFilter('all');
    setSessionToken(null);
    setPendingMessage(null);
    fetch('/api/banking/banks', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (j?.data) {
          setBanks(j.data.banks);
          setProviderId(j.data.providerId);
        }
      })
      .catch(() => setError('은행 목록을 불러올 수 없습니다.'));
  }, [open]);

  const filtered = useMemo(() => {
    if (!banks) return [];
    return banks.filter((b) => {
      if (filter !== 'all' && b.kind !== filter) return false;
      if (query && !b.name.includes(query)) return false;
      return true;
    });
  }, [banks, filter, query]);

  function pickBank(b: BankItem) {
    if (!b.supported) return;
    setSelected(b);
    // 기본 인증: 간편인증 가능하면 카카오, 아니면 ID/PW
    setAuthMethod(
      b.easyAuth
        ? { kind: 'easy_auth', channel: 'kakao' }
        : { kind: 'id_password', idLabel: '아이디', passwordLabel: '비밀번호' },
    );
    setError(null);
    setStep('auth');
  }

  async function submit() {
    if (!selected || !authMethod) return;
    setStep('submitting');
    setError(null);
    try {
      const res = await fetch('/api/banking/link/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          bankCode: selected.code,
          authMethod,
          loginId: loginId || undefined,
          loginPassword: loginPw || undefined,
          fullName: fullName || undefined,
          birth: birth || undefined,
          phone: phone || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? '연동 실패');

      if (json.data.kind === 'pending') {
        setSessionToken(json.data.sessionToken);
        setPendingMessage(json.data.message);
        setStep('pending');
        return;
      }
      onLinked();
    } catch (e) {
      setError(e instanceof Error ? e.message : '연동 실패');
      setStep('auth');
    }
  }

  async function completeAfterPush() {
    if (!sessionToken) return;
    setStep('submitting');
    setError(null);
    try {
      const res = await fetch('/api/banking/link/complete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionToken }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? '연동 완료 실패');
      onLinked();
    } catch (e) {
      setError(e instanceof Error ? e.message : '연동 완료 실패');
      setStep('pending');
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="계좌 연동" className="sm:max-w-lg">
      {providerId === 'mock' && (
        <div className="mb-3 rounded-md bg-warningSoft text-warning px-3 py-2 text-xs">
          <b>시연 모드 (mock provider)</b> — 실제 은행 연동이 아닌 샘플 데이터로 동작합니다.
          운영 환경에서는 <code>BANKING_PROVIDER=codef</code> 와 키를 설정하세요.
        </div>
      )}

      {error && (
        <div className="mb-3 rounded-md bg-dangerSoft text-danger px-3 py-2 text-sm">{error}</div>
      )}

      {step === 'bank' && (
        <BankPicker
          banks={banks}
          filter={filter}
          setFilter={setFilter}
          query={query}
          setQuery={setQuery}
          filtered={filtered}
          onPick={pickBank}
        />
      )}

      {step === 'auth' && selected && authMethod && (
        <AuthForm
          bank={selected}
          authMethod={authMethod}
          setAuthMethod={setAuthMethod}
          loginId={loginId}
          setLoginId={setLoginId}
          loginPw={loginPw}
          setLoginPw={setLoginPw}
          fullName={fullName}
          setFullName={setFullName}
          birth={birth}
          setBirth={setBirth}
          phone={phone}
          setPhone={setPhone}
          onBack={() => setStep('bank')}
          onSubmit={submit}
        />
      )}

      {step === 'submitting' && (
        <div className="py-8 flex flex-col items-center gap-2 text-textSecondary">
          <Loader2 className="h-6 w-6 animate-spin text-textPinkStrong" strokeWidth={1.75} />
          <p className="text-sm">연동 중…</p>
        </div>
      )}

      {step === 'pending' && (
        <div className="py-4 space-y-3">
          <div className="flex items-center gap-2 text-textPrimary">
            <Smartphone className="h-5 w-5 text-textPinkStrong" strokeWidth={1.75} />
            <h4 className="font-semibold">간편인증 푸시를 확인해 주세요</h4>
          </div>
          <p className="text-sm text-textSecondary">{pendingMessage}</p>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose}>
              취소
            </Button>
            <Button variant="primary" onClick={completeAfterPush}>
              인증 완료했어요
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function BankPicker({
  banks,
  filter,
  setFilter,
  query,
  setQuery,
  filtered,
  onPick,
}: {
  banks: BankItem[] | null;
  filter: 'all' | 'bank' | 'card';
  setFilter: (v: 'all' | 'bank' | 'card') => void;
  query: string;
  setQuery: (v: string) => void;
  filtered: BankItem[];
  onPick: (b: BankItem) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {(['all', 'bank', 'card'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            className={`text-xs px-2.5 h-7 rounded-full border ${
              filter === k
                ? 'bg-primaryPinkSoft text-textPinkStrong border-primaryPinkSoft'
                : 'border-borderDefault text-textSecondary hover:bg-softPinkBackground'
            }`}
          >
            {k === 'all' ? '전체' : k === 'bank' ? '은행' : '카드사'}
          </button>
        ))}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="은행/카드 이름 검색"
          className="flex-1 h-8 rounded-md border border-borderDefault bg-white px-2 text-sm"
        />
      </div>

      {!banks ? (
        <p className="text-sm text-textSecondary py-6 text-center">불러오는 중…</p>
      ) : (
        <ul className="grid grid-cols-2 gap-2 max-h-[50dvh] overflow-y-auto pr-1">
          {filtered.map((b) => (
            <li key={b.code}>
              <button
                type="button"
                disabled={!b.supported}
                onClick={() => onPick(b)}
                className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-md border text-left text-sm ${
                  b.supported
                    ? 'border-borderDefault hover:bg-softPinkBackground'
                    : 'border-borderSoft text-textMuted bg-pageBackground/40 cursor-not-allowed'
                }`}
              >
                {b.kind === 'card' ? (
                  <CreditCard className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                ) : (
                  <Building2 className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                )}
                <span className="truncate">{b.name}</span>
                {!b.supported && (
                  <span className="ml-auto text-[10px] text-textMuted">미지원</span>
                )}
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="col-span-2 text-center text-xs text-textMuted py-4">
              일치하는 항목이 없습니다.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function AuthForm({
  bank,
  authMethod,
  setAuthMethod,
  loginId,
  setLoginId,
  loginPw,
  setLoginPw,
  fullName,
  setFullName,
  birth,
  setBirth,
  phone,
  setPhone,
  onBack,
  onSubmit,
}: {
  bank: BankItem;
  authMethod: AuthMethod;
  setAuthMethod: (m: AuthMethod) => void;
  loginId: string;
  setLoginId: (v: string) => void;
  loginPw: string;
  setLoginPw: (v: string) => void;
  fullName: string;
  setFullName: (v: string) => void;
  birth: string;
  setBirth: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  onBack: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {bank.kind === 'card' ? (
          <CreditCard className="h-5 w-5 text-textPinkStrong" strokeWidth={1.75} />
        ) : (
          <Building2 className="h-5 w-5 text-textPinkStrong" strokeWidth={1.75} />
        )}
        <span className="font-semibold text-textPrimary">{bank.name}</span>
        <Badge tone="muted">{bank.kind === 'card' ? '카드사' : '은행'}</Badge>
      </div>

      <div className="rounded-md bg-softPinkBackground/60 px-3 py-2 text-xs text-textSecondary flex items-start gap-2">
        <ShieldCheck className="h-4 w-4 text-textPinkStrong mt-0.5 shrink-0" strokeWidth={1.75} />
        <div>
          입력값은 <b>Next.js 서버를 거쳐</b> 외부 데이터 Aggregator 로만 전달됩니다.
          비밀번호는 저장되지 않으며, 발급된 토큰은 AES-256으로 암호화되어 저장됩니다.
        </div>
      </div>

      {bank.easyAuth && (
        <div>
          <div className="text-xs text-textSecondary mb-1.5">인증 방식</div>
          <div className="flex flex-wrap gap-1.5">
            {(['kakao', 'pass', 'naver', 'samsung'] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setAuthMethod({ kind: 'easy_auth', channel: c })}
                className={`text-xs px-2.5 h-7 rounded-full border ${
                  authMethod.kind === 'easy_auth' && authMethod.channel === c
                    ? 'bg-primaryPinkSoft text-textPinkStrong border-primaryPinkSoft'
                    : 'border-borderDefault text-textSecondary hover:bg-softPinkBackground'
                }`}
              >
                {labelOf(c)} 간편인증
              </button>
            ))}
            <button
              type="button"
              onClick={() =>
                setAuthMethod({ kind: 'id_password', idLabel: '아이디', passwordLabel: '비밀번호' })
              }
              className={`text-xs px-2.5 h-7 rounded-full border ${
                authMethod.kind === 'id_password'
                  ? 'bg-primaryPinkSoft text-textPinkStrong border-primaryPinkSoft'
                  : 'border-borderDefault text-textSecondary hover:bg-softPinkBackground'
              }`}
            >
              아이디/비밀번호
            </button>
          </div>
        </div>
      )}

      {authMethod.kind === 'easy_auth' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Field label="이름">
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full h-9 rounded-md border border-borderDefault bg-white px-2 text-sm"
              placeholder="홍길동"
            />
          </Field>
          <Field label="생년월일 6자리">
            <input
              value={birth}
              onChange={(e) => setBirth(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full h-9 rounded-md border border-borderDefault bg-white px-2 text-sm"
              placeholder="900101"
              inputMode="numeric"
            />
          </Field>
          <Field label="휴대폰" className="sm:col-span-2">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
              className="w-full h-9 rounded-md border border-borderDefault bg-white px-2 text-sm"
              placeholder="01012345678"
              inputMode="numeric"
            />
          </Field>
        </div>
      )}

      {authMethod.kind === 'id_password' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Field label={authMethod.idLabel}>
            <input
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              autoComplete="username"
              className="w-full h-9 rounded-md border border-borderDefault bg-white px-2 text-sm"
            />
          </Field>
          <Field label={authMethod.passwordLabel}>
            <input
              type="password"
              value={loginPw}
              onChange={(e) => setLoginPw(e.target.value)}
              autoComplete="current-password"
              className="w-full h-9 rounded-md border border-borderDefault bg-white px-2 text-sm"
            />
          </Field>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onBack}>
          뒤로
        </Button>
        <Button variant="primary" onClick={onSubmit}>
          연동 시작
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className ?? ''}`}>
      <div className="text-xs text-textSecondary mb-1">{label}</div>
      {children}
    </label>
  );
}

function labelOf(c: 'kakao' | 'pass' | 'naver' | 'samsung'): string {
  return c === 'kakao' ? '카카오' : c === 'pass' ? 'PASS' : c === 'naver' ? '네이버' : '삼성';
}
