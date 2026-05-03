import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guards";
import { getRegisterData } from "@/app/(dashboard)/payroll/queries";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ periodId: string }>;
}

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    await requirePermission("payroll", "export");

    const { periodId } = await context.params;
    const data = await getRegisterData(periodId);

    if (!data) {
      return NextResponse.json(
        { error: "Payroll period not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    const status =
      err instanceof Error && "status" in err && err.status === 403 ? 403 : 500;
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status });
  }
}
