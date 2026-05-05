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
  secondary: 'bg-white text-textPinkStrong border border-primaryPinkBorder hover:bg-primaryPinkSoft focus-visible:ring-primaryPinkBorder',
  ghost: 'bg-transparent text-textPrimary hover:bg-softPinkBackground focus-visible:ring-borderDefault',
  danger: 'bg-danger text-white hover:bg-red-600 focus-visible:ring-danger',
};

const SIZE: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm rounded-md',
  md: 'h-11 px-4 text-sm rounded-lg',
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
