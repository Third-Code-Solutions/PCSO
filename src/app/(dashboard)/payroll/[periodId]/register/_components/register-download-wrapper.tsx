"use client";

import dynamic from "next/dynamic";
import type { PayrollPeriod } from "@/lib/db/schema";
import type { PayrollRecordWithEmployee } from "@/app/(dashboard)/payroll/queries";

const RegisterDownloadButton = dynamic(
  () =>
    import("./register-download-button").then((m) => ({
      default: m.RegisterDownloadButton,
    })),
  { ssr: false, loading: () => null },
);

interface Props {
  period: PayrollPeriod;
  records: PayrollRecordWithEmployee[];
}

export function RegisterDownloadWrapper({ period, records }: Props) {
  return <RegisterDownloadButton period={period} records={records} />;
}
