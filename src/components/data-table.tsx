"use client";

import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, ArrowUpDown, Link2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { RelationCell } from "@/components/relation-cell";
import { RelationModal, type RelationModalEntry } from "@/components/relation-modal";
import { SyncedHorizontalScrollbar } from "@/components/synced-horizontal-scrollbar";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow as UITableRow,
} from "@/components/ui/table";
import { TablePagination, type PageSize } from "@/components/table-pagination";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { ColumnDef, ForeignKeyRelation, TableData, TableRow as DumpTableRow } from "@/lib/parser/types";
import { findRelatedRow } from "@/lib/relations/infer-relations";
import { useDumpStore } from "@/store/dump-store";

interface DataTableProps {
  table: TableData;
}

type SortDirection = "asc" | "desc";

function compareValues(
  left: string | null,
  right: string | null,
  column: ColumnDef,
): number {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;

  if (column.type === "number") {
    const leftNum = Number(left);
    const rightNum = Number(right);
    if (!Number.isNaN(leftNum) && !Number.isNaN(rightNum)) {
      return leftNum - rightNum;
    }
  }

  if (column.type === "boolean") {
    const leftBool = left.toLowerCase() === "t" || left === "true" || left === "1";
    const rightBool = right.toLowerCase() === "t" || right === "true" || right === "1";
    return Number(leftBool) - Number(rightBool);
  }

  if (column.type === "date") {
    const leftTime = Date.parse(left);
    const rightTime = Date.parse(right);
    if (!Number.isNaN(leftTime) && !Number.isNaN(rightTime)) {
      return leftTime - rightTime;
    }
  }

  return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
}

const DataCell = memo(function DataCell({
  value,
  columnType,
  relation,
  onRelationClick,
}: {
  value: string | null;
  columnType?: ColumnDef["type"];
  relation?: ForeignKeyRelation;
  onRelationClick?: (value: string) => void;
}) {
  return (
    <RelationCell
      value={value}
      columnType={columnType}
      relation={relation}
      onRelationClick={onRelationClick}
      className="max-w-xs"
    />
  );
});

function filterRowIndices(table: TableData, query: string): number[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return table.rows.map((_, index) => index);
  }

  const indices: number[] = [];
  const wantsNull = normalized === "null";

  for (let i = 0; i < table.rows.length; i++) {
    if (table.searchIndex[i].includes(normalized)) {
      indices.push(i);
      continue;
    }

    if (wantsNull) {
      const row = table.rows[i];
      for (let j = 0; j < row.length; j++) {
        if (row[j] === null) {
          indices.push(i);
          break;
        }
      }
    }
  }

  return indices;
}

function sortRowIndices(
  table: TableData,
  indices: number[],
  sortColumnIndex: number,
  direction: SortDirection,
  column: ColumnDef,
): number[] {
  const sorted = indices.slice();
  sorted.sort((leftIndex, rightIndex) => {
    const left = table.rows[leftIndex][sortColumnIndex] ?? null;
    const right = table.rows[rightIndex][sortColumnIndex] ?? null;
    const result = compareValues(left, right, column);
    return direction === "asc" ? result : -result;
  });
  return sorted;
}

