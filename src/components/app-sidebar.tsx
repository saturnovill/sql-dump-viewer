"use client";

import { useMemo, useState } from "react";
import { Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VirtualTableList } from "@/components/virtual-table-list";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useDumpStore } from "@/store/dump-store";

interface AppSidebarProps {
  onLoadAnother: () => void;
}

export function AppSidebar({ onLoadAnother }: AppSidebarProps) {
  const dump = useDumpStore((state) => state.dump);
  const selectedTableKey = useDumpStore((state) => state.selectedTableKey);
  const selectTable = useDumpStore((state) => state.selectTable);
  const [filter, setFilter] = useState("");
  const debouncedFilter = useDebouncedValue(filter, 150);

  const tables = useMemo(() => {
    if (!dump) return [];

    const query = debouncedFilter.trim().toLowerCase();
    if (!query) return dump.summaries;

    return dump.summaries.filter((table) =>
      table.fullName.toLowerCase().includes(query),
    );
  }, [dump, debouncedFilter]);

  if (!dump) return null;

  return (
    <aside className="flex h-svh w-72 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="shrink-0 border-b border-sidebar-border p-3">
        <p className="text-sm font-semibold">SQL Dump Viewer</p>
        <p className="truncate text-xs text-muted-foreground" title={dump.fileName}>
          {dump.fileName}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge variant="secondary">{dump.tables.length} tablas</Badge>
          <Badge variant="outline">{dump.totalRows.toLocaleString()} filas</Badge>
        </div>
      </div>

      <div className="shrink-0 border-b border-sidebar-border p-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Tablas
        </p>
        <Input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Buscar tabla..."
          className="h-8 bg-background"
        />
        {debouncedFilter && (
          <p className="mt-1.5 text-xs text-muted-foreground">
            {tables.length} coincidencias
          </p>
        )}
      </div>

      <VirtualTableList
        tables={tables}
        selectedKey={selectedTableKey}
        onSelect={selectTable}
      />

      <div className="shrink-0 border-t border-sidebar-border p-3">
        <Button variant="outline" className="w-full justify-start" onClick={onLoadAnother}>
          <Upload className="size-4" />
          Cargar otro dump
        </Button>
      </div>
    </aside>
  );
}
