"use client";

import { memo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Table2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TableSummary } from "@/lib/parser/types";

interface VirtualTableListProps {
  tables: TableSummary[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
}

const TableListItem = memo(function TableListItem({
  table,
  isActive,
  onSelect,
}: {
  table: TableSummary;
  isActive: boolean;
  onSelect: (key: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(table.key)}
      title={table.fullName}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground hover:bg-sidebar-accent/60",
      )}
    >
      <Table2 className="size-4 shrink-0 opacity-70" />
      <span className="min-w-0 flex-1 truncate">{table.fullName}</span>
      <span
        className={cn(
          "shrink-0 rounded px-1.5 py-0.5 text-xs tabular-nums",
          isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
        )}
      >
        {table.rowCount.toLocaleString()}
      </span>
    </button>
  );
});

export function VirtualTableList({
  tables,
  selectedKey,
  onSelect,
}: VirtualTableListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: tables.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 16,
  });

  const items = virtualizer.getVirtualItems();

  return (
    <div ref={parentRef} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
      <div
        className="relative w-full px-2"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {items.map((item) => {
          const table = tables[item.index];
          return (
            <div
              key={table.key}
              className="absolute top-0 left-0 w-full px-0"
              style={{ transform: `translateY(${item.start}px)` }}
            >
              <TableListItem
                table={table}
                isActive={table.key === selectedKey}
                onSelect={onSelect}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
