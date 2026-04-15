'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { createGsisRate } from '../actions';

export function GsisRateForm() {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const fd = new FormData(e.currentTarget);

    try {
      await createGsisRate({
        effectiveDate: fd.get('effectiveDate') as string,
        employeeRate: fd.get('employeeRate') as string,
        employerRate: fd.get('employerRate') as string,
        lifeInsuranceRate: fd.get('lifeInsuranceRate') as string,
      });
      toast.success('GSIS rate saved', { description: 'New effective-date row inserted.' });
      formRef.current?.reset();
      router.refresh();
    } catch (err) {
      toast.error('Error', {
        description: err instanceof Error ? err.message : 'Failed to save GSIS rate.',
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add New GSIS Rate</CardTitle>
      </CardHeader>
      <CardContent>
        <form ref={formRef} onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <div className="col-span-2 max-w-xs space-y-2">
            <Label htmlFor="gsis-date">Effective Date</Label>
            <Input id="gsis-date" name="effectiveDate" type="date" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gsis-empRate">Employee Rate (e.g. 0.09)</Label>
            <Input id="gsis-empRate" name="employeeRate" placeholder="0.09" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gsis-erRate">Employer Rate (e.g. 0.12)</Label>
            <Input id="gsis-erRate" name="employerRate" placeholder="0.12" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gsis-liRate">Life Insurance Rate (e.g. 0.005)</Label>
            <Input id="gsis-liRate" name="lifeInsuranceRate" placeholder="0.005" required />
          </div>
          <div className="col-span-2">
            <Button
              type="submit"
              disabled={pending}
              className="bg-senate-navy text-white hover:bg-senate-navy-light"
            >
              {pending ? 'Saving…' : 'Save rate'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
