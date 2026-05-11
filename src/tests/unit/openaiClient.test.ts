import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { openaiGenerate } from '@/lib/ai/openaiClient';

type FetchInit = { body?: string; headers?: Record<string, string> };
let capturedBody: any = null;

function mockOk() {
  return {
    ok: true,
    status: 200,
    text: async () => '',
    json: async () => ({
      choices: [{ message: { content: '{"document_type":"receipt","transactions":[],"global_warnings":[]}' } }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    }),
  };
}

beforeEach(() => {
  vi.stubEnv('OPENAI_API_KEY', 'test-key');
  capturedBody = null;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: FetchInit) => {
      capturedBody = init?.body ? JSON.parse(init.body) : null;
      return mockOk() as any;
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('openaiGenerate imageDetail', () => {
  it('기본값은 image_url.detail = "low" 이다', async () => {
    await openaiGenerate({
      prompt: 'test',
      imageUrls: ['https://example.com/a.png'],
    });
    const userMsg = capturedBody.messages.find((m: any) => m.role === 'user');
    const imagePart = userMsg.content.find((p: any) => p.type === 'image_url');
    expect(imagePart.image_url.detail).toBe('low');
  });

  it('imageDetail: "high" 를 전달하면 그대로 fetch body 로 전달된다', async () => {
    await openaiGenerate({
      prompt: 'test',
      imageUrls: ['https://example.com/a.png'],
      imageDetail: 'high',
    });
    const userMsg = capturedBody.messages.find((m: any) => m.role === 'user');
    const imagePart = userMsg.content.find((p: any) => p.type === 'image_url');
    expect(imagePart.image_url.detail).toBe('high');
  });

  it('imageDetail: "auto" 도 전달 가능하다', async () => {
    await openaiGenerate({
      prompt: 'test',
      imageUrls: ['https://example.com/a.png'],
      imageDetail: 'auto',
    });
    const userMsg = capturedBody.messages.find((m: any) => m.role === 'user');
    const imagePart = userMsg.content.find((p: any) => p.type === 'image_url');
    expect(imagePart.image_url.detail).toBe('auto');
  });

  it('imageUrls 가 없으면 image_url 파트가 만들어지지 않는다', async () => {
    await openaiGenerate({ prompt: 'text-only' });
    const userMsg = capturedBody.messages.find((m: any) => m.role === 'user');
    // 텍스트 한 줄 string 형태
    expect(userMsg.content).toBe('text-only');
  });

  it('maxTokens 옵션이 fetch body 의 max_tokens 로 전달된다', async () => {
    await openaiGenerate({ prompt: 'test', maxTokens: 2500 });
    expect(capturedBody.max_tokens).toBe(2500);
  });
});
