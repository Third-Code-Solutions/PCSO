'use client';

import { Users, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OrgNodeData {
  id: string;
  name: string;
  code: string;
  type: string;
  headEmployeeName: string | null;
  memberCount: number;
  totalPositions: number;
  filledPositions: number;
}

interface OrgNodeProps {
  node: OrgNodeData;
  isSelected: boolean;
  onClick: (node: OrgNodeData) => void;
}

// ---------------------------------------------------------------------------
// Office type colors
// ---------------------------------------------------------------------------

const TYPE_STYLES: Record<string, string> = {
  committee: 'border-senate-gold bg-senate-gold/10',
  department: 'border-senate-navy bg-senate-navy/10',
  office: 'border-blue-500 bg-blue-50',
  division: 'border-emerald-500 bg-emerald-50',
  section: 'border-slate-400 bg-slate-50',
};

const TYPE_LABELS: Record<string, string> = {
  committee: 'Committee',
  department: 'Department',
  office: 'Office',
  division: 'Division',
  section: 'Section',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OrgNode({ node, isSelected, onClick }: OrgNodeProps) {
  const typeStyle = TYPE_STYLES[node.type] ?? 'border-slate-400 bg-slate-50';
  const typeLabel = TYPE_LABELS[node.type] ?? node.type;
  const fillRate =
    node.totalPositions > 0
      ? Math.round((node.filledPositions / node.totalPositions) * 100)
      : 0;

  return (
    <button
      type="button"
      onClick={() => onClick(node)}
      className={cn(
        'group relative flex flex-col items-start gap-1.5 rounded-lg border-2 bg-card px-4 py-3 text-left',
        'shadow-sm transition-all duration-150',
        'hover:shadow-md hover:-translate-y-0.5',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'min-w-[160px] max-w-[200px]',
        typeStyle,
        isSelected && 'ring-2 ring-ring ring-offset-2',
      )}
    >
      {/* Type badge */}
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {typeLabel}
      </span>

      {/* Office name */}
      <span className="text-sm font-semibold leading-tight text-foreground line-clamp-2">
        {node.name}
      </span>

      {/* Code */}
      <span className="font-mono text-[11px] text-muted-foreground">{node.code}</span>

      {/* Stats row */}
      <div className="flex w-full items-center gap-2 pt-1 border-t border-border/50 mt-0.5">
        <Users className="h-3 w-3 text-muted-foreground shrink-0" />
        <span className="text-xs text-muted-foreground">{node.memberCount} members</span>
        {node.totalPositions > 0 && (
          <>
            <span className="text-muted-foreground/40 text-xs">·</span>
            <span
              className={cn(
                'text-xs font-medium',
                fillRate >= 80
                  ? 'text-emerald-600'
                  : fillRate >= 50
                    ? 'text-amber-600'
                    : 'text-rose-600',
              )}
            >
              {fillRate}% filled
            </span>
          </>
        )}
      </div>

      {/* Head employee */}
      {node.headEmployeeName && (
        <div className="text-[11px] text-muted-foreground truncate w-full">
          Head: {node.headEmployeeName}
        </div>
      )}

      {/* Hover arrow */}
      <ChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}
