/**
 * 지인 배포 규모이므로 관리자 식별은 환경변수 ADMIN_EMAILS(콤마 구분).
 * 다중 사용자 운영 단계에서는 별도 admins 테이블 + RLS로 이전.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}
