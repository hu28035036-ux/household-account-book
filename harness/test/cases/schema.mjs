// Self-test for harness/lib/schema.mjs.
// Catches regressions in the lightweight validator that runner uses to enforce
// adapter input/output shapes (C-06, C-07).

import { validate } from '../../lib/schema.mjs';

function expectOk(name, value, schema) {
  const r = validate(value, schema);
  return r.ok ? { ok: true, name } : { ok: false, name, message: `errors: ${r.errors.join('; ')}` };
}
function expectFail(name, value, schema, mustMention) {
  const r = validate(value, schema);
  if (r.ok) return { ok: false, name, message: 'expected failure, got ok' };
  if (mustMention && !r.errors.some((e) => e.includes(mustMention))) {
    return { ok: false, name, message: `errors missing "${mustMention}": ${r.errors.join('; ')}` };
  }
  return { ok: true, name };
}

export async function runSchemaCases() {
  return [
    expectOk('flat string field', { foo: 'bar' }, { foo: 'string' }),
    expectFail('flat string field — wrong type', { foo: 123 }, { foo: 'string' }, 'expected string'),
    expectFail('flat string field — missing', {}, { foo: 'string' }, 'missing'),

    expectOk('optional field present', { foo: 'bar' }, { foo: 'string?' }),
    expectOk('optional field absent', {}, { foo: 'string?' }),

    expectOk(
      'nested input/output',
      { input: { text: 'hello', hints: { x: 1 } } },
      { input: { text: 'string', hints: 'object?' } }
    ),

    expectFail(
      'nested missing required',
      { input: {} },
      { input: { text: 'string' } },
      'input.text'
    ),

    expectOk('array type', { items: [1, 2, 3] }, { items: 'array' }),
    expectFail('array type — got object', { items: { 0: 'a' } }, { items: 'array' }, 'expected array'),

    expectOk('any type accepts everything', { x: { weird: [1, null, 'mix'] } }, { x: 'any' }),

    expectOk('boolean true', { ok: true }, { ok: 'boolean' }),
    expectFail('boolean — got string', { ok: 'true' }, { ok: 'boolean' }, 'expected boolean'),
  ];
}
