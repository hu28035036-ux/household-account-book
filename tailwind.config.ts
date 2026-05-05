import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        appBackground: '#FFF7FA',
        pageBackground: '#FFFFFF',
        softPinkBackground: '#FFF1F5',
        cardBackground: '#FFFFFF',
        sectionBackground: '#FFF5F8',
        primaryPink: '#F472B6',
        primaryPinkHover: '#EC4899',
        primaryPinkSoft: '#FCE7F3',
        primaryPinkLight: '#FBCFE8',
        primaryPinkBorder: '#F9A8D4',
        primaryPinkDark: '#DB2777',
        textPrimary: '#1F2937',
        textSecondary: '#6B7280',
        textMuted: '#9CA3AF',
        textOnPink: '#FFFFFF',
        textPinkStrong: '#BE185D',
        borderDefault: '#F3D4E3',
        borderSoft: '#FCE7F3',
        divider: '#F8E1EA',
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
