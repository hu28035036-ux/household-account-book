import { Suspense } from 'react';
import LoginClient from './LoginClient';

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#FFF7FA]">
          <div className="text-sm text-[#6B7280]">로그인 화면을 불러오는 중...</div>
        </div>
      }
    >
      <LoginClient />
    </Suspense>
  );
}
