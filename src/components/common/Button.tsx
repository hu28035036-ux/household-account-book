import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
};

const VARIANT: Record<Variant, string> = {
  primary: 'bg-primaryPink text-textOnPink hover:bg-primaryPinkHover focus-visible:ring-primaryPinkHover',
  secondary: 'bg-pageBackground text-textPinkStrong border border-primaryPinkBorder hover:bg-primaryPinkSoft focus-visible:ring-primaryPinkBorder',
  ghost: 'bg-transparent text-textPrimary hover:bg-softPinkBackground focus-visible:ring-borderDefault',
  danger: 'bg-danger text-white hover:bg-red-600 focus-visible:ring-danger',
};

// 사이즈별 실제 픽셀·타이포 — 코드에서 size="..." 한 줄만 보고도 크기를 알 수 있게 명시.
const SIZE: Record<Size, string> = {
  // sm = height 36px / paddingX 12px / font 14px / radius 6px
  //  → 액션바 (분석 후보·거래 일괄선택), 행 인라인 액션
  sm: 'h-9 px-3 text-sm rounded-md',
  // md = height 44px / paddingX 16px / font 14px / radius 8px
  //  → 표준 폼 / 페이지 CTA (default)
  md: 'h-11 px-4 text-sm rounded-lg',
  // lg = height 48px / paddingX 20px / font 16px / radius 8px
  //  → 모바일 풀폭, 회원가입·로그인 같은 강조 액션
  lg: 'h-12 px-5 text-base rounded-lg',
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', size = 'md', fullWidth, className, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-pageBackground',
        'disabled:opacity-50 disabled:pointer-events-none',
        VARIANT[variant],
        SIZE[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    />
  );
});
