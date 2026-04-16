'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { updateHoliday } from '../../actions';
import { HOLIDAY_TYPE_VALUES, HolidayTypeLabels } from '@/lib/validations/holidays';

interface EditHolidayFormProps {
  initial: {
    id: string;
    name: string;
    holidayDate: string;
    type: typeof HOLIDAY_TYPE_VALUES[number];
    proclamationRef: string | null;
    remarks: string | null;
  };
}

export function EditHolidayForm({ initial }: EditHolidayFormProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [name, setName] = React.useState(initial.name);
  const [holidayDate, setHolidayDate] = React.useState(initial.holidayDate);
  const [type, setType] = React.useState(initial.type);
  const [proclamationRef, setProclamationRef] = React.useState(initial.proclamationRef ?? '');
  const [remarks, setRemarks] = React.useState(initial.remarks ?? '');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      await updateHoliday({
        id: initial.id,
        name,
        holidayDate,
        type,
        proclamationRef: proclamationRef.trim() || null,
        remarks: remarks.trim() || null,
      });
      toast.success('Holiday updated');
      const year = holidayDate.slice(0, 4);
      router.push(`/admin/holidays?year=${year}`);
    } catch (err) {
      toast.error('Error', {
        description: err instanceof Error ? err.message : 'Failed to update holiday.',
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Holiday Name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="holidayDate">Date</Label>
        <Input
          id="holidayDate"
          type="date"
          value={holidayDate}
          onChange={(e) => setHolidayDate(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="type">Type</Label>
        <Select
          value={type}
          onValueChange={(v) => setType(v as typeof HOLIDAY_TYPE_VALUES[number])}
        >
          <SelectTrigger id="type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {HOLIDAY_TYPE_VALUES.map((t) => (
              <SelectItem key={t} value={t}>
                {HolidayTypeLabels[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="proclamationRef">Proclamation Reference (optional)</Label>
        <Input
          id="proclamationRef"
          value={proclamationRef}
          onChange={(e) => setProclamationRef(e.target.value)}
          placeholder="e.g. Proclamation No. 123 s. 2024"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="remarks">Remarks (optional)</Label>
        <Input
          id="remarks"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="Additional notes or legal text excerpt"
        />
      </div>

      <div className="flex items-center gap-3">
        <Button
          type="submit"
          disabled={pending}
          className="bg-senate-navy text-white hover:bg-senate-navy-light"
        >
          {pending ? 'Saving…' : 'Save changes'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push('/admin/holidays')}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
