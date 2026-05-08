// Lightweight schema validator for harness cases & adapter signatures.
// Avoids zod / external deps — just enough to catch typos and missing fields.
//
// Schema shape:
//   { field: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'string?' | ... }
// '?' suffix marks optional. Nested objects: { input: { text: 'string' } }.
//
// design-log 06-coupling C-06, C-07.

function typeOf(v) {
  if (v === null || v === undefined) return 'undefined';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

function checkValue(value, type, path, errors) {
  const optional = type.endsWith('?');
  const t = optional ? type.slice(0, -1) : type;
  if (value === undefined || value === null) {
    if (!optional) errors.push(`${path}: missing (expected ${t})`);
    return;
  }
  const actual = typeOf(value);
  if (t === 'any') return;
  if (t !== actual) errors.push(`${path}: expected ${t}, got ${actual}`);
}

export function validate(value, schema, basePath = '') {
  const errors = [];
  walk(value, schema, basePath, errors);
  return { ok: errors.length === 0, errors };
}

function walk(value, schema, path, errors) {
  if (typeof schema === 'string') {
    checkValue(value, schema, path || '<root>', errors);
    return;
  }
  if (schema && typeof schema === 'object' && !Array.isArray(schema)) {
    if (typeOf(value) !== 'object') {
      errors.push(`${path || '<root>'}: expected object, got ${typeOf(value)}`);
      return;
    }
    for (const [key, subSchema] of Object.entries(schema)) {
      const sub = value?.[key];
      const subPath = path ? `${path}.${key}` : key;
      // Optional-marker leaf at top level: { foo: 'string?' } — already handled by walk-into-string.
      if (typeof subSchema === 'string') {
        checkValue(sub, subSchema, subPath, errors);
      } else {
        walk(sub, subSchema, subPath, errors);
      }
    }
  }
}
