'use client';

/**
 * Client wrapper for the org chart page.
 * Hosts the export-to-PDF button (React-PDF) and the interactive SVG chart.
 *
 * PNG export via html-to-image is skipped — html-to-image is not in package.json.
 * TODO: Add html-to-image to dependencies to enable PNG export.
 */

import { useState } from 'react';
import { createElement } from 'react';
import { Button } from '@/components/ui/button';
import { FileDown, Loader2 } from 'lucide-react';
import { OrgChart, type OrgTreeNode } from '@/components/org-chart/org-chart';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface OrgChartClientProps {
  roots: OrgTreeNode[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OrgChartClient({ roots }: OrgChartClientProps) {
  const [isExporting, setIsExporting] = useState(false);

  async function handlePdfExport() {
    setIsExporting(true);
    try {
      const [{ pdf }, { OrgChartPdfDocument }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('./_pdf-document'),
      ]);

      // Use createElement to avoid needing JSX in async function context
      const doc = createElement(OrgChartPdfDocument, { roots });
      const blob = await pdf(doc).toBlob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `senate-org-chart-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (err) {
      // Export failures must not crash the UI
      console.error('[OrgChartClient] PDF export failed:', err);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 flex-1">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Click a node to see details. Drag to pan. Use +/- to zoom.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={handlePdfExport}
          disabled={isExporting}
        >
          {isExporting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <FileDown className="mr-2 h-4 w-4" />
          )}
          {isExporting ? 'Exporting…' : 'Export PDF'}
        </Button>
      </div>

      {/* Interactive chart */}
      <OrgChart
        roots={roots}
        className="flex-1"
        style={{ minHeight: '60vh' }}
      />
    </div>
  );
}
