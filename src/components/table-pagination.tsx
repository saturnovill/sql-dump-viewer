"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const PAGE_SIZE_OPTIONS = [50, 100, 250, 500, 1000] as const;

export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

interface TablePaginationProps {
  page: number;
  pageSize: PageSize;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: PageSize) => void;
}

export function TablePagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
}: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);
  const rangeStart = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(safePage * pageSize, totalItems);

  return (
    <div className="flex shrink-0 flex-col gap-3 border-t bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        Mostrando {rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()} de{" "}
        {totalItems.toLocaleString()} filas
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Por página
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value) as PageSize)}
            className="h-8 rounded-md border bg-background px-2 text-sm text-foreground"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={safePage <= 1}
            onClick={() => onPageChange(safePage - 1)}
          >
            <ChevronLeft className="size-4" />
            Anterior
          </Button>
          <span className="min-w-24 text-center text-sm tabular-nums">
            Página {safePage} / {totalPages}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(safePage + 1)}
          >
            Siguiente
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export { PAGE_SIZE_OPTIONS };
