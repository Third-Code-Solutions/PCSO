"use client";

import dynamic from "next/dynamic";
import type { PayrollPeriod } from "@/lib/db/schema";
import type { PayrollRecordWithEmployee } from "@/app/(dashboard)/payroll/queries";
import type { SignatoryBlock } from "@/lib/utils/payroll/signatories";

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
  signatories?: SignatoryBlock[];
}

export function RegisterDownloadWrapper({
  period,
  records,
  signatories,
}: Props) {
  return (
    <RegisterDownloadButton
      period={period}
      records={records}
      signatories={signatories}
    />
  );
}
