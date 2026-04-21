/**
 * BIR Compliance Hub — Landing Page
 * Links to the three BIR forms: 1601-C, 2316, 1604-C.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layouts/page-header";

export const metadata: Metadata = {
  title: "BIR Compliance — PCSO HRIS",
};

const BIR_FORMS = [
  {
    code: "1601-C",
    title: "Monthly Remittance",
    subtitle:
      "Monthly Remittance Return of Income Taxes Withheld on Compensation",
    href: "/remittances/bir/1601-c",
    deadline: "10th of following month",
    frequency: "Monthly",
    description:
      "Remit income taxes withheld from employee salaries. Filed every month after payroll processing. Use this to generate the 1601-C return and track monthly BIR payments.",
    color: "border-l-red-600",
    badge: "bg-red-100 text-red-700",
  },
  {
    code: "2316",
    title: "Employee Tax Certificate",
    subtitle: "Certificate of Compensation Payment / Tax Withheld",
    href: "/remittances/bir/2316",
    deadline: "January 31 of following year",
    frequency: "Annual (per employee)",
    description:
      "Year-end certificate issued to each employee showing their total compensation, non-taxable income, and taxes withheld for the year. Substitute for filing ITR for qualified employees.",
    color: "border-l-amber-600",
    badge: "bg-amber-100 text-amber-700",
  },
  {
    code: "1604-C",
    title: "Annual Info Return + Alphalist",
    subtitle:
      "Annual Information Return of Income Taxes Withheld on Compensation",
    href: "/remittances/bir/1604-c",
    deadline: "January 31 of following year",
    frequency: "Annual",
    description:
      "Annual return summarizing all compensation paid and taxes withheld for all employees. Includes the BIR alphalist (Schedule 1) — a per-employee breakdown required by eBIRForms.",
    color: "border-l-purple-600",
    badge: "bg-purple-100 text-purple-700",
  },
] as const;

export default function BirPage() {
  return (
    <div className="space-y-8 p-6">
      <PageHeader
        title="BIR Compliance"
        description="Forms 1601-C · 2316 · 1604-C — withholding tax reporting and remittance"
      />

      {/* Tax calendar note */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <strong>Key BIR Deadlines:</strong>
        <ul className="mt-2 space-y-1 pl-4 text-xs list-disc">
          <li>Form 1601-C — 10th of each following month (monthly)</li>
          <li>Form 2316 — January 31, issued to each employee</li>
          <li>Form 1604-C + Alphalist — January 31, filed with BIR</li>
        </ul>
        <p className="mt-2 text-xs text-amber-700">
          Failure to file or late filing is subject to surcharge (25% / 50%),
          interest (12% per annum), and compromise penalty per Sections 248–250,
          NIRC.
        </p>
      </div>

      {/* Form cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {BIR_FORMS.map((form) => (
          <Link
            key={form.code}
            href={form.href}
            className={`group block rounded-xl border border-gray-200 border-l-4 bg-white p-6 shadow-sm transition hover:shadow-md ${form.color}`}
          >
            <div className="mb-3 flex items-start justify-between">
              <div>
                <span className="text-2xl font-black text-gray-200 group-hover:text-gray-300">
                  {form.code}
                </span>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${form.badge}`}
              >
                {form.frequency}
              </span>
            </div>

            <p className="mb-1 text-base font-bold text-pcso-navy">
              {form.title}
            </p>
            <p className="mb-3 text-xs text-gray-400">{form.subtitle}</p>
            <p className="mb-4 text-xs text-gray-500 leading-relaxed">
              {form.description}
            </p>

            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs text-gray-400">
                <span className="font-semibold">Deadline:</span> {form.deadline}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick reference */}
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-pcso-navy">
          BIR TRAIN Law Tax Rates (Compensation) — 2023 onwards
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 text-xs">
            <thead>
              <tr>
                {["Annual Taxable Compensation", "Tax Rate", "Base Tax"].map(
                  (h) => (
                    <th
                      key={h}
                      className="py-2 pr-6 text-left font-semibold text-gray-500"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[
                { range: "Up to PHP 250,000", rate: "0%", base: "₱0.00" },
                {
                  range: "PHP 250,001 – PHP 400,000",
                  rate: "15% of excess over 250,000",
                  base: "₱0.00",
                },
                {
                  range: "PHP 400,001 – PHP 800,000",
                  rate: "20% of excess over 400,000",
                  base: "₱22,500.00",
                },
                {
                  range: "PHP 800,001 – PHP 2,000,000",
                  rate: "25% of excess over 800,000",
                  base: "₱102,500.00",
                },
                {
                  range: "PHP 2,000,001 – PHP 8,000,000",
                  rate: "30% of excess over 2,000,000",
                  base: "₱402,500.00",
                },
                {
                  range: "Over PHP 8,000,000",
                  rate: "35% of excess over 8,000,000",
                  base: "₱2,202,500.00",
                },
              ].map((row) => (
                <tr key={row.range}>
                  <td className="py-1.5 pr-6 text-gray-700">{row.range}</td>
                  <td className="py-1.5 pr-6 font-semibold text-gray-900">
                    {row.rate}
                  </td>
                  <td className="py-1.5 pr-6 font-mono text-gray-600">
                    {row.base}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-gray-400">
          Source: NIRC Sec. 24(A) as amended by R.A. 10963 (TRAIN Law),
          effective January 1, 2023.
        </p>
      </div>
    </div>
  );
}
