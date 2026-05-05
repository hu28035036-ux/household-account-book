import { describe, it, expect } from 'vitest';
import { maskAll, maskCardLike, maskRrn, maskBrn, maskPhone, maskApprovalNumber } from '@/lib/security/masking';

describe('masking', () => {
  it('카드번호 끝 4자리만 보존', () => {
    expect(maskCardLike('카드번호 1234-5678-9012-3456 사용')).toBe('카드번호 ****-****-****-3456 사용');
    expect(maskCardLike('1234567890123456')).toBe('****-****-****-3456');
  });

  it('주민번호 마스킹', () => {
    expect(maskRrn('900101-1234567 주민')).toBe('******-******* 주민');
  });

  it('사업자번호 마지막 그룹만', () => {
    expect(maskBrn('123-45-67890 사업자')).toBe('***-**-67890 사업자');
  });

  it('전화번호 끝 4자리만', () => {
    expect(maskPhone('010-1234-5678')).toBe('010-****-5678');
    expect(maskPhone('02-123-4567')).toBe('02-****-4567');
  });

  it('승인번호 라벨 뒤 숫자 가림', () => {
    expect(maskApprovalNumber('승인번호: 123456789')).toBe('승인번호: ***');
    expect(maskApprovalNumber('승인 번호 # 987654')).toBe('승인 번호 # ***');
  });

  it('maskAll: 카드+전화+주민 동시', () => {
    const s = '카드 1234-5678-9012-3456 / 전화 010-1234-5678 / 주민 900101-1234567';
    const out = maskAll(s);
    expect(out).toContain('****-****-****-3456');
    expect(out).toContain('010-****-5678');
    expect(out).toContain('******-*******');
    expect(out).not.toContain('900101-1234567');
    expect(out).not.toContain('1234-5678-9012-3456');
  });

  it('maskAll: 8자리 이상 단독 숫자(추정 계좌)는 끝 4자리만', () => {
    const out = maskAll('계좌 1234567890');
    expect(out).toBe('계좌 ******7890');
  });

  it('maskAll: 짧은 숫자는 그대로', () => {
    expect(maskAll('금액 5800원')).toBe('금액 5800원');
  });
});
