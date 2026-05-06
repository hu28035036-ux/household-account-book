import type { Metadata, Viewport } from 'next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI 가계부',
  description: '영수증·카드/계좌 캡처를 OCR과 로컬 LLM으로 분석해 승인형으로 저장하는 가계부',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#FFF7FA',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-appBackground text-textPrimary font-sans">
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
