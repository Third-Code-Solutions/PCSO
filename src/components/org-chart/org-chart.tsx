"use client";

/**
 * OrgChart — pure SVG-based interactive tree.
 *
 * Renders an office hierarchy using a top-down tree layout.
 * Each node is rendered as a foreignObject within SVG for rich styling.
 * Edges are cubic bezier paths.
 *
 * Performance:
 * - Branches are collapsible. Deep branches start collapsed beyond
 *   DEFAULT_EXPANDED_DEPTH so the initial layout covers a bounded subset of
 *   nodes even when the total org is 1000+.
 * - Off-screen nodes are culled before render so the DOM never holds more
 *   than VISIBLE_NODE_BUDGET foreignObjects at once.
 * - Layout is memoised on the expanded-set signature and re-computed only
 *   when the user expands/collapses a branch.
 *
 * No external charting libraries — built entirely with SVG + React.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { OrgNode, type OrgNodeData } from "./org-node";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, Maximize2, FoldVertical } from "lucide-react";
import { cn } from "@/lib/utils/cn";

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

/** How many levels are expanded by default. Deeper nodes start collapsed. */
const DEFAULT_EXPANDED_DEPTH = 2;

/** Hard cap on DOM nodes rendered at once to keep scrolling smooth. */
const VISIBLE_NODE_BUDGET = 500;

/** Extra margin around the viewport used for culling. */
const CULL_MARGIN_PX = 400;

// ---------------------------------------------------------------------------
// Layout computation (Reingold-Tilford style simple placement)
// ---------------------------------------------------------------------------

interface LayoutNode {
  node: OrgTreeNode;
  x: number;
  y: number;
  depth: number;
  hasChildren: boolean;
  isCollapsed: boolean;
}

