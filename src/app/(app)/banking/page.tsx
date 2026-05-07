import { redirect } from 'next/navigation';

// 보류 중 — 사업자등록 결정 후 활성화 예정.
// 활성화 절차:
//   1) 아래 내용을 실 페이지로 복원 (git log 에서 직전 버전 참고, 또는 BankingClient import 다시)
//   2) Sidebar / BottomNav / HelpSheet 의 메뉴 1줄씩 복원
//   3) Supabase 0015 마이그레이션 적용
//   4) Codef RUN 키 발급 후 Vercel env 갱신
//
// 백엔드(서비스/Provider/API 라우트/마이그레이션 SQL/Vercel env) 는 그대로 보존됨.

export default function BankingPage() {
  redirect('/dashboard');
}
