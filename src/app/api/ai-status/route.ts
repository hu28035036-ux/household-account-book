import { ok } from '@/lib/http/response';

export const runtime = 'nodejs';

type ProviderCheck = { provider: 'openai' | 'ollama'; ok: boolean; reason?: string };

/**
 * AI 공급자 가용성 체크. OpenAI 키 / Ollama URL 중 설정된 모든 공급자를 점검.
 * keep-warm 워크플로와 사이드바 상태 표시에서 사용.
 */
export async function GET() {
  const checks: ProviderCheck[] = [];

  if (process.env.OPENAI_API_KEY) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 4000);
      const res = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        signal: ctrl.signal,
      });
      clearTimeout(t);
      checks.push({
        provider: 'openai',
        ok: res.ok,
        reason: res.ok ? undefined : `HTTP ${res.status}`,
      });
    } catch (e) {
      checks.push({
        provider: 'openai',
        ok: false,
        reason: e instanceof Error ? e.message : 'unreachable',
      });
    }
  }

  if (process.env.OLLAMA_API_BASE_URL) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 4000);
      const headers: Record<string, string> = {};
      if (process.env.OLLAMA_API_TOKEN) headers['x-ai-token'] = process.env.OLLAMA_API_TOKEN;
      const base = process.env.OLLAMA_API_BASE_URL.replace(/\/$/, '');
      const res = await fetch(`${base}/api/tags`, { method: 'GET', headers, signal: ctrl.signal });
      clearTimeout(t);
      checks.push({
        provider: 'ollama',
        ok: res.ok,
        reason: res.ok ? undefined : `HTTP ${res.status}`,
      });
    } catch (e) {
      checks.push({
        provider: 'ollama',
        ok: false,
        reason: e instanceof Error ? e.message : 'unreachable',
      });
    }
  }

  if (checks.length === 0) {
    return ok({ ok: false, reason: 'AI 미구성', providers: [] });
  }
  return ok({ ok: checks.some((c) => c.ok), providers: checks });
}
