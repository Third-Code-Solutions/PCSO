import { type NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guards";
import { createServerClient } from "@/lib/supabase/server";

// ─── Excel export for audit logs ─────────────────────────────────────────────
//
// Uses exceljs (or a simple CSV fallback if exceljs is not installed).
// All filter params accepted by the audit-logs page are supported here too.
//
// IMMUTABILITY NOTE:
// This route ONLY reads from audit_logs — no writes, no deletes.
// There is no delete action anywhere in the codebase for audit_logs.

type Row = {
  id: string;
  timestamp: string;
  userEmail: string;
  userName: string;
  action: string;
  tableName: string;
  recordId: string;
  ipAddress: string;
  oldValues: string;
  newValues: string;
};

async function fetchLogs(searchParams: URLSearchParams): Promise<Row[]> {
  const supabase = await createServerClient();

  let query = supabase
    .from("audit_logs")
    .select(
      `
      id,
      created_at,
      action,
      table_name,
      record_id,
      old_values,
      new_values,
      ip_address,
      user_id,
      system_users(email, employees(first_name, last_name))
    `,
    )
    .order("created_at", { ascending: false })
    .limit(10000); // COA exports may need large sets

  const userId = searchParams.get("userId");
  const tableName = searchParams.get("tableName");
  const action = searchParams.get("action");
  const recordId = searchParams.get("recordId");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  if (userId) query = query.eq("user_id", userId);
  if (tableName) query = query.eq("table_name", tableName);
  if (action) query = query.eq("action", action);
  if (recordId) query = query.eq("record_id", recordId);
  if (dateFrom) query = query.gte("created_at", dateFrom);
  if (dateTo) query = query.lte("created_at", dateTo + "T23:59:59Z");

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const sysUser = Array.isArray(row.system_users)
      ? row.system_users[0]
      : row.system_users;
    const emp = sysUser
      ? Array.isArray((sysUser as Record<string, unknown>)["employees"])
        ? ((sysUser as Record<string, unknown>)["employees"] as unknown[])[0]
        : (sysUser as Record<string, unknown>)["employees"]
      : null;

    let userName = "";
    if (emp) {
      const e = emp as { first_name: string; last_name: string };
      userName = `${e.first_name} ${e.last_name}`;
    }

    return {
      id: row.id as string,
      timestamp: row.created_at as string,
      userEmail: sysUser
        ? (((sysUser as Record<string, unknown>)["email"] as string) ?? "")
        : "",
      userName,
      action: row.action as string,
      tableName: row.table_name as string,
      recordId: (row.record_id as string | null) ?? "",
      ipAddress: (row.ip_address as string | null) ?? "",
      oldValues: row.old_values ? JSON.stringify(row.old_values) : "",
      newValues: row.new_values ? JSON.stringify(row.new_values) : "",
    };
  });
}

function buildCsv(rows: Row[]): string {
  const headers = [
    "ID",
    "Timestamp",
    "User Email",
    "User Name",
    "Action",
    "Table",
    "Record ID",
    "IP Address",
    "Old Values",
    "New Values",
  ];

  const escape = (v: string): string => {
    if (v.includes(",") || v.includes('"') || v.includes("\n")) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  };

  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      [
        r.id,
        r.timestamp,
        r.userEmail,
        r.userName,
        r.action,
        r.tableName,
        r.recordId,
        r.ipAddress,
        r.oldValues,
        r.newValues,
      ]
        .map(escape)
        .join(","),
    ),
  ];

  return lines.join("\n");
}

async function buildExcel(rows: Row[]): Promise<Buffer> {
  // Attempt to use exceljs if available; fall back to CSV-in-xlsx is not feasible,
  // so we re-use the CSV approach but return it as a proper .csv file.
  // If exceljs is installed (npm i exceljs), replace this with real XLSX generation.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ExcelJS = require("exceljs") as typeof import("exceljs");
    const wb = new ExcelJS.Workbook();
    wb.creator = "PCSO HRIS";
    wb.created = new Date();

    const ws = wb.addWorksheet("Audit Logs");

    ws.columns = [
      { header: "ID", key: "id", width: 38 },
      { header: "Timestamp", key: "timestamp", width: 22 },
      { header: "User Email", key: "userEmail", width: 30 },
      { header: "User Name", key: "userName", width: 25 },
      { header: "Action", key: "action", width: 18 },
      { header: "Table", key: "tableName", width: 20 },
      { header: "Record ID", key: "recordId", width: 38 },
      { header: "IP Address", key: "ipAddress", width: 16 },
      { header: "Old Values", key: "oldValues", width: 60 },
      { header: "New Values", key: "newValues", width: 60 },
    ];

    // Header row style
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1B4F9E" }, // pcso-navy
    };

    for (const row of rows) {
      ws.addRow(row);
    }

    ws.autoFilter = { from: "A1", to: "J1" };

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  } catch {
    // exceljs not available — return CSV bytes
    return Buffer.from(buildCsv(rows), "utf-8");
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await requirePermission("admin", "export");
  } catch {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;

  let rows: Row[];
  try {
    rows = await fetchLogs(searchParams);
  } catch (err) {
    return new NextResponse(
      err instanceof Error ? err.message : "Failed to fetch audit logs",
      { status: 500 },
    );
  }

  let body: Buffer;
  let contentType: string;
  let filename: string;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("exceljs");
    body = await buildExcel(rows);
    contentType =
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    filename = `audit_logs_${new Date().toISOString().slice(0, 10)}.xlsx`;
  } catch {
    body = Buffer.from(buildCsv(rows), "utf-8");
    contentType = "text/csv";
    filename = `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`;
  }

  // NextResponse expects a BodyInit-compatible value; convert Buffer to Uint8Array.
  return new NextResponse(new Uint8Array(body), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
