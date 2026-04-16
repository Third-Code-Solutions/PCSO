/**
 * /performance/analytics/export — CSV download of performance analytics.
 *
 * Supports:
 *   ?type=office    → office breakdown (default)
 *   ?type=trend     → average rating per cycle
 *   ?type=ratings   → approved ratings roster for a period (?periodId=...)
 *
 * Requires the `performance:export` permission.
 */

import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guards';
import {
  getOfficePerformanceBreakdown,
  getRatingTrend,
  getRatingsByPeriod,
} from '../../queries';

export const dynamic = 'force-dynamic';

function toCsv(rows: Array<Record<string, string | number | null>>, headers: string[]): string {
  const escape = (value: string | number | null): string => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const head = headers.join(',');
  const body = rows
    .map((r) => headers.map((h) => escape(r[h] ?? '')).join(','))
    .join('\n');
  return `${head}\n${body}`;
}

export async function GET(request: Request): Promise<Response> {
  await requirePermission('performance', 'export');

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') ?? 'office';
  const periodId = searchParams.get('periodId') ?? undefined;

  const today = new Date().toISOString().slice(0, 10);

  if (type === 'trend') {
    const trend = await getRatingTrend();
    const csv = toCsv(
      trend.map((row) => ({
        periodLabel: row.periodLabel,
        totalRatings: row.totalRatings,
        averageRating: row.averageRating,
      })),
      ['periodLabel', 'totalRatings', 'averageRating'],
    );
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="performance-trend-${today}.csv"`,
      },
    });
  }

  if (type === 'ratings' && periodId) {
    const ratings = await getRatingsByPeriod(periodId);
    const csv = toCsv(
      ratings.map((r) => ({
        employeeNo: r.employeeNo,
        employeeName: r.employeeName,
        periodLabel: r.periodLabel,
        ratingType: r.ratingType,
        numericalRating: r.numericalRating,
        adjectivalRating: r.adjectivalRating,
        status: r.status,
      })),
      [
        'employeeNo',
        'employeeName',
        'periodLabel',
        'ratingType',
        'numericalRating',
        'adjectivalRating',
        'status',
      ],
    );
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="performance-ratings-${today}.csv"`,
      },
    });
  }

  // Default: office breakdown
  const breakdown = await getOfficePerformanceBreakdown(periodId);
  const csv = toCsv(
    breakdown.map((row) => ({
      officeName: row.officeName,
      totalRatings: row.totalRatings,
      averageRating: row.averageRating,
      outstanding: row.outstanding,
      verySatisfactory: row.verySatisfactory,
      satisfactory: row.satisfactory,
      belowSatisfactory: row.belowSatisfactory,
    })),
    [
      'officeName',
      'totalRatings',
      'averageRating',
      'outstanding',
      'verySatisfactory',
      'satisfactory',
      'belowSatisfactory',
    ],
  );
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="performance-office-${today}.csv"`,
    },
  });
}
