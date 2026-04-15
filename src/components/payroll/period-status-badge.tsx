import { Badge } from '@/components/ui/badge';
import type { PayrollPeriodStatus } from '@/lib/db/schema';

interface PeriodStatusBadgeProps {
  status: PayrollPeriodStatus;
  className?: string;
}

const STATUS_CONFIG: Record<
  PayrollPeriodStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  draft: { label: 'Draft', variant: 'secondary' },
  processing: { label: 'Processing', variant: 'default' },
  approved: { label: 'Approved', variant: 'outline' },
  paid: { label: 'Paid', variant: 'default' },
};

export function PeriodStatusBadge({ status, className }: PeriodStatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  // Override colors with senate branding
  const colorClass =
    status === 'draft'
      ? 'bg-muted text-muted-foreground border-border'
      : status === 'processing'
        ? 'bg-[#0B2545] text-white border-[#0B2545]'
        : status === 'approved'
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
          : 'bg-[#C8A84B] text-white border-[#C8A84B]'; // paid = gold

  return (
    <Badge variant={config.variant} className={`${colorClass} ${className ?? ''}`}>
      {config.label}
    </Badge>
  );
}
