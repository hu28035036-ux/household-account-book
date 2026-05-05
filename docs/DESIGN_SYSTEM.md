# DESIGN_SYSTEM

## 컨셉
화이트 + 밝고 부드러운 핑크의 SaaS/금융 대시보드. 핑크는 강조에만, 배경은 밝게. 위험·경고는 핑크와 충돌하지 않는 별도 색상.

## 색상 토큰 (Tailwind theme.extend.colors 권장)

### 배경
| 토큰 | HEX |
|---|---|
| appBackground | `#FFF7FA` |
| pageBackground | `#FFFFFF` |
| softPinkBackground | `#FFF1F5` |
| cardBackground | `#FFFFFF` |
| sectionBackground | `#FFF5F8` |

### 핑크 포인트
| 토큰 | HEX |
|---|---|
| primaryPink | `#F472B6` |
| primaryPinkHover | `#EC4899` |
| primaryPinkSoft | `#FCE7F3` |
| primaryPinkLight | `#FBCFE8` |
| primaryPinkBorder | `#F9A8D4` |
| primaryPinkDark | `#DB2777` |

### 텍스트
| 토큰 | HEX |
|---|---|
| textPrimary | `#1F2937` |
| textSecondary | `#6B7280` |
| textMuted | `#9CA3AF` |
| textOnPink | `#FFFFFF` |
| textPinkStrong | `#BE185D` |

### 테두리
| 토큰 | HEX |
|---|---|
| borderDefault | `#F3D4E3` |
| borderSoft | `#FCE7F3` |
| divider | `#F8E1EA` |

### 상태
| 토큰 | HEX |
|---|---|
| success | `#10B981` |
| successSoft | `#D1FAE5` |
| warning | `#F59E0B` |
| warningSoft | `#FEF3C7` |
| danger | `#EF4444` |
| dangerSoft | `#FEE2E2` |
| info | `#60A5FA` |
| infoSoft | `#DBEAFE` |

### 거래 유형
| 토큰 | HEX |
|---|---|
| income | `#10B981` |
| incomeSoft | `#D1FAE5` |
| expense | `#EC4899` |
| expenseSoft | `#FCE7F3` |
| transfer | `#60A5FA` |
| transferSoft | `#DBEAFE` |

### 중복/확인 필요
| 토큰 | HEX |
|---|---|
| duplicateWarningBg | `#FEF3C7` |
| duplicateWarningText | `#92400E` |
| needsReviewBg | `#FEE2E2` |
| needsReviewText | `#991B1B` |

## 적용 원칙
1. 전체 배경 `#FFF7FA` 또는 `#FFFFFF`.
2. 카드 배경 `#FFFFFF`, 테두리 `#F3D4E3` 또는 `#FCE7F3`.
3. CTA 버튼 `#F472B6`, hover `#EC4899`, 텍스트 `#FFFFFF`.
4. 강조 배지: `#FCE7F3` 배경 + `#BE185D` 텍스트.
5. 지출 금액은 expense 핑크, 수입은 success 그린, 이체는 info 블루.
6. 오류/삭제/위험은 반드시 danger 빨강. 핑크와 혼동 금지.
7. 경고/중복 의심은 warning 노랑. needsReview는 빨강 톤(라이트).
8. 텍스트 대비: 본문은 `#1F2937` 또는 `#6B7280`, `#9CA3AF`는 보조 정보에만.
9. 핑크 과사용 금지. 배경은 밝게, 강조만 핑크.

## 타이포그래피
- 본문: `Pretendard` 또는 `Noto Sans KR` (웹폰트). fallback: system-ui, -apple-system, sans-serif.
- 숫자(금액): tabular-nums + `font-feature-settings: "tnum"` 으로 정렬 안정.
- 크기 스케일: 12 / 14 / 16 / 18 / 20 / 24 / 32.
- 본문 16, 보조 14, 라벨 12, 카드 타이틀 18, 페이지 타이틀 24~32.

## 간격/레이아웃
- spacing scale: 4 / 8 / 12 / 16 / 20 / 24 / 32 / 48.
- 카드 패딩 16~24, 카드 간 갭 16.
- 컨테이너 max-width: 1280 (xl).

## 라운딩 / 그림자
- radius: 8(작은 컨트롤), 12(카드), 16(모달), 9999(pill 배지/버튼).
- 그림자: 가볍게. 카드는 `0 1px 2px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.06)`.

## 컴포넌트 토큰 (예시)
- Button primary: bg `primaryPink`, text `textOnPink`, hover `primaryPinkHover`.
- Button secondary: bg `white`, border `primaryPinkBorder`, text `textPinkStrong`.
- Button danger: bg `danger`, text `white`, hover 더 진한 빨강.
- Badge default: bg `primaryPinkSoft`, text `textPinkStrong`.
- Badge warning: bg `duplicateWarningBg`, text `duplicateWarningText`.
- Badge needsReview: bg `needsReviewBg`, text `needsReviewText`.

## 아이콘
- lucide-react 권장. stroke 1.5.
- 카테고리 아이콘은 카테고리 테이블의 `icon` 컬럼에 키 저장(예: `coffee`, `cart`, `bus`).

## 다크모드
- 1차 MVP에서는 라이트 only. 다크모드 토큰은 향후 확장.

## Tailwind 적용 예시 (tailwind.config.ts)
```ts
import type { Config } from 'tailwindcss';
const config: Config = {
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
    },
  },
};
export default config;
```
