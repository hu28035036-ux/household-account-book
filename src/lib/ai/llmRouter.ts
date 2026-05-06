/**
 * LLM 공급자 라우터.
 *
 * - OPENAI_API_KEY 가 있으면 OpenAI(gpt-4o-mini default)를 1순위로 사용.
 * - OpenAI 실패 + OLLAMA_API_BASE_URL 가 있으면 Ollama로 자동 fallback.
 * - 둘 다 미설정 또는 둘 다 실패면 LLMUnavailableError.
 *
 * 즉 .env 에 OPENAI_API_KEY 만 두면 OpenAI 단독, 둘 다 두면 OpenAI 우선 + 장애 시 자동 백업.
 */

import { openaiGenerate, type LLMResult } from './openaiClient';
import { ollamaGenerate } from '@/lib/ollama/client';

export class LLMUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LLMUnavailableError';
  }
}

export type LLMOptions = {
  prompt: string;
  temperature?: number;
};

export async function llmGenerate(opts: LLMOptions): Promise<LLMResult> {
  const errs: string[] = [];

  if (process.env.OPENAI_API_KEY) {
    try {
      return await openaiGenerate({ prompt: opts.prompt, temperature: opts.temperature });
    } catch (e) {
      errs.push(`openai: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (process.env.OLLAMA_API_BASE_URL) {
    try {
      const content = await ollamaGenerate({
        prompt: opts.prompt,
        format: 'json',
        temperature: opts.temperature,
      });
      return {
        content,
        usage: { input: 0, output: 0 },
        model: process.env.OLLAMA_MODEL ?? 'gemma4:e4b',
      };
    } catch (e) {
      errs.push(`ollama: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (errs.length === 0) {
    throw new LLMUnavailableError(
      'LLM 미구성: OPENAI_API_KEY 또는 OLLAMA_API_BASE_URL 중 하나는 필요합니다.',
    );
  }
  throw new LLMUnavailableError(`LLM 호출 실패 — ${errs.join(' / ')}`);
}
