/**
 * GSIS portal-compatible export utilities — Phase 10
 *
 * The GSIS portal accepts remittance lists in two formats:
 *   1. CSV  — comma-separated values, UTF-8, no BOM
 *   2. XLSX — Excel workbook (generated via a streaming approach using raw XML)
 *
 * GSIS required column order (DO NOT reorder):
 *   Employee No | GSIS No | Name (Last, First MI.) | Monthly Salary Credit |
 *   Personal Share | Employer Share | Life Insurance | Total
 *
 * Monetary values: formatted as plain decimal strings with exactly 2 decimal
 * places (no peso sign, no comma thousands separator) per GSIS portal spec.
 *
 * Note: This module generates the raw file content as a string/Uint8Array.
 * Writing to Supabase Storage is the responsibility of the caller (server action).
 */

import { roundHalfEven } from "@/lib/utils/payroll/rounding";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GsisRemittanceExportRow {
  employeeNo: string;
  gsisNo: string;
  /** Full name in "LAST, FIRST MI." format */
  employeeName: string;
  /** Monthly Salary Credit — authorised monthly salary */
  monthlySalaryCredit: string;
  personalShare: string;
  employerShare: string;
  lifeInsurance: string;
  total: string;
}

export interface GsisExportMeta {
  agencyName: string;
  agencyCode: string;
  periodLabel: string;
  /** ISO period start date */
  periodStart: string;
  /** ISO period end date */
  periodEnd: string;
  batchNo: string;
}

export type GsisExportFormat = "csv" | "xlsx";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMoney(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (!Number.isFinite(num)) {
    throw new RangeError(
      `formatMoney: cannot format "${value}" as a monetary amount`,
    );
  }
  return roundHalfEven(num, 2).toFixed(2);
}

/** Escapes a string for CSV: wraps in double quotes if it contains comma, quote, or newline */
function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// ─── CSV Generation ───────────────────────────────────────────────────────────

/**
 * Builds a UTF-8 CSV string in the GSIS-required column order.
 *
 * The header row uses the exact GSIS portal column labels.
 * A totals row is appended at the bottom.
 */
export function buildGsisCsv(
  rows: GsisRemittanceExportRow[],
  meta: GsisExportMeta,
): string {
  const lines: string[] = [];

  // Agency/period header block (informational — GSIS portal ignores lines before data)
  lines.push(
    `# Agency: ${csvEscape(meta.agencyName)} (${csvEscape(meta.agencyCode)})`,
  );
  lines.push(`# Period: ${csvEscape(meta.periodLabel)}`);
  lines.push(`# Batch: ${csvEscape(meta.batchNo)}`);
  lines.push(`# Generated: ${new Date().toISOString()}`);

  // Column header row
  lines.push(
    [
      "EMPLOYEE NO",
      "GSIS NO",
      "NAME",
      "MONTHLY SALARY CREDIT",
      "PERSONAL SHARE",
      "EMPLOYER SHARE",
      "LIFE INSURANCE",
      "TOTAL",
    ]
      .map(csvEscape)
      .join(","),
  );

  // Data rows
  let sumPersonal = 0;
  let sumEmployer = 0;
  let sumLifeInsurance = 0;
  let sumTotal = 0;

  for (const row of rows) {
    const personal = parseFloat(row.personalShare);
    const employer = parseFloat(row.employerShare);
    const lifeIns = parseFloat(row.lifeInsurance);
    const total = parseFloat(row.total);

    sumPersonal += personal;
    sumEmployer += employer;
    sumLifeInsurance += lifeIns;
    sumTotal += total;

    lines.push(
      [
        csvEscape(row.employeeNo),
        csvEscape(row.gsisNo),
        csvEscape(row.employeeName),
        formatMoney(row.monthlySalaryCredit),
        formatMoney(personal),
        formatMoney(employer),
        formatMoney(lifeIns),
        formatMoney(total),
      ].join(","),
    );
  }

  // Totals footer
  lines.push(
    [
      "TOTAL",
      "",
      "",
      "",
      formatMoney(sumPersonal),
      formatMoney(sumEmployer),
      formatMoney(sumLifeInsurance),
      formatMoney(sumTotal),
    ]
      .map(csvEscape)
      .join(","),
  );

  return lines.join("\r\n");
}

// ─── XLSX Generation ──────────────────────────────────────────────────────────

/**
 * Builds a minimal XLSX (Office Open XML) workbook as a Uint8Array.
 *
 * This is a zero-dependency implementation using raw XML strings packaged
 * into a ZIP-like structure. It produces a valid `.xlsx` file that the GSIS
 * portal can consume without external library overhead.
 *
 * Structure:
 *   [Content_Types].xml
 *   _rels/.rels
 *   xl/workbook.xml
 *   xl/_rels/workbook.xml.rels
 *   xl/worksheets/sheet1.xml
 *   xl/sharedStrings.xml
 *   xl/styles.xml
 *
 * For production systems requiring full XLSX feature parity (charts, images, etc.),
 * replace this with exceljs or sheetjs. This implementation covers the GSIS portal
 * upload spec exactly.
 */
