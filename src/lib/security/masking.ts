/**
 * 민감정보 마스킹 유틸. 모든 외부 출력 경로(저장 직전 / 로그 / AI 요청)에서 통과시킨다.
 */

const PATTERNS = {
  // 13~19자리 카드번호 (구분자 -, 공백 허용). 부분 매칭 방지를 위해 단어 경계 사용.
  card: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
  // 주민등록번호 6-7
  rrn: /\b\d{6}-\d{7}\b/g,
  // 사업자등록번호 10자리
  brn: /\b\d{3}-\d{2}-\d{5}\b/g,
  // 전화번호 010-xxxx-xxxx, 02-xxx-xxxx, 0XX-xxx-xxxx (area code 캡처)
  phone: /\b(01[016789]|02|0[3-9]\d)-?(\d{3,4})-?(\d{4})\b/g,
  // 승인번호 라벨
  approvalNum: /(승인\s*번호\s*[:#]?\s*)\d{4,}/g,
  // 길게 이어진 숫자(추정 계좌). 단어 경계 사이 8자리 이상 연속 숫자.
  longDigits: /\b\d{8,}\b/g,
};

function keepLast(str: string, keep: number, pad = '*'): string {
  if (str.length <= keep) return str;
  const tail = str.slice(-keep);
  return pad.repeat(str.length - keep) + tail;
}

export function maskCardLike(text: string): string {
  return text.replace(PATTERNS.card, (m) => {
    const digits = m.replace(/[-\s]/g, '');
    return `****-****-****-${digits.slice(-4)}`;
  });
}

export function maskRrn(text: string): string {
  return text.replace(PATTERNS.rrn, '******-*******');
}

export function maskBrn(text: string): string {
  return text.replace(PATTERNS.brn, (m) => {
    const parts = m.split('-');
    return `***-**-${parts[2]}`;
  });
}

export function maskPhone(text: string): string {
  return text.replace(PATTERNS.phone, (_m, area: string, _mid: string, last4: string) => {
    return `${area}-****-${last4}`;
  });
}

export function maskApprovalNumber(text: string): string {
  return text.replace(PATTERNS.approvalNum, (_match, label: string) => {
    return `${label}***`;
  });
}

export function maskLongDigits(text: string): string {
  // 카드/주민/사업자/전화는 위에서 이미 처리. 그래도 남은 8자리 이상 숫자는 끝 4자리만 보존.
  return text.replace(PATTERNS.longDigits, (m) => keepLast(m, 4));
}

/**
 * 모든 마스킹을 순서대로 적용. 적용 순서가 중요(전화 vs 길게 이어진 숫자 충돌 방지).
 */
export function maskAll(text: string): string {
  if (!text) return text;
  let out = text;
  out = maskCardLike(out);
  out = maskRrn(out);
  out = maskBrn(out);
  out = maskApprovalNumber(out);
  out = maskPhone(out);
  out = maskLongDigits(out);
  return out;
}

/**
 * 정규화된 hash 키를 만들기 위한 보조: 마스킹 후 공백 압축.
 */
export function normalizeForHash(text: string): string {
  return maskAll(text).replace(/\s+/g, ' ').trim().toLowerCase();
}
