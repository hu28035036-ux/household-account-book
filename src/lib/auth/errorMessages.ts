/**
 * Supabase Auth 에러 메시지를 한국어로 변환.
 * 영문 메시지가 자주 바뀌므로 패턴 매칭으로 가능한 한 폭넓게 잡는다.
 * 알려지지 않은 메시지는 일반 한국어 fallback으로 표시.
 */
export function localizeAuthError(rawMessage: string | null | undefined, fallback = '오류가 발생했습니다.'): string {
  const m = (rawMessage ?? '').toLowerCase().trim();
  if (!m) return fallback;

  // 화이트리스트 거부
  if (/email_not_allowed|not.*on.*invite|not allowed/.test(m)) {
    return '초대 명단에 등록되지 않은 이메일입니다. 관리자에게 등록을 요청하세요.';
  }

  // 트리거가 던진 raise exception → "Database error saving new user"로 래핑됨
  if (/database error saving new user/.test(m)) {
    return '가입 처리 중 오류가 발생했습니다. 잠시 후 다시 시도하거나 운영자에게 문의해 주세요.';
  }

  // 메일 발송 한도
  if (/email rate limit|rate limit exceeded/.test(m)) {
    return '이메일 발송 한도에 도달했습니다. 1시간 후 다시 시도하거나, 운영자에게 SMTP 설정을 요청해 주세요.';
  }

  // 너무 자주 시도
  if (/too many requests|429|over_request_rate_limit/.test(m)) {
    return '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.';
  }

  // 코드 만료/불일치
  if (/(token|otp).*(expired|invalid)|invalid.*token|expired/.test(m)) {
    return '인증 코드가 만료되었거나 일치하지 않습니다. 새 코드를 받아 다시 시도하세요.';
  }
  if (/invalid login credentials|invalid grant/.test(m)) {
    return '인증 정보가 올바르지 않습니다.';
  }

  // 사용자 차단
  if (/user banned|user.*disabled|forbidden/.test(m)) {
    return '계정이 차단되었습니다. 운영자에게 문의해 주세요.';
  }

  // 이메일 형식
  if (/invalid.*email|email.*invalid/.test(m)) {
    return '이메일 형식이 올바르지 않습니다.';
  }

  // 사용자 미확인
  if (/email.*not.*confirmed|not confirmed/.test(m)) {
    return '이메일 인증이 완료되지 않았습니다. 메일함을 확인해 주세요.';
  }

  // 네트워크
  if (/network|fetch failed|failed to fetch|timeout/.test(m)) {
    return '네트워크 오류로 요청이 실패했습니다. 잠시 후 다시 시도해 주세요.';
  }

  // 일반 fallback (원문 일부 노출 — 디버깅에 도움)
  const short = (rawMessage ?? '').slice(0, 120);
  return `${fallback} (${short})`;
}
