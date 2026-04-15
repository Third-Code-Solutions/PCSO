'use client';

/**
 * OrgChart — pure SVG-based interactive tree.
 *
 * Renders an office hierarchy using a top-down tree layout.
 * Each node is rendered as a foreignObject within SVG for rich styling.
 * Edges are cubic bezier paths.
 *
 * No external charting libraries — built entirely with SVG + React.
 */

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { OrgNode, type OrgNodeData } from './org-node';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

// ---------------------------------------------------------------------------
// Tree data shape
// ---------------------------------------------------------------------------

export interface OrgTreeNode extends OrgNodeData {
  children: OrgTreeNode[];
}

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const NODE_WIDTH = 204;
const NODE_HEIGHT = 130;
const H_GAP = 28;
const V_GAP = 70;

// ---------------------------------------------------------------------------
// Layout computation (Reingold-Tilford style simple placement)
// ---------------------------------------------------------------------------

interface LayoutNode {
  node: OrgTreeNode;
  x: number;
  y: number;
}

function layoutTree(
  root: OrgTreeNode,
  depth: number,
  xOffset: number,
): { items: LayoutNode[]; subtreeWidth: number } {
  if (root.children.length === 0) {
    return {
      items: [{ node: root, x: xOffset, y: depth * (NODE_HEIGHT + V_GAP) }],
      subtreeWidth: NODE_WIDTH,
    };
  }

  const childLayouts = root.children.map((child) =>
    layoutTree(child, depth + 1, 0),
  );

  // Place children side by side
  let childXCursor = 0;
  const rebasedChildren: LayoutNode[] = [];
  for (const layout of childLayouts) {
    for (const item of layout.items) {
      rebasedChildren.push({ ...item, x: item.x + childXCursor });
    }
    childXCursor += layout.subtreeWidth + H_GAP;
  }

  const totalChildrenWidth = childXCursor - H_GAP;

  // Center the root over its children
  const rootX = xOffset + totalChildrenWidth / 2 - NODE_WIDTH / 2;

  // Shift children to be relative to xOffset
  const items: LayoutNode[] = [
    { node: root, x: rootX, y: depth * (NODE_HEIGHT + V_GAP) },
    ...rebasedChildren.map((item) => ({ ...item, x: item.x + xOffset })),
  ];

  return {
    items,
    subtreeWidth: Math.max(totalChildrenWidth, NODE_WIDTH),
  };
}

// ---------------------------------------------------------------------------
// Edge (cubic bezier between parent bottom-center and child top-center)
// ---------------------------------------------------------------------------

function TreeEdge({
  x1,
  y1,
  x2,
  y2,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}) {
  const midY = (y1 + y2) / 2;
  return (
    <path
      d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
      fill="none"
      stroke="#cbd5e1"
      strokeWidth={1.5}
    />
  );
}

// ---------------------------------------------------------------------------
// Selected node side-panel
// ---------------------------------------------------------------------------

