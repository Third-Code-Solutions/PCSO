/**
 * /performance/ipcrf/[id]/monitoring — Phase 2: Mid-Year Monitoring
 *
 * Supervisors provide mid-semester feedback and progress notes.
 */

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { IpcrfForm } from '@/components/performance/ipcrf-form';
import { saveIpcrfMonitoring } from '../../../actions';
import type { IpcrfFormData } from '@/components/performance/ipcrf-form';

interface Props {
  params: Promise<{ id: string }>;
}

export default function IpcrfMonitoringPage({ params }: Props) {
  const router = useRouter();
  const [ratingId, setRatingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    params.then(({ id }) => setRatingId(id));
  }, [params]);

  if (!ratingId) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  async function handleSave(data: IpcrfFormData) {
    await saveIpcrfMonitoring({
      performanceRatingId: ratingId!,
      supervisorFeedback: data.supervisorFeedback || undefined,
      midYearRemarks: data.midYearRemarks || undefined,
    });
  }

  async function handleSubmit(data: IpcrfFormData) {
    await saveIpcrfMonitoring({
      performanceRatingId: ratingId!,
      supervisorFeedback: data.supervisorFeedback || undefined,
      midYearRemarks: data.midYearRemarks || undefined,
    });
    router.push(`/performance/ipcrf/${ratingId!}`);
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-6">
        <nav className="mb-2 flex items-center gap-1.5 text-sm text-muted-foreground">
          <a href="/performance" className="hover:text-foreground transition-colors">Performance</a>
          <span>/</span>
          <a href="/performance/ipcrf" className="hover:text-foreground transition-colors">My IPCRF</a>
          <span>/</span>
          <a href={`/performance/ipcrf/${ratingId}`} className="hover:text-foreground transition-colors">Detail</a>
          <span>/</span>
          <span className="text-foreground font-medium">Monitoring</span>
        </nav>
        <h1 className="text-2xl font-semibold text-foreground">Performance Monitoring</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Phase 2 — Mid-year supervisor feedback and progress monitoring.
        </p>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <IpcrfForm
          phase="monitoring"
          ratingId={ratingId}
          onSave={handleSave}
          onSubmit={handleSubmit}
        />
      </div>
    </main>
  );
}
