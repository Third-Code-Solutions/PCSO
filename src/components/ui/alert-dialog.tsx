'use client';

/**
 * AlertDialog — built on top of the existing Dialog primitive
 * since @radix-ui/react-alert-dialog is not yet installed.
 * Provides identical API surface to Radix AlertDialog.
 */
import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

const AlertDialog = Dialog;
const AlertDialogTrigger = DialogTrigger;
const AlertDialogPortal = React.Fragment;
const AlertDialogOverlay = React.Fragment;

const AlertDialogContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ children, ...props }, ref) => (
  <DialogContent ref={ref} role="alertdialog" {...props}>
    {children}
  </DialogContent>
));
AlertDialogContent.displayName = 'AlertDialogContent';

const AlertDialogHeader = DialogHeader;
const AlertDialogFooter = DialogFooter;
const AlertDialogTitle = DialogTitle;
const AlertDialogDescription = DialogDescription;

interface AlertDialogActionProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string;
}

const AlertDialogAction = React.forwardRef<HTMLButtonElement, AlertDialogActionProps>(
  ({ className, onClick, ...props }, ref) => {
    const closeCtx = React.useContext(CloseContext);
    return (
      <Button
        ref={ref}
        className={cn(className)}
        onClick={(e) => {
          onClick?.(e);
          closeCtx?.();
        }}
        {...props}
      />
    );
  },
);
AlertDialogAction.displayName = 'AlertDialogAction';

const AlertDialogCancel = React.forwardRef<HTMLButtonElement, AlertDialogActionProps>(
  ({ className, ...props }, ref) => (
    <DialogClose asChild>
      <Button ref={ref} variant="outline" className={cn('mt-2 sm:mt-0', className)} {...props} />
    </DialogClose>
  ),
);
AlertDialogCancel.displayName = 'AlertDialogCancel';

// Simple close context — action button calls this after its own handler
const CloseContext = React.createContext<(() => void) | undefined>(undefined);

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
};