function NodeInfoPanel({
  node,
  onViewEmployees,
}: {
  node: OrgNodeData;
  onViewEmployees: (officeId: string) => void;
}) {
  const fillRate =
    node.totalPositions > 0
      ? Math.round((node.filledPositions / node.totalPositions) * 100)
      : 0;

  return (
    <div className="absolute right-4 top-16 z-10 w-60 rounded-xl border border-border bg-card shadow-lg p-4 space-y-3">
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground capitalize">
          {node.type}
        </div>
        <h3 className="font-semibold text-foreground mt-0.5 leading-snug">{node.name}</h3>
        <p className="font-mono text-xs text-muted-foreground">{node.code}</p>
      </div>

      {node.headEmployeeName && (
        <div className="text-sm border-t border-border pt-2">
          <span className="text-xs text-muted-foreground block">Office Head</span>
          <p className="font-medium text-sm">{node.headEmployeeName}</p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-1.5 text-center">
        {[
          { label: 'Members', value: node.memberCount, className: '' },
          { label: 'Positions', value: node.totalPositions, className: '' },
          {
            label: 'Fill Rate',
            value: `${fillRate}%`,
            className:
              fillRate >= 80
                ? 'text-emerald-600'
                : fillRate >= 50
                  ? 'text-amber-600'
                  : 'text-rose-600',
          },
        ].map(({ label, value, className }) => (
          <div key={label} className="rounded-md bg-muted px-1 py-1.5">
            <div className={cn('text-base font-bold tabular-nums', className)}>{value}</div>
            <div className="text-[9px] text-muted-foreground uppercase tracking-wide">
              {label}
            </div>
          </div>
        ))}
      </div>

      <Button size="sm" className="w-full" onClick={() => onViewEmployees(node.id)}>
        View Employees
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main OrgChart component
// ---------------------------------------------------------------------------

interface OrgChartProps {
  roots: OrgTreeNode[];
  className?: string;
  style?: React.CSSProperties;
}

export function OrgChart({ roots, className, style }: OrgChartProps) {
  const router = useRouter();
  const [selectedNode, setSelectedNode] = useState<OrgNodeData | null>(null);
  const [scale, setScale] = useState(0.9);
  const [translate, setTranslate] = useState({ x: 48, y: 48 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Build layout for all root trees placed side-by-side
  const allItems: LayoutNode[] = [];
  let xCursor = 0;
  for (const root of roots) {
    const { items, subtreeWidth } = layoutTree(root, 0, xCursor);
    for (const item of items) {
      allItems.push(item);
    }
    xCursor += subtreeWidth + H_GAP * 3;
  }

  const totalW = Math.max(xCursor + 80, 800);
  const maxY = allItems.reduce((m, i) => Math.max(m, i.y), 0);
  const totalH = Math.max(maxY + NODE_HEIGHT + 80, 600);

  // Build lookup map for edge rendering
  const posMap = new Map<string, LayoutNode>();
  for (const item of allItems) {
    posMap.set(item.node.id, item);
  }

  // Collect all edges
  const edges: { x1: number; y1: number; x2: number; y2: number }[] = [];
  function collectEdges(node: OrgTreeNode) {
    const parent = posMap.get(node.id);
    if (!parent) return;
    for (const child of node.children) {
      const childPos = posMap.get(child.id);
      if (childPos) {
        edges.push({
          x1: parent.x + NODE_WIDTH / 2,
          y1: parent.y + NODE_HEIGHT,
          x2: childPos.x + NODE_WIDTH / 2,
          y2: childPos.y,
        });
        collectEdges(child);
      }
    }
  }
  for (const root of roots) {
    collectEdges(root);
  }

  // Pan handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-org-node="true"]')) return;
      setIsDragging(true);
      setDragStart({ x: e.clientX - translate.x, y: e.clientY - translate.y });
    },
    [translate],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;
      setTranslate({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    },
    [isDragging, dragStart],
  );

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  function handleNodeClick(node: OrgNodeData) {
    setSelectedNode((prev) => (prev?.id === node.id ? null : node));
  }

  function handleViewEmployees(officeId: string) {
    router.push(`/employees?officeId=${officeId}`);
  }

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-border bg-muted/30',
        className,
      )}
      style={style}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Zoom controls */}
      <div className="absolute left-4 top-4 z-10 flex flex-col gap-1.5">
        <Button
          size="icon"
          variant="outline"
          className="h-8 w-8 bg-card shadow-sm"
          onClick={() => setScale((s) => Math.min(s + 0.15, 2.5))}
        >
          <ZoomIn className="h-4 w-4" />
          <span className="sr-only">Zoom in</span>
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="h-8 w-8 bg-card shadow-sm"
          onClick={() => setScale((s) => Math.max(s - 0.15, 0.25))}
        >
          <ZoomOut className="h-4 w-4" />
          <span className="sr-only">Zoom out</span>
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="h-8 w-8 bg-card shadow-sm"
          onClick={() => {
            setScale(0.9);
            setTranslate({ x: 48, y: 48 });
          }}
        >
          <Maximize2 className="h-4 w-4" />
          <span className="sr-only">Reset view</span>
        </Button>
      </div>

      {/* Selected node panel */}
      {selectedNode && (
        <NodeInfoPanel node={selectedNode} onViewEmployees={handleViewEmployees} />
      )}

      {/* SVG canvas — viewBox allows content to scroll if window is smaller */}
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${totalW} ${totalH}`}
        preserveAspectRatio="xMinYMin meet"
        style={{ display: 'block', minHeight: 420, cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <g transform={`translate(${translate.x}, ${translate.y}) scale(${scale})`}>
          {/* Edges first (behind nodes) */}
          {edges.map((edge, idx) => (
            <TreeEdge key={idx} {...edge} />
          ))}

          {/* Nodes as foreignObject for React rendering */}
          {allItems.map(({ node, x, y }) => (
            <foreignObject
              key={node.id}
              x={x}
              y={y}
              width={NODE_WIDTH}
              height={NODE_HEIGHT}
            >
              {/* xmlns is required for SVG foreignObject children when rendered to string. */}
              <div
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore xmlns not in React.HTMLAttributes but required by SVG spec
                xmlns="http://www.w3.org/1999/xhtml"
                data-org-node="true"
              >
                <OrgNode
                  node={node}
                  isSelected={selectedNode?.id === node.id}
                  onClick={handleNodeClick}
                />
              </div>
            </foreignObject>
          ))}
        </g>
      </svg>

      {/* Empty state */}
      {roots.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
          No offices configured. Add offices in Admin to see the org chart.
        </div>
      )}
    </div>
  );
}
