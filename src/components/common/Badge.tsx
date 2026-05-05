import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

type Tone = 'pink' | 'success' | 'warning' | 'danger' | 'info' | 'muted' | 'duplicate' | 'review';

const TONE: Record<Tone, string> = {
  pink: 'bg-primaryPinkSoft text-textPinkStrong',
  success: 'bg-successSoft text-success',
  warning: 'bg-warningSoft text-warning',
  danger: 'bg-dangerSoft text-danger',
  info: 'bg-infoSoft text-info',
  muted: 'bg-sectionBackground text-textSecondary',
  duplicate: 'bg-duplicateWarningBg text-duplicateWarningText',
  review: 'bg-needsReviewBg text-needsReviewText',
};

type Props = HTMLAttributes<HTMLSpanElement> & { tone?: Tone };

export function Badge({ tone = 'pink', className, ...rest }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full',
        TONE[tone],
        className,
      )}
      {...rest}
    />
  );
}
