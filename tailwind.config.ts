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
        success: '#10B981',
        successSoft: '#D1FAE5',
        warning: '#F59E0B',
        warningSoft: '#FEF3C7',
        danger: '#EF4444',
        dangerSoft: '#FEE2E2',
        info: '#60A5FA',
        infoSoft: '#DBEAFE',
        income: '#10B981',
        incomeSoft: '#D1FAE5',
        expense: '#EC4899',
        expenseSoft: '#FCE7F3',
        transfer: '#60A5FA',
        transferSoft: '#DBEAFE',
        duplicateWarningBg: '#FEF3C7',
        duplicateWarningText: '#92400E',
        needsReviewBg: '#FEE2E2',
        needsReviewText: '#991B1B',
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