function layoutTree(
  root: OrgTreeNode,
  depth: number,
  xOffset: number,
  expanded: Set<string>,
): { items: LayoutNode[]; subtreeWidth: number } {
  const isCollapsed = root.children.length > 0 && !expanded.has(root.id);
  const visibleChildren = isCollapsed ? [] : root.children;

  if (visibleChildren.length === 0) {
    return {
      items: [
        {
          node: root,
          x: xOffset,
          y: depth * (NODE_HEIGHT + V_GAP),
          depth,
          hasChildren: root.children.length > 0,
          isCollapsed,
        },
      ],
      subtreeWidth: NODE_WIDTH,
    };
  }

  const childLayouts = visibleChildren.map((child) =>
    layoutTree(child, depth + 1, 0, expanded),
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

  const items: LayoutNode[] = [
    {
      node: root,
      x: rootX,
      y: depth * (NODE_HEIGHT + V_GAP),
      depth,
      hasChildren: true,
      isCollapsed: false,
    },
    ...rebasedChildren.map((item) => ({ ...item, x: item.x + xOffset })),
  ];

  return {
    items,
    subtreeWidth: Math.max(totalChildrenWidth, NODE_WIDTH),
  };
}

/**
 * Compute the initial expanded set: every node whose depth is less than
 * `DEFAULT_EXPANDED_DEPTH` is expanded by default.
 */
function defaultExpandedSet(roots: OrgTreeNode[]): Set<string> {
  const set = new Set<string>();
  function walk(node: OrgTreeNode, depth: number) {
    if (depth < DEFAULT_EXPANDED_DEPTH) {
      set.add(node.id);
      for (const child of node.children) walk(child, depth + 1);
    }
  }
  for (const r of roots) walk(r, 0);
  return set;
}

function allExpandedSet(roots: OrgTreeNode[]): Set<string> {
  const set = new Set<string>();
  function walk(node: OrgTreeNode) {
    set.add(node.id);
    for (const child of node.children) walk(child);
  }
  for (const r of roots) walk(r);
  return set;
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
        <h3 className="font-semibold text-foreground mt-0.5 leading-snug">
          {node.name}
        </h3>
        <p className="font-mono text-xs text-muted-foreground">{node.code}</p>
      </div>

      {node.headEmployeeName && (
        <div className="text-sm border-t border-border pt-2">
          <span className="text-xs text-muted-foreground block">
            Office Head
          </span>
          <p className="font-medium text-sm">{node.headEmployeeName}</p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-1.5 text-center">
        {[
          { label: "Members", value: node.memberCount, className: "" },
          { label: "Positions", value: node.totalPositions, className: "" },
          {
            label: "Fill Rate",
            value: `${fillRate}%`,
            className:
              fillRate >= 80
                ? "text-emerald-600"
                : fillRate >= 50
                  ? "text-amber-600"
                  : "text-rose-600",
          },
        ].map(({ label, value, className }) => (
          <div key={label} className="rounded-md bg-muted px-1 py-1.5">
            <div className={cn("text-base font-bold tabular-nums", className)}>
              {value}
            </div>
            <div className="text-[9px] text-muted-foreground uppercase tracking-wide">
              {label}
            </div>
          </div>
        ))}
      </div>

      <Button
        size="sm"
        className="w-full"
        onClick={() => onViewEmployees(node.id)}
      >
        View Employees
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Collapse / expand toggle rendered on top of each parent node
// ---------------------------------------------------------------------------

function BranchToggle({
  isCollapsed,
  childCount,
  onToggle,
}: {
  isCollapsed: boolean;
  childCount: number;
  onToggle: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={isCollapsed ? "Expand branch" : "Collapse branch"}
      title={isCollapsed ? `Expand (${childCount} children)` : "Collapse"}
      className={cn(
        "absolute -bottom-3 left-1/2 -translate-x-1/2 z-10",
        "flex h-6 min-w-[28px] items-center justify-center gap-1 rounded-full",
        "border border-border bg-card px-1.5 text-[11px] font-medium text-muted-foreground",
        "shadow-sm transition-all hover:border-pcso-navy hover:text-pcso-navy",
      )}
    >
      {isCollapsed ? "+" : "–"}
      <span className="tabular-nums">{childCount}</span>
    </button>
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
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Expanded-set is the key state driving layout recomputation.
  const [expanded, setExpanded] = useState<Set<string>>(() =>
    defaultExpandedSet(roots),
  );

  // Re-seed default expansion when the roots prop changes (e.g. server revalidation).
  useEffect(() => {
    setExpanded(defaultExpandedSet(roots));
  }, [roots]);

  const toggleExpanded = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const collapseAll = () => setExpanded(defaultExpandedSet(roots));
  const expandAll = () => setExpanded(allExpandedSet(roots));

  // Build layout for all root trees placed side-by-side.
  // Memoised on the expanded-set signature so rapid pans do not re-layout.
  const { allItems, totalW, totalH, edges } = useMemo(() => {
    const items: LayoutNode[] = [];
    let xCursor = 0;
    for (const root of roots) {
      const { items: layoutItems, subtreeWidth } = layoutTree(
        root,
        0,
        xCursor,
        expanded,
      );
      for (const item of layoutItems) items.push(item);
      xCursor += subtreeWidth + H_GAP * 3;
    }

    const tw = Math.max(xCursor + 80, 800);
    const maxY = items.reduce((m, i) => Math.max(m, i.y), 0);
    const th = Math.max(maxY + NODE_HEIGHT + 80, 600);

    const posMap = new Map<string, LayoutNode>();
    for (const item of items) posMap.set(item.node.id, item);

    const es: { x1: number; y1: number; x2: number; y2: number }[] = [];
    function collectEdges(node: OrgTreeNode) {
      const parent = posMap.get(node.id);
      if (!parent || parent.isCollapsed) return;
      for (const child of node.children) {
        const childPos = posMap.get(child.id);
        if (!childPos) continue;
        es.push({
          x1: parent.x + NODE_WIDTH / 2,
          y1: parent.y + NODE_HEIGHT,
          x2: childPos.x + NODE_WIDTH / 2,
          y2: childPos.y,
        });
        collectEdges(child);
      }
    }
    for (const root of roots) collectEdges(root);

    return { allItems: items, totalW: tw, totalH: th, edges: es };
  }, [roots, expanded]);

  // Track the container size so we know what to cull.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) setViewport({ w: rect.width, h: rect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Visible set: cull items entirely outside the viewport (with margin).
  // Falls back to first N items when viewport size is unknown.
  const visibleItems = useMemo(() => {
    if (allItems.length <= VISIBLE_NODE_BUDGET && viewport.w === 0) {
      return allItems;
    }
    if (viewport.w === 0 || viewport.h === 0) {
      return allItems.slice(0, VISIBLE_NODE_BUDGET);
    }
    const minX = (-translate.x - CULL_MARGIN_PX) / scale;
    const maxX = (-translate.x + viewport.w + CULL_MARGIN_PX) / scale;
    const minY = (-translate.y - CULL_MARGIN_PX) / scale;
    const maxY = (-translate.y + viewport.h + CULL_MARGIN_PX) / scale;
    const filtered = allItems.filter(
      (i) =>
        i.x + NODE_WIDTH >= minX &&
        i.x <= maxX &&
        i.y + NODE_HEIGHT >= minY &&
        i.y <= maxY,
    );
    if (filtered.length > VISIBLE_NODE_BUDGET) {
      return filtered.slice(0, VISIBLE_NODE_BUDGET);
    }
    return filtered;
  }, [allItems, translate, scale, viewport]);

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

  const culledCount = allItems.length - visibleItems.length;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative overflow-hidden rounded-xl border border-border bg-muted/30",
        className,
      )}
      style={style}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Zoom + expand controls */}
      <div className="absolute left-4 top-4 z-10 flex flex-col gap-1.5">
        <Button
          size="icon"
          variant="outline"
          className="h-8 w-8 bg-card shadow-sm"
          onClick={() => setScale((s) => Math.min(s + 0.15, 2.5))}
          aria-label="Zoom in"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="h-8 w-8 bg-card shadow-sm"
          onClick={() => setScale((s) => Math.max(s - 0.15, 0.25))}
          aria-label="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="h-8 w-8 bg-card shadow-sm"
          onClick={() => {
            setScale(0.9);
            setTranslate({ x: 48, y: 48 });
          }}
          aria-label="Reset view"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="h-8 w-8 bg-card shadow-sm"
          onClick={collapseAll}
          aria-label="Collapse deep branches"
          title="Collapse deep branches"
        >
          <FoldVertical className="h-4 w-4" />
        </Button>
      </div>

      {/* Expand-all link (separate because it can be dangerous on 1000+ nodes) */}
      <div className="absolute left-4 bottom-4 z-10 flex flex-col gap-1 text-[11px] text-muted-foreground">
        <span>
          {allItems.length.toLocaleString()} visible node
          {allItems.length !== 1 ? "s" : ""}
          {culledCount > 0
            ? ` · ${culledCount.toLocaleString()} offscreen`
            : ""}
        </span>
        <button
          type="button"
          onClick={expandAll}
          className="self-start underline underline-offset-2 hover:text-pcso-navy"
        >
          Expand all branches
        </button>
      </div>

      {/* Selected node panel */}
      {selectedNode && (
        <NodeInfoPanel
          node={selectedNode}
          onViewEmployees={handleViewEmployees}
        />
      )}

      {/* SVG canvas — viewBox allows content to scroll if window is smaller */}
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${totalW} ${totalH}`}
        preserveAspectRatio="xMinYMin meet"
        style={{
          display: "block",
          minHeight: 420,
          cursor: isDragging ? "grabbing" : "grab",
        }}
      >
        <g
          transform={`translate(${translate.x}, ${translate.y}) scale(${scale})`}
        >
          {/* Edges first (behind nodes) */}
          {edges.map((edge, idx) => (
            <TreeEdge key={idx} {...edge} />
          ))}

          {/* Nodes as foreignObject for React rendering */}
          {visibleItems.map(({ node, x, y, hasChildren, isCollapsed }) => (
            <foreignObject
              key={node.id}
              x={x}
              y={y}
              width={NODE_WIDTH}
              height={NODE_HEIGHT + 12}
            >
              {/* xmlns is required for SVG foreignObject children when rendered to string. */}
              <div
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore xmlns not in React.HTMLAttributes but required by SVG spec
                xmlns="http://www.w3.org/1999/xhtml"
                data-org-node="true"
                className="relative"
              >
                <OrgNode
                  node={node}
                  isSelected={selectedNode?.id === node.id}
                  onClick={handleNodeClick}
                />
                {hasChildren && (
                  <BranchToggle
                    isCollapsed={isCollapsed}
                    childCount={node.children.length}
                    onToggle={(e) => {
                      e.stopPropagation();
                      toggleExpanded(node.id);
                    }}
                  />
                )}
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
