// Extraction adapter — calls the running dev server's /api/extraction route.
// In --mock mode, returns a deterministic stub so the harness can exercise the
// runner/comparator without hitting a live LLM.

const BASE = process.env.HARNESS_BASE_URL || 'http://localhost:3000';

export const inputSchema = {
  input: { text: 'string', user_hints: 'object?' },
};
export const expectedSchema = {
  candidates: 'array',
};

export async function run(testCase, opts) {
  if (opts?.mock) {
    return mockExtraction(testCase);
  }
  const res = await fetch(`${BASE}/api/extraction/preview`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      text: testCase.input?.text ?? '',
      hints: testCase.input?.user_hints ?? null,
    }),
  });
  if (!res.ok) throw new Error(`extraction api ${res.status}`);
  const data = await res.json();
  return { candidates: data.candidates ?? [] };
}

function mockExtraction(testCase) {
  // Bare minimum: echo expected so mock mode lets the runner shake out shape issues.
  // Replace with parser/normalizer logic if you want the harness to catch parser regressions
  // without touching the LLM.
  return testCase.expected ?? { candidates: [] };
}
