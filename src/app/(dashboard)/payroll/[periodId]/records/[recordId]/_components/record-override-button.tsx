'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AdjustmentForm } from '@/components/payroll/adjustment-form';

interface RecordOverrideButtonProps {
  recordId: string;
  periodId: string;
}

export function RecordOverrideButton({ recordId, periodId }: RecordOverrideButtonProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button
        size="sm"
        className="bg-[#0B2545] text-white hover:bg-[#13315C]"
        onClick={() => setOpen(true)}
      >
        <Pencil className="mr-2 h-4 w-4" />
        Override
      </Button>

      <AdjustmentForm
        recordId={recordId}
        open={open}
        onOpenChange={setOpen}
        onSuccess={() => router.refresh()}
      />
    </>
  );
}
