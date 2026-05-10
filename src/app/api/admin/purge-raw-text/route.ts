import { NextRequest } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { purgeOldRawText } from '@/services/ocrService';
import { fail, ok } from '@/lib/http/response';

/**
 * 7일 경과 OCR raw_text 폐기 잡.
 * 호출 주체: Vercel Cron 또는 외부 스케줄러.
 * 보호: 헤더 `x-cron-token`이 환경변수 CRON_TOKEN과 일치할 때만 동작.
 */
export const runtime = 'nodejs';

async function isAuthorized(req: NextRequest): Promise<boolean> {
  // Vercel Cron이 자동으로 붙이는 헤더는 통과 (vercel.json에 등록된 잡만 호출됨)
  if (req.headers.get('x-vercel-cron')) return true;
  // 외부 스케줄러는 x-cron-token 검증
  const token = req.headers.get('x-cron-token');
  return !!process.env.CRON_TOKEN && token === process.env.CRON_TOKEN;
}

async function handle(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return fail('UNAUTHORIZED', '잘못된 토큰');
  }
  try {
    const ttl = Number(process.env.RAW_TEXT_TTL_DAYS ?? '7');
    const supabase = createSupabaseAdminClient();
    await purgeOldRawText(supabase, ttl);
    return ok({ purgedTtlDays: ttl });
  } catch (e) {
    return fail('INTERNAL', e instanceof Error ? e.message : '폐기 실패');
  }
}

// Vercel Cron 은 GET 으로 호출 — POST 만 export 했던 기존 코드는 매일 405 발생
// (PII raw_text 가 폐기되지 않고 무기한 잔존). GET/POST 둘 다 지원.
export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
