"use client";

import { toast as sonnerToast } from "sonner";

type ToastVariant = "default" | "destructive";

interface ToastOptions {
  title?: string;
  description?: string;
  variant?: ToastVariant;
}

/**
 * Backward-compatible toast hook for components that still expect the old API.
 * Internally delegates to Sonner, which is already configured globally.
 */
export function useToast() {
  return {
    toast: ({ title, description, variant = "default" }: ToastOptions) => {
      if (variant === "destructive") {
        sonnerToast.error(title ?? "Error", { description });
        return;
      }

      sonnerToast(title ?? "Notification", { description });
    },
  };
}
