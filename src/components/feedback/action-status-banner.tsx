"use client";

import * as React from "react";

interface ActionStatusBannerProps {
  status?: string;
  entityLabel: string;
}

const SUCCESS_STATES = new Set(["created", "updated", "saved", "success"]);
const ERROR_STATES = new Set(["failed", "error"]);

export function ActionStatusBanner({
  status,
  entityLabel,
}: ActionStatusBannerProps) {
  if (!status) return null;
  const key = status.toLowerCase();

  if (SUCCESS_STATES.has(key)) {
    return (
      <div className="mb-4 rounded-md border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        SUCCESS: {entityLabel} has been {key}.
      </div>
    );
  }

  if (ERROR_STATES.has(key)) {
    return (
      <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        FAILED: {entityLabel} action was not completed. Please review the form
        and try again.
      </div>
    );
  }

  return null;
}
