/**
 * /performance/ipcrf/[id]/review — Phase 3: Performance Review / Rating
 *
 * Supervisor fills in per-KRA ratings. System computes weighted final rating.
 */

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { IpcrfForm } from '@/components/performance/ipcrf-form';
import { saveIpcrfReview, submitIpcrfReview } from '../../../actions';
import type { IpcrfFormData } from '@/components/performance/ipcrf-form';

interface Props {
  params: Promise<{ id: string }>;
}

export default function IpcrfReviewPage({ params }: Props) {
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
    const krasWithRatings = data.kras.filter((k) => typeof k.rating === 'number');
    if (krasWithRatings.length === 0) return;

    await saveIpcrfReview({
      performanceRatingId: ratingId!,
      kras: krasWithRatings.map((k) => ({
        position: k.position,
        title: k.title,
        description: k.description || undefined,
        weight: k.weight,
        successIndicators: k.successIndicators,
        baseline: k.baseline || undefined,
        actualAccomplishments: k.actualAccomplishments || undefined,
        rating: k.rating as number,
      })),
      raterRemarks: data.raterRemarks || undefined,
    });
  }

  async function handleSubmit(data: IpcrfFormData) {
    const krasWithRatings = data.kras.filter((k) => typeof k.rating === 'number');

    await submitIpcrfReview({
      performanceRatingId: ratingId!,
      kras: krasWithRatings.map((k) => ({
        position: k.position,
        title: k.title,
        description: k.description || undefined,
        weight: k.weight,
        successIndicators: k.successIndicators,
        baseline: k.baseline || undefined,
        actualAccomplishments: k.actualAccomplishments || undefined,
        rating: k.rating as number,
      })),
      raterRemarks: data.raterRemarks || undefined,
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
          <span className="text-foreground font-medium">Review</span>
        </nav>
        <h1 className="text-2xl font-semibold text-foreground">Performance Review</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Phase 3 — Rate each KRA (1.000–5.000). The system computes the weighted final rating automatically.
        </p>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <IpcrfForm
          phase="review"
          ratingId={ratingId}
          onSave={handleSave}
          onSubmit={handleSubmit}
        />
      </div>
    </main>
  );
}
