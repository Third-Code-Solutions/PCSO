import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/guards';
import { auditLog } from '@/lib/audit';
import { PlantillaListParamsSchema } from '@/lib/validations/plantilla';

export const runtime = 'nodejs';

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(request: NextRequest) {
  const user = await requirePermission('plantilla', 'view');

  const params = request.nextUrl.searchParams;
  const parsed = PlantillaListParamsSchema.safeParse({
    page: params.get('page') ?? undefined,
    perPage: params.get('perPage') ?? undefined,
    search: params.get('search') ?? undefined,
    officeId: params.get('officeId') ?? undefined,
    salaryGrade: params.get('salaryGrade') ?? undefined,
    status: params.get('status') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query parameters', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { search, officeId, salaryGrade, status } = parsed.data;
  const supabase = await createServerClient();

  let query = supabase
    .from('plantilla_positions')
    .select(
      `
      item_no,
      position_title,
      salary_grade,
      authorized_salary,
      is_filled,
      offices!inner(name, code),
      employees(employee_no, first_name, last_name)
    `,
    )
    .is('deleted_at', null)
    .order('item_no', { ascending: true })
    .limit(10_000);

  if (officeId) query = query.eq('office_id', officeId);
  if (salaryGrade) query = query.eq('salary_grade', salaryGrade);
  if (status === 'filled') query = query.eq('is_filled', true);
  else if (status === 'vacant') query = query.eq('is_filled', false);
  if (search) {
    query = query.or(
      `position_title.ilike.%${search}%,item_no.ilike.%${search}%`,
    );
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const header = [
    'Item No.',
    'Position Title',
    'Salary Grade',
    'Authorized Salary',
    'Office',
    'Office Code',
    'Status',
    'Incumbent No.',
    'Incumbent Name',
  ];

  const lines: string[] = [header.map(csvCell).join(',')];

  for (const row of data ?? []) {
    const office = Array.isArray(row.offices) ? row.offices[0] : row.offices;
    const employee = Array.isArray(row.employees) ? row.employees[0] : row.employees;
    const empName = employee
      ? `${(employee as { first_name: string }).first_name} ${(employee as { last_name: string }).last_name}`
      : '';
    const empNo = employee ? (employee as { employee_no: string }).employee_no : '';
    lines.push(
      [
        row.item_no,
        row.position_title,
        `SG-${row.salary_grade}`,
        row.authorized_salary,
        (office as { name: string } | null)?.name ?? '',
        (office as { code: string } | null)?.code ?? '',
        row.is_filled ? 'Filled' : 'Vacant',
        empNo,
        empName,
      ]
        .map(csvCell)
        .join(','),
    );
  }

  const body = '\uFEFF' + lines.join('\n');
  const stamp = new Date().toISOString().slice(0, 10);

  await auditLog({
    userId: user.id,
    action: 'export',
    table: 'plantilla_positions',
    recordId: 'bulk',
    newValues: {
      exportedRows: data?.length ?? 0,
      filters: { search, officeId, salaryGrade, status },
    },
  });

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="plantilla-positions-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
