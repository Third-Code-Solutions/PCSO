'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { EmployeeFormPersonal } from './employee-form-personal';
import { EmployeeFormEmployment } from './employee-form-employment';
import { EmployeeFormGovIds } from './employee-form-gov-ids';
import { EmployeeFormDocuments } from './employee-form-documents';
import { EmployeeSchema, type EmployeeInput } from '@/lib/validations/employees';
import type { OfficeSelectOption } from '@/app/(dashboard)/employees/queries';
import { createEmployee, updateEmployee, uploadDocument } from '@/app/(dashboard)/employees/actions';

interface EmployeeFormProps {
  mode: 'create' | 'edit';
  defaultValues?: Partial<EmployeeInput> & { id?: string };
  offices: OfficeSelectOption[];
}

const TAB_KEYS = ['personal', 'employment', 'gov-ids', 'documents'] as const;
type TabKey = (typeof TAB_KEYS)[number];

const TAB_LABELS: Record<TabKey, string> = {
  personal: 'Personal Info',
  employment: 'Employment',
  'gov-ids': 'Government IDs',
  documents: 'Documents',
};

export function EmployeeForm({ mode, defaultValues, offices }: EmployeeFormProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>('personal');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<EmployeeInput>({
    resolver: zodResolver(EmployeeSchema),
    defaultValues: {
      nationality: 'Filipino',
      status: 'active',
      ...defaultValues,
    },
    mode: 'onTouched',
  });

  const employeeId = defaultValues?.id;

  const handleUpload = async (
    fileName: string,
    fileBase64: string,
    mimeType: string,
  ) => {
    if (!employeeId) throw new Error('Employee ID required for document upload');
    return uploadDocument(employeeId, fileName, fileBase64, mimeType);
  };

  const onSubmit = async (data: EmployeeInput) => {
    setIsSubmitting(true);
    try {
      if (mode === 'create') {
        const row = await createEmployee(data);
        if (!row) throw new Error('No employee record returned from server.');
        toast.success('Employee record created successfully.');
        router.push(`/employees/${row.id}`);
      } else {
        if (!employeeId) throw new Error('Employee ID missing for update');
        await updateEmployee({ ...data, id: employeeId });
        toast.success('Employee record updated successfully.');
        router.push(`/employees/${employeeId}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const goToNext = () => {
    const idx = TAB_KEYS.indexOf(activeTab);
    const next = TAB_KEYS[idx + 1];
    if (idx < TAB_KEYS.length - 1 && next !== undefined) {
      setActiveTab(next);
    }
  };

  const goToPrev = () => {
    const idx = TAB_KEYS.indexOf(activeTab);
    const prev = TAB_KEYS[idx - 1];
    if (idx > 0 && prev !== undefined) {
      setActiveTab(prev);
    }
  };

  const isFirst = activeTab === TAB_KEYS[0];
  const isLast = activeTab === TAB_KEYS[TAB_KEYS.length - 1];

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as TabKey)}
          className="space-y-6"
        >
          <TabsList className="grid w-full grid-cols-4 bg-senate-navy/5">
            {TAB_KEYS.map((key) => (
              <TabsTrigger
                key={key}
                value={key}
                className="data-[state=active]:bg-senate-navy data-[state=active]:text-white"
              >
                {TAB_LABELS[key]}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="personal" className="mt-0">
            <div className="rounded-lg border bg-card p-6">
              <h2 className="mb-4 text-lg font-semibold text-senate-navy">
                Personal Information
              </h2>
              <EmployeeFormPersonal />
            </div>
          </TabsContent>

          <TabsContent value="employment" className="mt-0">
            <div className="rounded-lg border bg-card p-6">
              <h2 className="mb-4 text-lg font-semibold text-senate-navy">
                Employment Details
              </h2>
              <EmployeeFormEmployment offices={offices} isEdit={mode === 'edit'} />
            </div>
          </TabsContent>

          <TabsContent value="gov-ids" className="mt-0">
            <div className="rounded-lg border bg-card p-6">
              <h2 className="mb-4 text-lg font-semibold text-senate-navy">
                Government IDs
              </h2>
              <EmployeeFormGovIds />
            </div>
          </TabsContent>

          <TabsContent value="documents" className="mt-0">
            <div className="rounded-lg border bg-card p-6">
              <h2 className="mb-4 text-lg font-semibold text-senate-navy">
                Documents — 201 File
              </h2>
              <EmployeeFormDocuments
                employeeId={employeeId}
                onUpload={employeeId ? handleUpload : undefined}
              />
            </div>
          </TabsContent>
        </Tabs>

        {/* Navigation footer */}
        <div className="flex items-center justify-between border-t pt-6">
          <Button
            type="button"
            variant="outline"
            onClick={goToPrev}
            disabled={isFirst}
          >
            Previous
          </Button>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.back()}
            >
              Cancel
            </Button>

            {isLast ? (
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-senate-navy text-white hover:bg-senate-navy-light"
              >
                {isSubmitting
                  ? mode === 'create'
                    ? 'Creating…'
                    : 'Saving…'
                  : mode === 'create'
                    ? 'Create Employee'
                    : 'Save Changes'}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={goToNext}
                className="bg-senate-navy text-white hover:bg-senate-navy-light"
              >
                Next
              </Button>
            )}
          </div>
        </div>
      </form>
    </FormProvider>
  );
}
