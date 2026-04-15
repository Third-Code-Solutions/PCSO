'use client';

/**
 * PDF document for org chart export.
 * Renders a text-based hierarchical list since SVG trees
 * are not supported natively in @react-pdf/renderer.
 */

import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { OrgTreeNode } from '@/components/org-chart/org-chart';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const NAVY = '#0B2545';
const GOLD = '#C8A84B';

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    paddingTop: 40,
    paddingBottom: 40,
    paddingHorizontal: 36,
    color: '#111827',
  },
  header: {
    marginBottom: 20,
    borderBottom: `2px solid ${GOLD}`,
    paddingBottom: 10,
  },
  orgName: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: NAVY,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: NAVY,
    marginTop: 4,
  },
  subtitle: {
    fontSize: 8,
    color: '#6b7280',
    marginTop: 2,
  },
  section: {
    marginBottom: 4,
  },
  rootNode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: NAVY,
    color: '#ffffff',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 4,
    marginBottom: 2,
  },
  rootNodeText: {
    color: '#ffffff',
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
  },
  rootNodeCode: {
    color: '#93c5fd',
    fontFamily: 'Courier',
    fontSize: 8,
    marginLeft: 4,
  },
  childNode: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderBottom: '0.5px solid #e5e7eb',
    marginLeft: 20,
  },
  childNodeText: {
    fontSize: 9,
    color: '#374151',
    flex: 1,
  },
  childNodeCode: {
    fontFamily: 'Courier',
    fontSize: 7,
    color: '#6b7280',
  },
  grandChildNode: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 10,
    marginLeft: 40,
    borderLeft: '1px solid #e5e7eb',
  },
  grandChildNodeText: {
    fontSize: 8,
    color: '#6b7280',
    flex: 1,
  },
  statsText: {
    fontSize: 7,
    color: '#9ca3af',
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 36,
    right: 36,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: '#9ca3af',
    borderTop: '0.5px solid #e5e7eb',
    paddingTop: 4,
  },
});

// ---------------------------------------------------------------------------
// Recursive node renderer
// ---------------------------------------------------------------------------

function NodeRow({ node, depth = 0 }: { node: OrgTreeNode; depth?: number }) {
  const indent = depth * 20;
  const isRoot = depth === 0;
  const isChild = depth === 1;

  if (isRoot) {
    return (
      <View style={styles.section}>
        <View style={styles.rootNode}>
          <Text style={styles.rootNodeText}>{node.name}</Text>
          <Text style={styles.rootNodeCode}>({node.code})</Text>
          <Text style={[styles.rootNodeCode, { marginLeft: 'auto' }]}>
            {node.memberCount} members · {node.totalPositions} positions
          </Text>
        </View>
        {node.children.map((child) => (
          <NodeRow key={child.id} node={child} depth={1} />
        ))}
      </View>
    );
  }

  if (isChild) {
    return (
      <View>
        <View style={styles.childNode}>
          <Text style={styles.childNodeText}>
            {'\u25B8'} {node.name}
          </Text>
          <Text style={styles.childNodeCode}>{node.code}</Text>
          <Text style={[styles.statsText, { marginLeft: 8 }]}>
            {node.memberCount}m / {node.filledPositions}/{node.totalPositions}p
          </Text>
        </View>
        {node.children.map((child) => (
          <NodeRow key={child.id} node={child} depth={2} />
        ))}
      </View>
    );
  }

  // Deeper levels
  return (
    <View>
      <View style={[styles.grandChildNode, { marginLeft: indent }]}>
        <Text style={styles.grandChildNodeText}>
          {'\u2013'} {node.name} ({node.code})
        </Text>
        <Text style={styles.statsText}>
          {node.memberCount}m
        </Text>
      </View>
      {node.children.map((child) => (
        <NodeRow key={child.id} node={child} depth={depth + 1} />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

interface OrgChartPdfDocumentProps {
  roots: OrgTreeNode[];
}

export function OrgChartPdfDocument({ roots }: OrgChartPdfDocumentProps) {
  const generatedOn = new Date().toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.orgName}>Senate of the Philippines</Text>
          <Text style={styles.title}>Organization Chart</Text>
          <Text style={styles.subtitle}>As of {generatedOn}</Text>
        </View>

        {/* Tree */}
        {roots.map((root) => (
          <NodeRow key={root.id} node={root} depth={0} />
        ))}

        {roots.length === 0 && (
          <Text style={styles.statsText}>No offices found.</Text>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>Senate of the Philippines HRIS — Organization Chart</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
