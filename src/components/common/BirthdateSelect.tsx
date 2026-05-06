'use client';

import { useEffect, useMemo } from 'react';

type Props = {
  value: string; // 'YYYY-MM-DD' 또는 빈 문자열
  onChange: (v: string) => void;
};

const NOW = new Date();
const MAX_YEAR = NOW.getFullYear();
const MIN_YEAR = MAX_YEAR - 100;

function daysInMonth(year: number, month1to12: number): number {
  // 월의 마지막 날 계산 (year/month/0의 트릭)
  return new Date(year, month1to12, 0).getDate();
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function BirthdateSelect({ value, onChange }: Props) {
  const [y, m, d] = useMemo(() => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return ['', '', ''] as const;
    return [match[1], match[2], match[3]] as const;
  }, [value]);

  const years = useMemo(() => {
    const arr: number[] = [];
    for (let yr = MAX_YEAR; yr >= MIN_YEAR; yr--) arr.push(yr);
    return arr;
  }, []);
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);

  const dayCount = useMemo(() => {
    const yi = Number(y);
    const mi = Number(m);
    if (!yi || !mi) return 31;
    return daysInMonth(yi, mi);
  }, [y, m]);
  const days = useMemo(() => Array.from({ length: dayCount }, (_, i) => i + 1), [dayCount]);

  // 월이 바뀌어 일이 범위를 벗어나면 자동 보정 (예: 3/31 → 2월 선택 시 28/29로 clamp)
  useEffect(() => {
    if (!d) return;
    const di = Number(d);
    if (di > dayCount) {
      onChange(`${y || '0000'}-${m || '00'}-${pad2(dayCount)}`);
    }
  }, [dayCount, d, y, m, onChange]);

  function update(part: 'y' | 'm' | 'd', val: string) {
    const ny = part === 'y' ? val : y;
    const nm = part === 'm' ? val : m;
    const nd = part === 'd' ? val : d;
    if (ny && nm && nd) {
      onChange(`${ny}-${nm}-${nd}`);
    } else {
      // 모두 채워지지 않으면 빈 문자열로(검증 실패 유도)
      onChange('');
    }
  }

  const baseClass =
    'h-11 px-3 rounded-lg border border-borderDefault bg-white text-textPrimary text-sm';

  return (
    <div className="grid grid-cols-3 gap-2">
      <select value={y} onChange={(e) => update('y', e.target.value)} className={baseClass} aria-label="년">
        <option value="">년</option>
        {years.map((yr) => (
          <option key={yr} value={String(yr)}>
            {yr}년
          </option>
        ))}
      </select>
      <select value={m} onChange={(e) => update('m', e.target.value && pad2(Number(e.target.value)))} className={baseClass} aria-label="월">
        <option value="">월</option>
        {months.map((mo) => (
          <option key={mo} value={pad2(mo)}>
            {mo}월
          </option>
        ))}
      </select>
      <select value={d} onChange={(e) => update('d', e.target.value && pad2(Number(e.target.value)))} className={baseClass} aria-label="일">
        <option value="">일</option>
        {days.map((da) => (
          <option key={da} value={pad2(da)}>
            {da}일
          </option>
        ))}
      </select>
    </div>
  );
}
