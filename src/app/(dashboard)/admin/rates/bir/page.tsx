import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import { birTaxTables } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { PageHeader } from '@/components/layouts/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { BirTaxTableForm } from './form';

export const metadata: Metadata = { title: 'BIR Tax Tables — Admin' };

interface BirGroup {
  effectiveDate: string;
  periodType: string;
  isCurrent: boolean;
  brackets: {
    id: string;
    bracketFrom: string;
    bracketTo: string | null;
    baseTax: string;
    excessRate: string;
  }[];
}

async function getBirHistory(): Promise<BirGroup[]> {
  const rows = await db
    .select()
    .from(birTaxTables)
    .orderBy(desc(birTaxTables.effectiveDate), birTaxTables.periodType, birTaxTables.bracketFrom);

  const today = new Date().toISOString().slice(0, 10);

  // Group by effectiveDate + periodType
  const groupMap = new Map<string, BirGroup>();
  const currentDatePerType = new Map<string, string>();

  for (const row of rows) {
    const key = `${row.effectiveDate}::${row.periodType}`;
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        effectiveDate: row.effectiveDate,
        periodType: row.periodType,
        isCurrent: false,
        brackets: [],
      });
      if (row.effectiveDate <= today && !currentDatePerType.has(row.periodType)) {
        currentDatePerType.set(row.periodType, row.effectiveDate);
      }
    }
    const group = groupMap.get(key)!;
    group.brackets.push({
      id: row.id,
      bracketFrom: row.bracketFrom,
      bracketTo: row.bracketTo ?? null,
      baseTax: row.baseTax,
      excessRate: row.excessRate,
    });
  }

  // Mark current rows
  for (const group of groupMap.values()) {
    const current = currentDatePerType.get(group.periodType);
    if (current === group.effectiveDate) {
      group.isCurrent = true;
    }
  }

  return Array.from(groupMap.values());
}

function formatMoney(val: string): string {
  const num = parseFloat(val);
  return isNaN(num)
    ? val
    : `₱${num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPercent(val: string): string {
  const num = parseFloat(val);
  return isNaN(num) ? val : `${(num * 100).toFixed(2)}%`;
}

export default async function BirRatePage() {
  await requirePermission('admin', 'view');
  const history = await getBirHistory();

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="BIR TRAIN Tax Tables"
        description="Bureau of Internal Revenue withholding tax brackets under the Tax Reform for Acceleration and Inclusion (TRAIN) Law. Each update inserts a new effective-date set."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Admin', href: '/admin' },
          { label: 'Rates', href: '/admin/rates' },
          { label: 'BIR' },
        ]}
      />

      <BirTaxTableForm />

      {/* History */}
      {history.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-base font-semibold">Tax Table History</h2>
          {history.map((group) => (
            <Card key={`${group.effectiveDate}::${group.periodType}`}>
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <CardTitle className="text-sm font-semibold">
                  Effective{' '}
                  {new Date(group.effectiveDate + 'T00:00:00').toLocaleDateString('en-PH', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}{' '}
                  — {group.periodType === 'semi_monthly' ? 'Semi-Monthly' : 'Monthly'}
                </CardTitle>
                {group.isCurrent && (
                  <Badge className="bg-senate-gold text-senate-navy text-xs hover:bg-senate-gold">
                    Current
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bracket From</TableHead>
                      <TableHead>Bracket To</TableHead>
                      <TableHead className="text-right">Base Tax</TableHead>
                      <TableHead className="text-right">Excess Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.brackets.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell className="font-mono text-sm">{formatMoney(b.bracketFrom)}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {b.bracketTo ? formatMoney(b.bracketTo) : 'No limit'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">{formatMoney(b.baseTax)}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{formatPercent(b.excessRate)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
