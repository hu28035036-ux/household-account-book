import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// BANKING_ENCRYPTION_KEY: 32 byte key, base64 인코딩.
// 생성: `openssl rand -base64 32`
// 누락되면 서버 시작 시점이 아니라 실제 암호화 호출 시점에서 명시적으로 throw.

function getKey(): Buffer {
  const raw = process.env.BANKING_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      'BANKING_ENCRYPTION_KEY is not set. Generate with `openssl rand -base64 32` and add to .env.local / Vercel.',
    );
  }
  const buf = Buffer.from(raw, 'base64');
  if (buf.length !== 32) {
    throw new Error(`BANKING_ENCRYPTION_KEY must decode to 32 bytes (got ${buf.length}).`);
  }
  return buf;
}

export type EncryptedCredentials = {
  ciphertext: string; // base64
  iv: string;         // base64
  tag: string;        // base64
};

export function encryptCredentials(plaintext: string): EncryptedCredentials {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: enc.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  };
}

export function decryptCredentials(blob: EncryptedCredentials): string {
  const key = getKey();
  const iv = Buffer.from(blob.iv, 'base64');
  const tag = Buffer.from(blob.tag, 'base64');
  const ciphertext = Buffer.from(blob.ciphertext, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return dec.toString('utf8');
}

/** ENV 검증을 lazy 가 아닌 즉시 하고 싶을 때 (헬스체크용) */
export function isBankingCryptoConfigured(): boolean {
  try {
    getKey();
    return true;
  } catch {
    return false;
  }
}
