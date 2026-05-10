import { NextResponse } from 'next/server';

type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'BAD_REQUEST'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL'
  | 'AI_UNAVAILABLE';

const STATUS: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL: 500,
  AI_UNAVAILABLE: 503,
};

const IS_PROD = process.env.NODE_ENV === 'production';

// prod 에서 노출 안전한 일반 메시지로 대체할 코드들 (5xx 류).
// 4xx 는 사용자가 입력 보정해야 하므로 메시지 그대로 노출.
const SANITIZE_CODES: ReadonlyArray<ErrorCode> = ['INTERNAL', 'AI_UNAVAILABLE'];

const SAFE_MESSAGE: Partial<Record<ErrorCode, string>> = {
  INTERNAL: '서버 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
  AI_UNAVAILABLE: 'AI 서버에 일시적으로 연결할 수 없어요. 잠시 후 다시 시도해 주세요.',
};

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, init);
}

/**
 * fail — 표준 에러 응답.
 *
 * Privacy/security: prod 에서는 5xx 류(INTERNAL/AI_UNAVAILABLE) 의 message·details 를
 * 일반 메시지로 sanitize 해 stack trace, Zod 내부 구조, DB 에러 메시지 등이
 * 클라이언트에 누설되지 않도록 한다. 4xx 는 사용자 입력 보정 단서이므로 그대로.
 * 서버 콘솔에는 원본 message 항상 기록.
 */
export function fail(code: ErrorCode, message: string, details?: unknown) {
  if (IS_PROD && SANITIZE_CODES.includes(code)) {
    // prod 에서만 sanitize — 원본은 콘솔(서버 로그)에 기록
    console.warn(`[fail/${code}] ${message}`, details);
    return NextResponse.json(
      { error: { code, message: SAFE_MESSAGE[code] ?? '서버 오류' } },
      { status: STATUS[code] },
    );
  }
  return NextResponse.json({ error: { code, message, details } }, { status: STATUS[code] });
}
