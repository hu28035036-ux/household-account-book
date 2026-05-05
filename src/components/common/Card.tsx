import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'bg-cardBackground rounded-card shadow-card border border-borderDefault',
        'p-4 sm:p-5',
        className,
      )}
      {...rest}
    />
  );
}

export function CardTitle({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('text-base sm:text-lg font-semibold text-textPrimary', className)} {...rest} />;
}

export function CardSubtle({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('text-sm text-textSecondary', className)} {...rest} />;
}
