import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI 가계부',
  description: '영수증·카드/계좌 캡처를 OCR과 LLM으로 분석해 승인형으로 저장하는 가계부',
  applicationName: 'AI 가계부',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '가계부',
  },
  icons: {
    icon: [
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  formatDetection: {
    telephone: false,
  },
  // 삼성 인터넷 / Edge / Chrome / Vivaldi 등 비-Safari 계열 브라우저가
  // PWA 설치 가능성을 인지하도록 추가 신호.
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#FFF7FA',
  // iOS 풀스크린 시 노치/홈바 영역까지 활용
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-appBackground text-textPrimary font-sans">
        {children}
      </body>
    </html>
  );
}