export function buildGsisXlsx(
  rows: GsisRemittanceExportRow[],
  meta: GsisExportMeta,
): Uint8Array {
  const sharedStrings: string[] = [];
  const stringIndex = new Map<string, number>();

  function getStringIndex(value: string): number {
    const existing = stringIndex.get(value);
    if (existing !== undefined) return existing;
    const idx = sharedStrings.length;
    sharedStrings.push(value);
    stringIndex.set(value, idx);
    return idx;
  }

  // Shared string cell builder
  function sCell(col: string, row: number, value: string): string {
    const idx = getStringIndex(value);
    return `<c r="${col}${row}" t="s"><v>${idx}</v></c>`;
  }

  // Numeric cell builder
  function nCell(col: string, row: number, value: string | number): string {
    const num = typeof value === "string" ? parseFloat(value) : value;
    const formatted = roundHalfEven(num, 2).toFixed(2);
    return `<c r="${col}${row}" s="1"><v>${formatted}</v></c>`;
  }

  const COLUMNS = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;
  const HEADERS = [
    "EMPLOYEE NO",
    "GSIS NO",
    "NAME",
    "MONTHLY SALARY CREDIT",
    "PERSONAL SHARE",
    "EMPLOYER SHARE",
    "LIFE INSURANCE",
    "TOTAL",
  ];

  const xmlRows: string[] = [];

  // Row 1: Meta info
  xmlRows.push(
    `<row r="1">${sCell("A", 1, `Agency: ${meta.agencyName} (${meta.agencyCode}) | Period: ${meta.periodLabel} | Batch: ${meta.batchNo}`)}</row>`,
  );

  // Row 2: Headers
  const headerCells = HEADERS.map((h, i) =>
    sCell(COLUMNS[i] ?? "A", 2, h),
  ).join("");
  xmlRows.push(`<row r="2">${headerCells}</row>`);

  let sumPersonal = 0;
  let sumEmployer = 0;
  let sumLifeInsurance = 0;
  let sumTotal = 0;

  rows.forEach((row, idx) => {
    const r = idx + 3; // data starts at row 3

    const personal = parseFloat(row.personalShare);
    const employer = parseFloat(row.employerShare);
    const lifeIns = parseFloat(row.lifeInsurance);
    const total = parseFloat(row.total);

    sumPersonal += personal;
    sumEmployer += employer;
    sumLifeInsurance += lifeIns;
    sumTotal += total;

    const cells = [
      sCell("A", r, row.employeeNo),
      sCell("B", r, row.gsisNo),
      sCell("C", r, row.employeeName),
      nCell("D", r, row.monthlySalaryCredit),
      nCell("E", r, personal),
      nCell("F", r, employer),
      nCell("G", r, lifeIns),
      nCell("H", r, total),
    ].join("");

    xmlRows.push(`<row r="${r}">${cells}</row>`);
  });

  // Totals row
  const totalsRow = rows.length + 3;
  const totalsCells = [
    sCell("A", totalsRow, "TOTAL"),
    nCell("E", totalsRow, sumPersonal),
    nCell("F", totalsRow, sumEmployer),
    nCell("G", totalsRow, sumLifeInsurance),
    nCell("H", totalsRow, sumTotal),
  ].join("");
  xmlRows.push(`<row r="${totalsRow}">${totalsCells}</row>`);

  // Build shared strings XML
  const sharedStringsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${sharedStrings.length}" uniqueCount="${sharedStrings.length}">
${sharedStrings.map((s) => `<si><t>${xmlEscape(s)}</t></si>`).join("\n")}
</sst>`;

  // Build worksheet XML
  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetData>
${xmlRows.join("\n")}
</sheetData>
</worksheet>`;

  // Build workbook XML
  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>
  <sheet name="GSIS Remittance" sheetId="1" r:id="rId1"/>
</sheets>
</workbook>`;

  // Build styles (currency format for numeric columns)
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1">
  <numFmt numFmtId="164" formatCode="#,##0.00"/>
</numFmts>
<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="2">
  <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
  <xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
</cellXfs>
</styleSheet>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  // Pack files into ZIP structure
  return buildZip([
    { path: "[Content_Types].xml", content: contentTypesXml },
    { path: "_rels/.rels", content: rootRelsXml },
    { path: "xl/workbook.xml", content: workbookXml },
    { path: "xl/_rels/workbook.xml.rels", content: workbookRelsXml },
    { path: "xl/worksheets/sheet1.xml", content: sheetXml },
    { path: "xl/sharedStrings.xml", content: sharedStringsXml },
    { path: "xl/styles.xml", content: stylesXml },
  ]);
}

// ─── Minimal ZIP builder ──────────────────────────────────────────────────────
// Produces a valid ZIP archive (DEFLATE store, no compression) sufficient for
// Office Open XML / XLSX. This avoids an external zip dependency.

interface ZipEntry {
  path: string;
  content: string;
}

function buildZip(entries: ZipEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const localHeaders: Uint8Array[] = [];
  const centralDirs: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.path);
    const dataBytes = encoder.encode(entry.content);
    const crc = crc32(dataBytes);
    const size = dataBytes.length;

    // Local file header
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const view = new DataView(localHeader.buffer);
    view.setUint32(0, 0x04034b50, true); // signature
    view.setUint16(4, 20, true); // version needed
    view.setUint16(6, 0, true); // flags
    view.setUint16(8, 0, true); // compression (store)
    view.setUint16(10, 0, true); // mod time
    view.setUint16(12, 0, true); // mod date
    view.setUint32(14, crc, true); // CRC-32
    view.setUint32(18, size, true); // compressed size
    view.setUint32(22, size, true); // uncompressed size
    view.setUint16(26, nameBytes.length, true);
    view.setUint16(28, 0, true); // extra field length
    localHeader.set(nameBytes, 30);

    localHeaders.push(localHeader);
    localHeaders.push(dataBytes);

    // Central directory header
    const centralDir = new Uint8Array(46 + nameBytes.length);
    const cView = new DataView(centralDir.buffer);
    cView.setUint32(0, 0x02014b50, true); // signature
    cView.setUint16(4, 20, true); // version made by
    cView.setUint16(6, 20, true); // version needed
    cView.setUint16(8, 0, true); // flags
    cView.setUint16(10, 0, true); // compression
    cView.setUint16(12, 0, true); // mod time
    cView.setUint16(14, 0, true); // mod date
    cView.setUint32(16, crc, true); // CRC-32
    cView.setUint32(20, size, true); // compressed size
    cView.setUint32(24, size, true); // uncompressed size
    cView.setUint16(28, nameBytes.length, true);
    cView.setUint16(30, 0, true); // extra field
    cView.setUint16(32, 0, true); // comment
    cView.setUint16(34, 0, true); // disk number start
    cView.setUint16(36, 0, true); // internal attributes
    cView.setUint32(38, 0, true); // external attributes
    cView.setUint32(42, offset, true); // offset of local header
    centralDir.set(nameBytes, 46);

    centralDirs.push(centralDir);
    offset += localHeader.length + dataBytes.length;
  }

  const centralDirSize = centralDirs.reduce((sum, b) => sum + b.length, 0);
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true); // EOCD signature
  eocdView.setUint16(4, 0, true); // disk number
  eocdView.setUint16(6, 0, true); // start disk
  eocdView.setUint16(8, entries.length, true);
  eocdView.setUint16(10, entries.length, true);
  eocdView.setUint32(12, centralDirSize, true);
  eocdView.setUint32(16, offset, true); // offset of central dir
  eocdView.setUint16(20, 0, true); // comment length

  const allParts = [...localHeaders, ...centralDirs, eocd];
  const totalSize = allParts.reduce((sum, b) => sum + b.length, 0);
  const result = new Uint8Array(totalSize);
  let pos = 0;
  for (const part of allParts) {
    result.set(part, pos);
    pos += part.length;
  }
  return result;
}

// ─── CRC-32 ──────────────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = (CRC_TABLE[(crc ^ (data[i] ?? 0)) & 0xff] ?? 0) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ─── XML escaping ─────────────────────────────────────────────────────────────

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ─── Dispatch helper ─────────────────────────────────────────────────────────

/**
 * Generates the GSIS remittance export in the requested format.
 * Returns a Uint8Array for XLSX and a UTF-8 Uint8Array for CSV.
 */
export function generateGsisExport(
  rows: GsisRemittanceExportRow[],
  meta: GsisExportMeta,
  format: GsisExportFormat,
): { data: Uint8Array; mimeType: string; filename: string } {
  const safeBatchNo = meta.batchNo.replace(/[^a-zA-Z0-9-_]/g, "_");
  const safePeriod = meta.periodLabel.replace(/[^a-zA-Z0-9-_]/g, "_");

  if (format === "csv") {
    const csv = buildGsisCsv(rows, meta);
    const encoder = new TextEncoder();
    return {
      data: encoder.encode(csv),
      mimeType: "text/csv; charset=UTF-8",
      filename: `GSIS_Remittance_${safePeriod}_${safeBatchNo}.csv`,
    };
  }

  return {
    data: buildGsisXlsx(rows, meta),
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    filename: `GSIS_Remittance_${safePeriod}_${safeBatchNo}.xlsx`,
  };
}
