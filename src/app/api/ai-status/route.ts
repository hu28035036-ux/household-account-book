import { ok } from '@/lib/http/response';

export const runtime = 'nodejs';

/**
 * 가벼운 헬스 체크. AI 서버 BASE_URL이 설정되어 있고 /api/tags가 200을 반환하면 ok.
 */
export async function GET() {
  const base = process.env.OLLAMA_API_BASE_URL;
  if (!base) return ok({ ok: false, reason: 'OLLAMA_API_BASE_URL 미설정' });

  const headers: Record<string, string> = {};
  if (process.env.OLLAMA_API_TOKEN) headers['x-ai-token'] = process.env.OLLAMA_API_TOKEN;

  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(`${base.replace(/\/$/, '')}/api/tags`, {
      method: 'GET',
      headers,
      signal: ctrl.signal,
    });
    clearTimeout(timeout);
    return ok({ ok: res.ok, status: res.status });
  } catch (e) {
    return ok({ ok: false, reason: e instanceof Error ? e.message : 'unreachable' });
  }
}
