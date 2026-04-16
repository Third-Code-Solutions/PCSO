'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { deactivateEmployee } from '@/app/(dashboard)/employees/actions';

interface ArchiveEmployeeButtonProps {
  employeeId: string;
  employeeName: string;
  isAlreadyArchived?: boolean;
}

/**
 * Confirmation-guarded archive (soft-delete) control. Rendered on the
 * employee profile page for roles that have `employees:delete` permission.
 *
 * The server action `deactivateEmployee` is itself permission-gated, so
 * unauthorised clicks are blocked at the server boundary even if this
 * component is rendered by mistake.
 */
export function ArchiveEmployeeButton({
  employeeId,
  employeeName,
  isAlreadyArchived = false,
}: ArchiveEmployeeButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (isAlreadyArchived) return null;

  const commit = () => {
    setOpen(false);
    startTransition(async () => {
      try {
        await deactivateEmployee(employeeId);
        toast.success(`${employeeName} has been archived.`);
        router.push('/employees');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to archive employee.');
      }
    });
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setOpen(true)}
        disabled={isPending}
      >
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Archive className="h-3.5 w-3.5" />
        )}
        Archive
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive {employeeName}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the record as resigned and hide it from the active employee
              list. Related payroll, leave, and SALN history are preserved. The action is
              reversible by an administrator.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={commit}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
