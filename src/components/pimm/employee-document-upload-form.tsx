"use client";

interface Props {
  employeeId: string;
}

export function EmployeeDocumentUploadForm({ employeeId }: Props) {
  return (
    <div className="rounded-md border p-4 text-sm text-muted-foreground">
      Document upload form for employee {employeeId}
    </div>
  );
}
