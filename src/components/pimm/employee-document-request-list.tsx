"use client";

interface Props {
  employeeId: string;
}

export function EmployeeDocumentRequestList({ employeeId }: Props) {
  return (
    <div className="rounded-md border p-4 text-sm text-muted-foreground">
      Document request list for employee {employeeId}
    </div>
  );
}
