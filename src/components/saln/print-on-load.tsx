'use client';

/**
 * PrintOnLoad — invokes window.print() once on mount.
 *
 * Used on /saln/[id]?print=1 so a user clicking "Download PDF" in the
 * submissions browser lands on the detail page and immediately receives
 * the OS print/save-as-PDF dialog. The rest of the detail page is
 * already designed to look like the SALN Annex-A paper form.
 */

import * as React from 'react';

export function PrintOnLoad() {
  React.useEffect(() => {
    // Give the page a tick to finish rendering before invoking print.
    const t = setTimeout(() => {
      try {
        window.print();
      } catch {
        /* noop — user can use browser print menu */
      }
    }, 250);
    return () => clearTimeout(t);
  }, []);
  return null;
}
