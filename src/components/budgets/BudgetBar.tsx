import { cn } from '@/lib/utils/cn';
import { formatKRW } from '@/lib/formatting/money';

type Props = {
  name: string;
  color?: string | null;
  spent: number;
  budget: number;
  percent: number;
  status: 'safe' | 'caution' | 'over';
  alertThreshold?: number;
};

const STATUS_TEXT: Record<Props['status'], string> = {
  safe: '안전',
  caution: '주의',
  over: '초과',
};

const STATUS_BAR: Record<Props['status'], string> = {
  safe: 'bg-success',
  caution: 'bg-warning',
  over: 'bg-danger',
};
const STATUS_BADGE: Record<Props['status'], string> = {
  safe: 'bg-successSoft text-success',
  caution: 'bg-warningSoft text-warning',
  over: 'bg-dangerSoft text-danger',
};

export function BudgetBar({ name, color, spent, budget, percent, status }: Props) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {color && (
            <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
          )}
          <span className="text-sm text-textPrimary truncate">{name}</span>
        </div>
        <div className="flex items-center gap-2 whitespace-nowrap">
          <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_BADGE[status])}>
            {STATUS_TEXT[status]} {percent}%
          </span>
        </div>
      </div>
      <div className="mt-1 h-2 rounded-full bg-borderSoft overflow-hidden">
        <div
          className={cn('h-full transition-[width]', STATUS_BAR[status])}
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
      <div className="mt-1 flex items-center justify-between text-xs text-textSecondary tabular">
        <span>{formatKRW(spent)}</span>
        <span>{formatKRW(budget)}</span>
      </div>
    </div>
  );
}
