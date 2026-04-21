import Link from "next/link";
import { Button } from "@/components/ui/button";

export interface VacancyCardData {
  id: string;
  title: string;
  positionTitle: string | null;
  salaryGrade: number | null;
  closingDate: string | null;
  publishedAt: string | null;
}

interface VacancyCardProps {
  vacancy: VacancyCardData;
}

export function VacancyCard({ vacancy }: VacancyCardProps) {
  const closing = vacancy.closingDate
    ? new Date(vacancy.closingDate).toISOString().slice(0, 10)
    : null;

  return (
    <article className="group relative flex h-full flex-col rounded-2xl border border-[#e7ddc7] bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex-1">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-[#8a6d2c]">
          {vacancy.positionTitle ?? "Position"}
        </p>
        <h3 className="mt-2 font-serif text-xl font-semibold leading-tight text-[#0b1d3a]">
          {vacancy.title}
        </h3>
        <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-[#4b4943]">
          {vacancy.salaryGrade !== null && (
            <div className="flex items-baseline gap-1.5">
              <dt className="text-xs uppercase tracking-wide text-[#8a6d2c]">
                SG
              </dt>
              <dd className="tabular-nums font-medium">
                {vacancy.salaryGrade}
              </dd>
            </div>
          )}
          {closing && (
            <div className="flex items-baseline gap-1.5">
              <dt className="text-xs uppercase tracking-wide text-[#8a6d2c]">
                Closes
              </dt>
              <dd className="tabular-nums font-medium">{closing}</dd>
            </div>
          )}
        </dl>
      </div>

      <div className="mt-6 flex items-center justify-between border-t border-dashed border-[#e7ddc7] pt-4">
        <span className="text-xs text-[#8a7d5b]">
          {vacancy.publishedAt
            ? `Published ${new Date(vacancy.publishedAt).toISOString().slice(0, 10)}`
            : "Open"}
        </span>
        <Button
          asChild
          size="sm"
          className="bg-[#0b1d3a] text-[#fdf8e9] hover:bg-[#0a1830]"
        >
          <Link href={`/apply/${vacancy.id}`}>View details →</Link>
        </Button>
      </div>
    </article>
  );
}
