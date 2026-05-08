/**
 * OpenAI Chat Completions 클라이언트.
 * 영수증 추출 같은 짧은 JSON 응답에 최적화 — response_format=json_object + max_tokens 제한 + 60s 타임아웃.
 *
 * 주의: 입력 prompt에는 반드시 maskAll() 거친 텍스트만 전달할 것.
 */

export type LLMUsage = { input: number; output: number };
export type LLMResult = { content: string; usage: LLMUsage; model: string };

type GenerateOptions = {
  prompt: string;
  model?: string;
  temperature?: number;
  signal?: AbortSignal;
  maxTokens?: number;
  /**
   * 이미지를 함께 전달 (gpt-4o-mini vision). data URL 또는 https URL 배열.
   * 영수증/카드내역 인식 정확도 큰 폭 향상 — Tesseract OCR 망가져도 이미지로 보강.
   */
  imageUrls?: string[];
};

export class OpenAIUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpenAIUnavailableError';
  }
}

const SYSTEM_PROMPT =
  '너는 한국어 가계부 영수증/카드내역/계좌내역 분석기다. 반드시 JSON 객체 한 개만 출력한다. 설명, 코드블록, 추가 텍스트 금지.';

export async function openaiGenerate(opts: GenerateOptions): Promise<LLMResult> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new OpenAIUnavailableError('OPENAI_API_KEY 미설정');
  const model = opts.model ?? process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 60_000);
  const signal = opts.signal ?? ctrl.signal;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content:
              opts.imageUrls && opts.imageUrls.length > 0
                ? [
                    { type: 'text', text: opts.prompt },
                    ...opts.imageUrls.map((url) => ({
                      type: 'image_url',
                      image_url: { url, detail: 'low' as const },
                    })),
                  ]
                : opts.prompt,
          },
        ],
        temperature: opts.temperature ?? 0.1,
        max_tokens: opts.maxTokens ?? 1500,
        response_format: { type: 'json_object' },
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new OpenAIUnavailableError(`OpenAI HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const content = json?.choices?.[0]?.message?.content ?? '';
    const usage: LLMUsage = {
      input: json?.usage?.prompt_tokens ?? 0,
      output: json?.usage?.completion_tokens ?? 0,
    };
    return { content, usage, model };
  } catch (e) {
    if (e instanceof OpenAIUnavailableError) throw e;
    if (e instanceof Error && e.name === 'AbortError') {
      throw new OpenAIUnavailableError('OpenAI 호출 타임아웃 (60초)');
    }
    throw new OpenAIUnavailableError(e instanceof Error ? e.message : 'OpenAI 호출 실패');
  } finally {
    clearTimeout(timeout);
  }
}
