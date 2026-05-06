import { Suspense } from 'react';
import SignupClient from './SignupClient';

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#FFF7FA]">
          <div className="text-sm text-[#6B7280]">회원가입 화면을 불러오는 중...</div>
        </div>
      }
    >
      <SignupClient />
    </Suspense>
  );
}
