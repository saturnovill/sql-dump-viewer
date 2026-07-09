"use client";

import { useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import dagre from "@dagrejs/dagre";
import "@xyflow/react/dist/style.css";
import { Badge } from "@/components/ui/badge";
import type { ParsedDump } from "@/lib/parser/types";
import { useDumpStore } from "@/store/dump-store";

interface SchemaGraphViewProps {
  dump: ParsedDump;
}

interface TableNodeData extends Record<string, unknown> {
  label: string;
  rows: number;
  columns: number;
}

function TableNode({ data }: NodeProps) {
  const nodeData = data as TableNodeData;
  return (
    <div className="rounded-xl border bg-card px-3 py-2 shadow-sm">
      <Handle type="target" position={Position.Left} className="!bg-primary" />
      <p className="truncate text-sm font-medium">{nodeData.label}</p>
      <p className="text-xs text-muted-foreground">
        {nodeData.rows.toLocaleString()} filas · {nodeData.columns} cols
      </p>
      <Handle type="source" position={Position.Right} className="!bg-primary" />
    </div>
  );
}

const NODE_WIDTH = 200;
const NODE_HEIGHT = 72;

const nodeTypes = { tableNode: TableNode };

function layoutGraph(nodes: Node[], edges: Edge[]): Node[] {
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({ rankdir: "LR", nodesep: 70, ranksep: 110 });

  for (const node of nodes) {
    graph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  for (const edge of edges) {
    graph.setEdge(edge.source, edge.target);
  }

  dagre.layout(graph);

  return nodes.map((node) => {
    const positioned = graph.node(node.id);
    return {
      ...node,
      position: {
        x: positioned.x - NODE_WIDTH / 2,
        y: positioned.y - NODE_HEIGHT / 2,
      },
    };
  });
}

export function SchemaGraphView({ dump }: SchemaGraphViewProps) {
  const selectTable = useDumpStore((state) => state.selectTable);
  const setActiveView = useDumpStore((state) => state.setActiveView);
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const colorMode = mounted && resolvedTheme === "dark" ? "dark" : "light";

  const minimapColors = useMemo(
    () =>
      colorMode === "dark"
        ? {
            bgColor: "var(--card)",
            maskColor: "color-mix(in oklch, var(--background) 50%, transparent)",
            nodeColor: "oklch(0.75 0 0)",
            nodeStrokeColor: "var(--border)",
            maskStrokeColor: "var(--border)",
          }
        : {
            bgColor: "var(--muted)",
            maskColor: "color-mix(in oklch, var(--foreground) 10%, transparent)",
            nodeColor: "var(--foreground)",
            nodeStrokeColor: "var(--border)",
            maskStrokeColor: "var(--border)",
          },
    [colorMode],
  );

  const { nodes, edges } = useMemo(() => {
    const baseNodes: Node[] = dump.tables.map((table) => ({
      id: table.key,
      type: "tableNode",
      data: {
        label: table.fullName,
        rows: table.rows.length,
        columns: table.columns.length,
      },
      position: { x: 0, y: 0 },
    }));

    const baseEdges: Edge[] = dump.relations.graph.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed },
    }));

    const layoutedNodes = layoutGraph(baseNodes, baseEdges);

    return { nodes: layoutedNodes, edges: baseEdges };
  }, [dump]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-4 md:p-6">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Diagrama del esquema</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Relaciones inferidas entre tablas. Haz clic en un nodo para abrir sus datos.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{dump.tables.length} tablas</Badge>
          <Badge variant="outline">
            {dump.relations.graph.relationCount} relaciones
          </Badge>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border bg-muted/20">
        {dump.relations.graph.relationCount === 0 ? (
          <div className="flex h-full items-center justify-center p-8 text-center text-muted-foreground">
            No se detectaron relaciones. Se infieren columnas que terminan en{" "}
            <code className="mx-1 rounded bg-muted px-1">_id</code> o claves foráneas
            declaradas en el dump.
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            colorMode={colorMode}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            nodesDraggable
            nodesConnectable={false}
            elementsSelectable
            onNodeClick={(_event, node) => {
              selectTable(node.id);
              setActiveView("data");
            }}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={16} size={1} color="var(--border)" />
            <Controls className="!shadow-md" />
            <MiniMap
              pannable
              zoomable
              className="!rounded-lg !border !border-border !shadow-sm"
              bgColor={minimapColors.bgColor}
              maskColor={minimapColors.maskColor}
              maskStrokeColor={minimapColors.maskStrokeColor}
              maskStrokeWidth={1}
              nodeColor={minimapColors.nodeColor}
              nodeStrokeColor={minimapColors.nodeStrokeColor}
              nodeStrokeWidth={1}
            />
          </ReactFlow>
        )}
      </div>
    </div>
  );
}
