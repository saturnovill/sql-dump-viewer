"use client";

import { useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ColumnDef, TableData } from "@/lib/parser/types";

interface SchemaViewProps {
  table: TableData;
}

export function SchemaView({ table }: SchemaViewProps) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-4 md:p-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{table.fullName}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Esquema de columnas inferido del dump
        </p>
      </div>

      <div className="overflow-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Columna</TableHead>
              <TableHead>Tipo SQL</TableHead>
              <TableHead>Tipo inferido</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {table.columns.map((column: ColumnDef, index) => (
              <TableRow key={column.name}>
                <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                <TableCell className="font-medium">{column.name}</TableCell>
                <TableCell className="font-mono text-xs">{column.sqlType}</TableCell>
                <TableCell>
                  <Badge variant="outline">{column.type}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

interface OverviewViewProps {
  summaries: {
    key: string;
    fullName: string;
    rowCount: number;
    columnCount: number;
  }[];
  totalRows: number;
  fileName: string;
  onSelectTable: (key: string) => void;
}

export function OverviewView({
  summaries,
  totalRows,
  fileName,
  onSelectTable,
}: OverviewViewProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const sortedByRows = useMemo(
    () => [...summaries].sort((a, b) => b.rowCount - a.rowCount),
    [summaries],
  );

  const virtualizer = useVirtualizer({
    count: sortedByRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44,
    overscan: 12,
  });

  const items = virtualizer.getVirtualItems();
  const largestTable = sortedByRows[0];

  return (
    <div className="flex h-full min-h-0 flex-col gap-6 p-4 md:p-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Resumen del dump</h2>
        <p className="mt-1 text-sm text-muted-foreground">{fileName}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Tablas" value={summaries.length.toLocaleString()} />
        <StatCard label="Filas totales" value={totalRows.toLocaleString()} />
        <StatCard
          label="Tabla más grande"
          value={largestTable?.fullName ?? "—"}
          subtitle={
            largestTable ? `${largestTable.rowCount.toLocaleString()} filas` : undefined
          }
        />
        <StatCard
          label="Promedio filas/tabla"
          value={
            summaries.length > 0
              ? Math.round(totalRows / summaries.length).toLocaleString()
              : "0"
          }
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <h3 className="text-sm font-medium text-muted-foreground">
          Tablas ordenadas por volumen de datos
        </h3>
        <div ref={parentRef} className="min-h-0 flex-1 overflow-auto rounded-xl border">
          <div
            className="relative w-full"
            style={{ height: `${virtualizer.getTotalSize()}px` }}
          >
            {items.map((item) => {
              const table = sortedByRows[item.index];
              return (
                <button
                  key={table.key}
                  type="button"
                  onClick={() => onSelectTable(table.key)}
                  className="absolute top-0 left-0 flex w-full items-center justify-between border-b px-4 py-3 text-left transition-colors hover:bg-muted/50"
                  style={{ transform: `translateY(${item.start}px)`, height: `${item.size}px` }}
                >
                  <span className="truncate font-medium">{table.fullName}</span>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="secondary">
                      {table.rowCount.toLocaleString()} filas
                    </Badge>
                    <Badge variant="outline">{table.columnCount} cols</Badge>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 truncate text-lg font-semibold">{value}</p>
      {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
