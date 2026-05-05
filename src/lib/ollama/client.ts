/**
 * Ollama HTTP 클라이언트. 별도 서버(로컬 PC 또는 전용 머신)에서 실행되는 ollama serve를 호출.
 */

type GenerateOptions = {
  prompt: string;
  model?: string;
  temperature?: number;
  format?: 'json';
  signal?: AbortSignal;
};

export class OllamaUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OllamaUnavailableError';
  }
}

export async function ollamaGenerate(opts: GenerateOptions): Promise<string> {
  const base = process.env.OLLAMA_API_BASE_URL;
  const model = opts.model ?? process.env.OLLAMA_MODEL ?? 'gemma4:e4b';
  if (!base) throw new OllamaUnavailableError('OLLAMA_API_BASE_URL 미설정');

  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (process.env.OLLAMA_API_TOKEN) {
    headers['x-ai-token'] = process.env.OLLAMA_API_TOKEN;
  }

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 60_000);
  const signal = opts.signal ?? ctrl.signal;

  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/api/generate`, {
      method: 'POST',
      headers,
      signal,
      body: JSON.stringify({
        model,
        prompt: opts.prompt,
        stream: false,
        format: opts.format ?? 'json',
        options: {
          temperature: opts.temperature ?? 0.1,
        },
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new OllamaUnavailableError(`Ollama HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    const json = (await res.json()) as { response?: string };
    return json.response ?? '';
  } catch (e) {
    if (e instanceof OllamaUnavailableError) throw e;
    throw new OllamaUnavailableError(e instanceof Error ? e.message : 'Ollama 호출 실패');
  } finally {
    clearTimeout(timeout);
  }
}
