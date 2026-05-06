import { cookies } from 'next/headers';

const COOKIE_KEY = 'active_household_id';

/**
 * SSR 페이지 / 라우트 핸들러에서 호출. 클라이언트 ActiveHouseholdProvider 가
 * setActive 시 동기화한 쿠키 값을 반환.
 *
 * 반환값:
 *   - null  → "개인 모드"  (개인 가계부)
 *   - 'X'   → "모임 X 모드"
 */
export function getActiveHouseholdContext(): string | null {
  const v = cookies().get(COOKIE_KEY)?.value;
  if (!v || v === 'null') return null;
  return v;
}
