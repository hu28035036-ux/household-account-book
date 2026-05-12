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
  // PWA 앱 일관성 위해 사용자 확대 잠금. iOS Safari 16+ 는 시스템 줌으로 우회 가능.
  // 글자 작은 경우 OS 폰트 크기 설정으로 해결 권장.
  maximumScale: 1,
  minimumScale: 1,
  userScalable: false,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFF7FA' },
    { media: '(prefers-color-scheme: dark)', color: '#0E0E12' },
  ],
  colorScheme: 'light dark',
  // iOS 풀스크린 시 노치/홈바 영역까지 활용
  viewportFit: 'cover',
};

// 사용자 테마·다크모드를 첫 페인트 직전에 적용 — React hydration 전에 동기 실행되어 깜빡임 방지.
// - localStorage('theme')  : 컬러 테마 (pink|lavender|mint|mocha)
// - localStorage('themeMode'): 모드 (system|light|dark), 기본 'system' = OS 따라감
const themeInitScript = `try{
  var t=localStorage.getItem('theme');
  if(t&&t!=='pink'&&['lavender','mint','mocha'].indexOf(t)>=0){
    document.documentElement.setAttribute('data-theme',t);
  }
  var m=localStorage.getItem('themeMode')||'system';
  var prefersDark=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;
  var isDark = m==='dark' || (m==='system' && prefersDark);
  if(isDark) document.documentElement.classList.add('dark');
}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen bg-appBackground text-textPrimary font-sans">
        {children}
      </body>
    </html>
  );
}
