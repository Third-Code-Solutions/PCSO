'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { createPhilhealthRate } from '../actions';

export function PhilhealthRateForm() {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const fd = new FormData(e.currentTarget);

    try {
      await createPhilhealthRate({
        effectiveDate: fd.get('effectiveDate') as string,
        employeeRate: fd.get('employeeRate') as string,
        employerRate: fd.get('employerRate') as string,
        minMsalary: fd.get('minMsalary') as string,
        maxMsalary: fd.get('maxMsalary') as string,
        minPremium: fd.get('minPremium') as string,
        maxPremium: fd.get('maxPremium') as string,
      });
      toast.success('PhilHealth rate saved');
      formRef.current?.reset();
      router.refresh();
    } catch (err) {
      toast.error('Error', {
        description: err instanceof Error ? err.message : 'Failed to save PhilHealth rate.',
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add New PhilHealth Rate</CardTitle>
      </CardHeader>
      <CardContent>
        <form ref={formRef} onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <div className="col-span-2 max-w-xs space-y-2">
            <Label htmlFor="ph-date">Effective Date</Label>
            <Input id="ph-date" name="effectiveDate" type="date" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ph-empRate">Employee Rate (e.g. 0.025)</Label>
            <Input id="ph-empRate" name="employeeRate" placeholder="0.025" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ph-erRate">Employer Rate (e.g. 0.025)</Label>
            <Input id="ph-erRate" name="employerRate" placeholder="0.025" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ph-minSal">Min Monthly Salary (₱)</Label>
            <Input id="ph-minSal" name="minMsalary" placeholder="10000.00" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ph-maxSal">Max Monthly Salary (₱)</Label>
            <Input id="ph-maxSal" name="maxMsalary" placeholder="100000.00" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ph-minPrem">Min Monthly Premium (₱)</Label>
            <Input id="ph-minPrem" name="minPremium" placeholder="500.00" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ph-maxPrem">Max Monthly Premium (₱)</Label>
            <Input id="ph-maxPrem" name="maxPremium" placeholder="5000.00" required />
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
