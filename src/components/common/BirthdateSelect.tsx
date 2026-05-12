'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Props = {
  value: string; // 'YYYY-MM-DD' 또는 빈 문자열
  onChange: (v: string) => void;
};

const NOW = new Date();
const MAX_YEAR = NOW.getFullYear();
const MIN_YEAR = MAX_YEAR - 100;

function daysInMonth(year: number, month1to12: number): number {
  return new Date(year, month1to12, 0).getDate();
}
function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * 부분 입력(년만 / 년+월만)을 자체 state로 보관해 select가 빈 칸으로 돌아가지 않게 한다.
 * 셋 다 채워졌을 때만 부모(onChange)에 'YYYY-MM-DD' 전달.
 * value(props)는 초기값 + 외부 리셋 신호로만 사용.
 */
export function BirthdateSelect({ value, onChange }: Props) {
  const [y, setY] = useState('');
  const [m, setM] = useState('');
  const [d, setD] = useState('');
  const lastValueRef = useRef<string>(''); // value props가 정말 외부에서 변한 경우에만 sync

  // value props가 외부에서 새로 들어왔을 때만 내부 state로 동기화
  useEffect(() => {
    if (value === lastValueRef.current) return;
    lastValueRef.current = value;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (match) {
      setY(match[1]);
      setM(match[2]);
      setD(match[3]);
    } else if (!value) {
      // 외부에서 비웠을 때만 reset (예: 폼 초기화)
      setY('');
      setM('');
      setD('');
    }
  }, [value]);

  // 셋 다 채워졌으면 부모에 전달, 아니면 빈 문자열
  useEffect(() => {
    const composed = y && m && d ? `${y}-${m}-${d}` : '';
    if (composed !== lastValueRef.current) {
      lastValueRef.current = composed;
      onChange(composed);
    }
    // y/m/d만 의존성. onChange는 매 렌더 새로 만들어질 수 있어 의도적으로 제외.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [y, m, d]);

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

  // 월/년 변경으로 일이 범위를 벗어나면 자동 clamp
  useEffect(() => {
    if (!d) return;
    if (Number(d) > dayCount) setD(pad2(dayCount));
  }, [dayCount, d]);

  const baseClass =
    'h-11 px-3 rounded-lg border border-borderDefault bg-pageBackground text-textPrimary text-sm';

  return (
    <div className="grid grid-cols-3 gap-2">
      <select
        value={y}
        onChange={(e) => setY(e.target.value)}
        className={baseClass}
        aria-label="년"
      >
        <option value="">년</option>
        {years.map((yr) => (
          <option key={yr} value={String(yr)}>
            {yr}년
          </option>
        ))}
      </select>
      <select
        value={m}
        onChange={(e) => setM(e.target.value ? pad2(Number(e.target.value)) : '')}
        className={baseClass}
        aria-label="월"
      >
        <option value="">월</option>
        {months.map((mo) => (
          <option key={mo} value={pad2(mo)}>
            {mo}월
          </option>
        ))}
      </select>
      <select
        value={d}
        onChange={(e) => setD(e.target.value ? pad2(Number(e.target.value)) : '')}
        className={baseClass}
        aria-label="일"
      >
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