export function DataTable({ table }: DataTableProps) {
  const relations = useDumpStore((state) => state.dump?.relations);
  const tableMap = useDumpStore((state) => state.tableMap);
  const selectTable = useDumpStore((state) => state.selectTable);

  const [globalFilter, setGlobalFilter] = useState("");
  const [sortColumnIndex, setSortColumnIndex] = useState<number | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(100);
  const [relationModal, setRelationModal] = useState<RelationModalEntry | null>(null);
  const debouncedFilter = useDebouncedValue(globalFilter, 200);
  const deferredFilter = useDeferredValue(debouncedFilter);
  const parentRef = useRef<HTMLDivElement>(null);

  const columnRelations = useMemo(() => {
    return relations?.bySourceColumn.get(table.key) ?? new Map<string, ForeignKeyRelation>();
  }, [relations, table.key]);

  const visibleIndices = useMemo(() => {
    const filtered = filterRowIndices(table, deferredFilter);
    if (sortColumnIndex === null) {
      return filtered;
    }

    const column = table.columns[sortColumnIndex];
    if (!column) return filtered;

    return sortRowIndices(table, filtered, sortColumnIndex, sortDirection, column);
  }, [table, deferredFilter, sortColumnIndex, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(visibleIndices.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const paginatedIndices = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return visibleIndices.slice(start, start + pageSize);
  }, [visibleIndices, safePage, pageSize]);

  useEffect(() => {
    setPage(1);
    parentRef.current?.scrollTo({ top: 0 });
  }, [table.key, deferredFilter, sortColumnIndex, sortDirection, pageSize]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const openRelation = useCallback(
    (columnName: string, value: string) => {
      if (!relations) return;

      const relation = columnRelations.get(columnName);
      if (!relation) return;

      const match = findRelatedRow(
        relations,
        tableMap,
        table.key,
        columnName,
        value,
      );

      setRelationModal({
        sourceLabel: `${table.fullName}.${columnName}`,
        relationLabel: columnName,
        targetTable: match?.table ?? tableMap.get(relation.targetTableKey) ?? null,
        rowIndex: match?.rowIndex ?? null,
      });
    },
    [columnRelations, relations, table.key, table.fullName, tableMap],
  );

  const rowVirtualizer = useVirtualizer({
    count: paginatedIndices.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 16,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end
      : 0;

  const toggleSort = (columnIndex: number) => {
    if (sortColumnIndex === columnIndex) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortColumnIndex(columnIndex);
    setSortDirection("asc");
  };

  return (
    <>
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex shrink-0 flex-col gap-4 p-4 md:p-6 md:pb-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">{table.fullName}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="secondary">
                  {table.rows.length.toLocaleString()} filas totales
                </Badge>
                <Badge variant="outline">
                  {visibleIndices.length.toLocaleString()} filas visibles
                </Badge>
                <Badge variant="outline">{table.columns.length} columnas</Badge>
                {columnRelations.size > 0 && (
                  <Badge variant="outline">{columnRelations.size} relaciones</Badge>
                )}
              </div>
            </div>

            <div className="relative w-full md:max-w-sm">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={globalFilter}
                onChange={(event) => setGlobalFilter(event.target.value)}
                placeholder="Buscar en todas las columnas..."
                className="pl-9"
              />
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col border-y">
          <div ref={parentRef} className="min-h-0 flex-1 overflow-y-auto overflow-x-auto">
            <table className="min-w-max w-full caption-bottom text-sm">
            <TableHeader className="sticky top-0 z-10 bg-background shadow-sm">
              <UITableRow>
                {table.columns.map((column, columnIndex) => {
                  const isSorted = sortColumnIndex === columnIndex;
                  const hasRelation = columnRelations.has(column.name);

                  return (
                    <TableHead key={column.name} className="min-w-36 whitespace-nowrap">
                      <button
                        type="button"
                        className="flex items-center gap-2 text-left"
                        onClick={() => toggleSort(columnIndex)}
                      >
                        <span>{column.name}</span>
                        {hasRelation && (
                          <Link2 className="size-3 text-primary" aria-hidden />
                        )}
                        <Badge variant="outline" className="font-normal">
                          {column.type}
                        </Badge>
                        {isSorted ? (
                          sortDirection === "asc" ? (
                            <ArrowUp className="size-4" />
                          ) : (
                            <ArrowDown className="size-4" />
                          )
                        ) : (
                          <ArrowUpDown className="size-4 text-muted-foreground" />
                        )}
                      </button>
                    </TableHead>
                  );
                })}
              </UITableRow>
            </TableHeader>
            <TableBody>
              {paginatedIndices.length === 0 ? (
                <UITableRow>
                  <TableCell
                    colSpan={table.columns.length}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No hay filas que coincidan con la búsqueda.
                  </TableCell>
                </UITableRow>
              ) : (
                <>
                  {paddingTop > 0 && (
                    <UITableRow aria-hidden>
                      <TableCell
                        colSpan={table.columns.length}
                        style={{ height: `${paddingTop}px` }}
                      />
                    </UITableRow>
                  )}
                  {virtualRows.map((virtualRow) => {
                    const rowIndex = paginatedIndices[virtualRow.index];
                    const row: DumpTableRow = table.rows[rowIndex];

                    return (
                      <UITableRow key={rowIndex} data-index={virtualRow.index}>
                        {table.columns.map((column, columnIndex) => (
                          <TableCell key={column.name} className="min-w-36">
                            <DataCell
                              value={row[columnIndex] ?? null}
                              columnType={column.type}
                              relation={columnRelations.get(column.name)}
                              onRelationClick={(value) => openRelation(column.name, value)}
                            />
                          </TableCell>
                        ))}
                      </UITableRow>
                    );
                  })}
                  {paddingBottom > 0 && (
                    <UITableRow aria-hidden>
                      <TableCell
                        colSpan={table.columns.length}
                        style={{ height: `${paddingBottom}px` }}
                      />
                    </UITableRow>
                  )}
                </>
              )}
            </TableBody>
            </table>
          </div>

          <SyncedHorizontalScrollbar targetRef={parentRef} />
        </div>

        <TablePagination
          page={safePage}
          pageSize={pageSize}
          totalItems={visibleIndices.length}
          onPageChange={(nextPage) => {
            setPage(nextPage);
            parentRef.current?.scrollTo({ top: 0 });
          }}
          onPageSizeChange={(nextPageSize) => {
            setPageSize(nextPageSize);
            setPage(1);
          }}
        />
      </div>

      <RelationModal
        open={relationModal !== null}
        onOpenChange={(open) => {
          if (!open) setRelationModal(null);
        }}
        entry={relationModal}
        relations={relations}
        tableMap={tableMap}
        onOpenTable={selectTable}
      />
    </>
  );
}
