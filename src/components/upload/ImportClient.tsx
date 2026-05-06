'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload as UploadIcon } from 'lucide-react';
import { Card, CardSubtle, CardTitle } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import {
  parseClientFile,
  EncryptedFileError,
  WrongPasswordError,
  type SheetData,
} from '@/lib/import/parsers';
import { Modal } from '@/components/common/Modal';

// 운영자 연락 이메일 — Vercel env 에 NEXT_PUBLIC_SUPPORT_EMAIL 을 두면 그 값,
// 없으면 ADMIN_EMAILS 첫 사용자(hu28035036@gmail.com) 을 fallback.
const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'hu28035036@gmail.com';
const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
  'AI 가계부 — 파일 인식 안 됨',
)}&body=${encodeURIComponent(
  '운영자님께,\n\n첨부한 거래내역 파일이 앱에서 인식되지 않습니다.\n비밀번호: \n사용 은행/카드사: \n\n은행 호환 추가 부탁드립니다.\n',
)}`;
import {
  autoDetectMapping,
  FIELD_LABELS,
  FIELD_ORDER,
  type ColumnMapping,
  type FieldKey,
} from '@/lib/import/columnMapping';
import { normalizeRow } from '@/lib/import/normalize';
import { formatKRW } from '@/lib/formatting/money';

type Phase = 'idle' | 'parsing' | 'mapping' | 'preview' | 'committing' | 'done' | 'error';

export function ImportClient() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SheetData | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});

  // 비번 보호 파일 흐름
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordPending, setPasswordPending] = useState(false);

  async function tryParse(file: File, pwd?: string) {
    const sheet = await parseClientFile(file, pwd);
    if (sheet.rows.length === 0) {
      throw new Error('데이터가 비어 있습니다. 헤더 행이 첫 줄에 있는지 확인해 주세요.');
    }
    setData(sheet);
    setMapping(autoDetectMapping(sheet.headers));
    setPhase('mapping');
  }

  async function pick(file: File) {
    setError(null);
    setPhase('parsing');
    try {
      await tryParse(file);
    } catch (e) {
      if (e instanceof EncryptedFileError) {
        // 비번 입력 모달 띄우고 phase 는 idle 로 되돌림
        setPendingFile(file);
        setPassword('');
        setPasswordError(null);
        setPasswordOpen(true);
        setPhase('idle');
        return;
      }
      setPhase('error');
      setError(e instanceof Error ? e.message : '파일 파싱 실패');
    }
  }

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!pendingFile || !password) return;
    setPasswordError(null);
    setPasswordPending(true);
    try {
      await tryParse(pendingFile, password);
      // 성공 — 모달 닫음
      setPasswordOpen(false);
      setPendingFile(null);
      setPassword('');
    } catch (err) {
      if (err instanceof WrongPasswordError) {
        setPasswordError('비밀번호가 올바르지 않습니다. 다시 입력해 주세요.');
      } else {
        setPasswordError(err instanceof Error ? err.message : '파일 파싱 실패');
      }
    } finally {
      setPasswordPending(false);
    }
  }

  const previewRows = data?.rows.slice(0, 200).map((r) => normalizeRow(r, mapping)) ?? [];
  const okCount = previewRows.filter(
    (r) =>
      r.transaction_date &&
      r.amount !== null &&
      !r.warnings.includes('date_uncertain') &&
      !r.warnings.includes('amount_uncertain'),
  ).length;

  async function commit() {
    if (!data) return;
    setPhase('committing');
    try {
      const candidates = data.rows.map((r) => normalizeRow(r, mapping));
      const res = await fetch('/api/import/commit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ candidates }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? 'import 실패');
      setPhase('done');
      router.push('/candidates');
    } catch (e) {
      setPhase('error');
      setError(e instanceof Error ? e.message : 'import 실패');
    }
  }

  return (
    <div className="space-y-4">
      {phase === 'idle' && (
        <Card>
          <CardTitle>CSV / XLSX 가져오기</CardTitle>
          <CardSubtle className="mt-1">
            카드사·은행 명세서를 다운로드한 CSV 또는 엑셀 파일을 올려보세요. 파일은 브라우저에서 파싱되어 서버에는 가공된 후보만 저장됩니다.
          </CardSubtle>
          <label className="mt-4 inline-flex h-11 px-4 items-center gap-2 rounded-lg bg-primaryPink text-textOnPink font-medium hover:bg-primaryPinkHover cursor-pointer">
            <UploadIcon className="h-4 w-4" strokeWidth={1.75} />
            파일 선택
            <input
              type="file"
              accept=".csv,.xlsx,.xls,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) pick(f);
              }}
            />
          </label>
          <div className="mt-4 rounded-md bg-softPinkBackground/60 px-3 py-2.5 text-xs text-textSecondary">
            <div className="font-medium text-textPrimary mb-1">🔒 비밀번호가 걸린 파일이라면</div>
            그대로 올리세요. 자동으로 비밀번호 입력창이 뜹니다.<br />
            은행/카드사가 보낸 안내 이메일이나 다운로드 화면에 비밀번호 형식이 적혀 있어요.
            <span className="block mt-1 text-textMuted">
              예) 주민번호 앞 6자리(생년월일) · 카드번호 뒤 4자리 · 본인 설정 비밀번호 등
            </span>
          </div>
          <div className="mt-2 rounded-md border border-borderSoft px-3 py-2.5 text-xs text-textSecondary">
            <div className="font-medium text-textPrimary mb-1">📩 파일 인식이 안 되나요?</div>
            새 은행 형식이거나 컬럼이 자동으로 잡히지 않는 경우, 파일과 비밀번호를 운영자에게 보내주시면
            은행 호환을 추가해드립니다.
            <a
              href={SUPPORT_MAILTO}
              className="ml-1 text-textPinkStrong hover:underline break-all"
            >
              {SUPPORT_EMAIL}
            </a>
          </div>
          <div className="mt-2 rounded-md bg-warningSoft px-3 py-2.5 text-xs text-warning">
            <div className="font-medium mb-1">📌 대량 import 주의</div>
            한 번에 수십~수백 건의 거래가 한꺼번에 등록됩니다. 이미 직접 입력했거나 영수증 분석으로
            등록된 거래와 <b>중복</b>이 있을 수 있어요. 가져오기 후{' '}
            <b>‘분석 후보’ 페이지에서 중복 의심 표시</b>를 꼭 확인하고 승인하세요.
          </div>
        </Card>
      )}

      {phase === 'parsing' && (
        <Card>
          <CardSubtle>파일을 읽고 있어요…</CardSubtle>
        </Card>
      )}

      {(phase === 'mapping' || phase === 'preview') && data && (
        <>
          <Card>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle>컬럼 매핑</CardTitle>
              <Badge tone="muted">총 {data.rows.length}행</Badge>
            </div>
            <CardSubtle className="mt-1">
              자동 감지된 결과를 확인하고, 잘못 잡혔으면 직접 골라주세요.
            </CardSubtle>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {FIELD_ORDER.map((field) => (
                <label key={field} className="block">
                  <span className="text-xs text-textSecondary">{FIELD_LABELS[field]}</span>
                  <select
                    value={mapping[field] ?? ''}
                    onChange={(e) =>
                      setMapping((m) => ({ ...m, [field]: e.target.value || undefined }))
                    }
                    className="mt-1 w-full h-10 px-3 rounded-lg border border-borderDefault bg-white text-textPrimary text-sm"
                  >
                    <option value="">— 사용 안 함 —</option>
                    {data.headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <p className="mt-3 text-xs text-textMuted">
              팁: 카드 명세서는 “이용 일자 / 가맹점 / 이용 금액”, 계좌 내역은 “거래일 / 적요 / 입금 / 출금” 컬럼 매핑을 권장합니다.
            </p>
          </Card>

          <Card>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle>미리보기 (앞 200행)</CardTitle>
              <Badge tone={okCount === previewRows.length ? 'success' : 'warning'}>
                안전 {okCount} / {previewRows.length}
              </Badge>
            </div>
            <div className="mt-3 overflow-x-auto rounded-lg border border-borderDefault">
              <table className="min-w-full text-sm">
                <thead className="bg-sectionBackground text-textSecondary">
                  <tr>
                    <th className="text-left px-3 py-2">날짜</th>
                    <th className="text-left px-3 py-2">유형</th>
                    <th className="text-right px-3 py-2">금액</th>
                    <th className="text-left px-3 py-2">가맹점</th>
                    <th className="text-left px-3 py-2">결제수단</th>
                    <th className="text-left px-3 py-2">카테고리</th>
                    <th className="text-left px-3 py-2">경고</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-divider">
                  {previewRows.map((r, i) => (
                    <tr key={i}>
                      <td className="px-3 py-1.5">{r.transaction_date ?? '-'}</td>
                      <td className="px-3 py-1.5">
                        <span
                          className={
                            'tabular ' +
                            (r.type === 'income'
                              ? 'text-income'
                              : r.type === 'transfer'
                              ? 'text-transfer'
                              : 'text-expense')
                          }
                        >
                          {r.type === 'income' ? '수입' : r.type === 'transfer' ? '이체' : '지출'}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-right tabular">
                        {r.amount === null ? '-' : formatKRW(r.amount)}
                      </td>
                      <td className="px-3 py-1.5 truncate max-w-[200px]">{r.merchant_name ?? '-'}</td>
                      <td className="px-3 py-1.5">{r.payment_method_suggestion ?? '-'}</td>
                      <td className="px-3 py-1.5">{r.category_suggestion ?? '-'}</td>
                      <td className="px-3 py-1.5 text-xs text-textMuted">{r.warnings.join(', ') || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 rounded-md bg-warningSoft px-3 py-2 text-xs text-warning">
              📌 <b>{data.rows.length}건</b>이 한 번에 ‘분석 후보’로 들어갑니다. 이미 입력된 거래와
              중복일 수 있으니, 가져오기 후 <b>분석 후보 페이지에서 중복 의심 표시</b>를 꼭 확인하고
              승인하세요.
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setData(null);
                  setMapping({});
                  setPhase('idle');
                }}
              >
                다시 선택
              </Button>
              <Button
                onClick={commit}
                disabled={
                  !mapping.transaction_date || (!mapping.amount && !(mapping.amount_in && mapping.amount_out))
                }
              >
                후보로 가져오기 ({data.rows.length}건)
              </Button>
            </div>
            {!mapping.transaction_date && (
              <p className="mt-2 text-xs text-warning">날짜 컬럼을 선택해야 가져올 수 있어요.</p>
            )}
            {!mapping.amount && !(mapping.amount_in && mapping.amount_out) && (
              <p className="mt-2 text-xs text-warning">금액 컬럼(또는 입금/출금 두 컬럼)을 선택하세요.</p>
            )}
          </Card>
        </>
      )}

      {phase === 'committing' && (
        <Card>
          <CardSubtle>후보로 등록하는 중…</CardSubtle>
        </Card>
      )}

      {phase === 'error' && (
        <Card>
          <p className="text-sm rounded-md bg-dangerSoft text-danger px-3 py-2">{error}</p>
          <div className="mt-3 flex justify-end">
            <Button variant="ghost" onClick={() => setPhase('idle')}>
              다시 시도
            </Button>
          </div>
        </Card>
      )}

      <Modal
        open={passwordOpen}
        onClose={() => {
          setPasswordOpen(false);
          setPendingFile(null);
          setPassword('');
          setPasswordError(null);
        }}
        title="비밀번호 입력"
      >
        <form onSubmit={submitPassword} className="space-y-3">
          <p className="text-sm text-textSecondary">
            <b className="text-textPrimary">{pendingFile?.name}</b> 파일이 비밀번호로 보호되어
            있습니다.
          </p>
          <div className="rounded-md bg-softPinkBackground/60 px-3 py-2.5 text-xs text-textSecondary">
            <div className="font-medium text-textPrimary mb-1">📧 비밀번호 형식 안내</div>
            은행/카드사가 보낸 안내 이메일이나 파일 다운로드 화면에서 비밀번호 형식을 확인하세요.
            <ul className="mt-1 list-disc pl-4 space-y-0.5">
              <li>주민등록번호 앞 6자리 (생년월일 YYMMDD)</li>
              <li>카드번호 뒤 4자리</li>
              <li>본인이 설정한 비밀번호</li>
            </ul>
          </div>
          <div className="rounded-md border border-borderSoft px-3 py-2.5 text-xs text-textSecondary">
            <div className="font-medium text-textPrimary mb-1">📩 풀어도 인식이 안 되면</div>
            비밀번호가 맞는데도 항목이 잡히지 않으면 파일과 비밀번호를 운영자에게 보내주세요.
            은행 호환을 추가해드립니다.
            <a
              href={SUPPORT_MAILTO}
              className="ml-1 text-textPinkStrong hover:underline break-all"
            >
              {SUPPORT_EMAIL}
            </a>
          </div>
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호"
            className="w-full h-11 px-3 rounded-lg border border-borderDefault bg-white text-textPrimary"
          />
          {passwordError && (
            <p className="text-sm rounded-md bg-dangerSoft text-danger px-3 py-2">
              {passwordError}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setPasswordOpen(false);
                setPendingFile(null);
                setPassword('');
                setPasswordError(null);
              }}
              disabled={passwordPending}
            >
              취소
            </Button>
            <Button type="submit" disabled={passwordPending || !password}>
              {passwordPending ? '확인 중…' : '확인'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
