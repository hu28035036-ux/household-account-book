import { createHash } from 'node:crypto';
import { normalizeForHash } from '@/lib/security/masking';

export function inputHash(text: string): string {
  const normalized = normalizeForHash(text);
  return createHash('sha256').update(normalized).digest('hex');
}
