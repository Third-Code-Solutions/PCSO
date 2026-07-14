import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { payrollPeriods, payrollRecords } from "@/lib/db/schema";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { requirePermission } from "@/lib/auth/guards";
import { auditLog } from "@/lib/audit";
import { format as dateFnsFormat } from "date-fns";

export const dynamic = "force-dynamic";

/**
 * GET /api/payroll/journal-entries?periodId={uuid}&format={json|csv}
 *
 * Exports payroll journal entries for PCSO Computerized Accounting System (PAY-015).
 *
 * Journal Entry Structure:
 * - Debit: Personnel Services (total gross pay)
 * - Credit: Due to BIR (total withholding tax)
 * - Credit: Due to GSIS (total GSIS employee + employer)
 * - Credit: Due to PhilHealth (total PhilHealth employee + employer)
 * - Credit: Due to Pag-IBIG (total Pag-IBIG employee + employer)
 * - Credit: Cash (total net pay)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission("payroll", "export");

    const { searchParams } = new URL(request.url);
    const periodId = searchParams.get("periodId");
    const outputFormat = searchParams.get("format") || "json";

    if (!periodId) {
      return NextResponse.json(
        { error: "Missing required parameter: periodId" },
        { status: 400 },
      );
    }

    if (!["json", "csv"].includes(outputFormat)) {
      return NextResponse.json(
        { error: "Invalid format. Use json or csv." },
        { status: 400 },
      );
    }

    // Fetch period
    const [period] = await db
      .select()
      .from(payrollPeriods)
      .where(
        and(eq(payrollPeriods.id, periodId), isNull(payrollPeriods.deletedAt)),
      )
      .limit(1);

    if (!period) {
      return NextResponse.json(
        { error: "Payroll period not found" },
        { status: 404 },
      );
    }

    // Only allow export for approved or paid periods
    if (!["approved", "paid"].includes(period.status)) {
      return NextResponse.json(
        {
          error:
            "Journal entries can only be exported for approved or paid periods",
        },
        { status: 400 },
      );
    }

    // Fetch all payroll records for aggregation
    const records = await db
      .select()
      .from(payrollRecords)
      .where(
        and(
          eq(payrollRecords.periodId, periodId),
          inArray(payrollRecords.status, ["approved", "paid"]),
          // TOR 1.8.4: excluded (PAY-013) records are not part of the
          // accounting journal — they were never disbursed.
          eq(payrollRecords.included, true),
        ),
      );

    if (records.length === 0) {
      return NextResponse.json(
        { error: "No approved payroll records found for this period" },
        { status: 404 },
      );
    }

    // Aggregate totals
    let totalGrossPay = 0;
    let totalWithholdingTax = 0;
    let totalGSIS = 0; // employee + employer
    let totalPhilHealth = 0; // employee + employer
    let totalPagIBIG = 0; // employee + employer
    let totalNetPay = 0;

    for (const record of records) {
      totalGrossPay += parseFloat(record.grossPay);
      totalWithholdingTax += parseFloat(record.withholdingTax);
      totalGSIS +=
        parseFloat(record.gsisPersonal) +
        parseFloat(record.gsisEmployer) +
        parseFloat(record.gsisLifeInsurance);
      totalPhilHealth +=
        parseFloat(record.philhealthPersonal) +
        parseFloat(record.philhealthEmployer);
      totalPagIBIG +=
        parseFloat(record.pagibigPersonal) + parseFloat(record.pagibigEmployer);
      totalNetPay += parseFloat(record.netPay);
    }

    // Build journal entries
    const journalEntries = [
      {
        account: "Personnel Services",
        type: "Debit",
        amount: totalGrossPay.toFixed(2),
        reference: period.name,
        date: dateFnsFormat(new Date(period.payDate), "yyyy-MM-dd"),
      },
      {
        account: "Due to BIR",
        type: "Credit",
        amount: totalWithholdingTax.toFixed(2),
        reference: period.name,
        date: dateFnsFormat(new Date(period.payDate), "yyyy-MM-dd"),
      },
      {
        account: "Due to GSIS",
        type: "Credit",
        amount: totalGSIS.toFixed(2),
        reference: period.name,
        date: dateFnsFormat(new Date(period.payDate), "yyyy-MM-dd"),
      },
      {
        account: "Due to PhilHealth",
        type: "Credit",
        amount: totalPhilHealth.toFixed(2),
        reference: period.name,
        date: dateFnsFormat(new Date(period.payDate), "yyyy-MM-dd"),
      },
      {
        account: "Due to Pag-IBIG",
        type: "Credit",
        amount: totalPagIBIG.toFixed(2),
        reference: period.name,
        date: dateFnsFormat(new Date(period.payDate), "yyyy-MM-dd"),
      },
      {
        account: "Cash",
        type: "Credit",
        amount: totalNetPay.toFixed(2),
        reference: period.name,
        date: dateFnsFormat(new Date(period.payDate), "yyyy-MM-dd"),
      },
    ];

    // Audit log
    void auditLog({
      userId: user.id,
      action: "export",
      table: "payroll_periods",
      recordId: periodId,
      newValues: {
        target: "journal_entries",
        format: outputFormat,
        totalGrossPay: totalGrossPay.toFixed(2),
        totalNetPay: totalNetPay.toFixed(2),
      },
    });

    // Return JSON or CSV based on format
    if (outputFormat === "csv") {
      const csvHeader = "Account,Type,Amount,Reference,Date";
      const csvRows = journalEntries.map(
        (entry) =>
          `"${entry.account}",${entry.type},${entry.amount},"${entry.reference}",${entry.date}`,
      );
      const csvContent = [csvHeader, ...csvRows].join("\n");

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="journal_entries_${period.name.replace(/\s+/g, "_")}.csv"`,
        },
      });
    }

    // JSON format
    return NextResponse.json({
      periodId: period.id,
      periodName: period.name,
      payDate: period.payDate,
      journalEntries,
      summary: {
        totalDebit: totalGrossPay.toFixed(2),
        totalCredit: (
          totalWithholdingTax +
          totalGSIS +
          totalPhilHealth +
          totalPagIBIG +
          totalNetPay
        ).toFixed(2),
      },
    });
  } catch (error) {
    console.error("Journal entries export error:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
