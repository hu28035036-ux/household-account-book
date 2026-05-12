import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // 테마별로 변하는 토큰 — globals.css 의 :root / [data-theme] 에서 정의
        appBackground: 'var(--app-bg)',
        pageBackground: 'var(--page-bg)',
        softPinkBackground: 'var(--soft-bg)',
        cardBackground: 'var(--card-bg)',
        sectionBackground: 'var(--section-bg)',
        primaryPink: 'var(--primary)',
        primaryPinkHover: 'var(--primary-hover)',
        primaryPinkSoft: 'var(--primary-soft)',
        primaryPinkLight: 'var(--primary-light)',
        primaryPinkBorder: 'var(--primary-border)',
        primaryPinkDark: 'var(--primary-dark)',
        textPrimary: 'var(--text-primary)',
        textSecondary: 'var(--text-secondary)',
        textMuted: 'var(--text-muted)',
        textOnPink: 'var(--text-on-primary)',
        textPinkStrong: 'var(--primary-strong)',
        borderDefault: 'var(--border-default)',
        borderSoft: 'var(--border-soft)',
        divider: 'var(--divider)',
        // 상태·거래색·warning bg/text — globals.css 의 :root / html.dark 에서 값 정의.
        // 다크 모드 자동 전환 위해 CSS 변수 참조.
        success: 'var(--success)',
        successSoft: 'var(--success-soft)',
        warning: 'var(--warning)',
        warningSoft: 'var(--warning-soft)',
        danger: 'var(--danger)',
        dangerSoft: 'var(--danger-soft)',
        info: 'var(--info)',
        infoSoft: 'var(--info-soft)',
        income: 'var(--income)',
        incomeSoft: 'var(--income-soft)',
        expense: 'var(--expense)',
        expenseSoft: 'var(--expense-soft)',
        transfer: 'var(--transfer)',
        transferSoft: 'var(--transfer-soft)',
        duplicateWarningBg: 'var(--duplicate-warning-bg)',
        duplicateWarningText: 'var(--duplicate-warning-text)',
        needsReviewBg: 'var(--needs-review-bg)',
        needsReviewText: 'var(--needs-review-text)',
      },
      fontFamily: {
        sans: ['Pretendard', 'Noto Sans KR', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.06)',
      },
      borderRadius: {
        card: '12px',
        modal: '16px',
      },
    },
  },
  plugins: [],
};

export default config;
