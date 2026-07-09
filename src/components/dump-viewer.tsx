"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { DataTable } from "@/components/data-table";
import { SchemaGraphView } from "@/components/schema-graph-view";
import { OverviewView, SchemaView } from "@/components/table-views";
import { UploadDropzone } from "@/components/upload-dropzone";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";
import type { TableView } from "@/lib/parser/types";
import { cn } from "@/lib/utils";
import { useDumpStore, useSelectedTable } from "@/store/dump-store";

const VIEW_OPTIONS: { id: TableView; label: string }[] = [
  { id: "overview", label: "Resumen" },
  { id: "diagram", label: "Diagrama" },
  { id: "data", label: "Datos" },
  { id: "schema", label: "Esquema" },
];

export function DumpViewer() {
  const dump = useDumpStore((state) => state.dump);
  const activeView = useDumpStore((state) => state.activeView);
  const setActiveView = useDumpStore((state) => state.setActiveView);
  const selectTable = useDumpStore((state) => state.selectTable);
  const clearDump = useDumpStore((state) => state.clearDump);
  const selectedTable = useSelectedTable();

  if (!dump) {
    return <UploadDropzone />;
  }

  return (
    <div className="flex h-svh w-full overflow-hidden bg-background">
      <AppSidebar onLoadAnother={clearDump} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{dump.fileName}</p>
            <p className="truncate text-xs text-muted-foreground">
              {dump.tables.length} tablas · {dump.totalRows.toLocaleString()} filas
            </p>
          </div>

          <Separator orientation="vertical" className="hidden h-6 sm:block" />

          <ThemeToggle />

          <nav className="flex items-center gap-1">
            {VIEW_OPTIONS.map((option) => (
              <Button
                key={option.id}
                type="button"
                size="sm"
                variant={activeView === option.id ? "default" : "ghost"}
                className={cn("h-8")}
                onClick={() => setActiveView(option.id)}
              >
                {option.label}
              </Button>
            ))}
          </nav>
        </header>

        <main className="min-h-0 flex-1 overflow-hidden p-4">
          <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
          {activeView === "overview" && (
            <OverviewView
              summaries={dump.summaries}
              totalRows={dump.totalRows}
              fileName={dump.fileName}
              onSelectTable={selectTable}
            />
          )}

          {activeView === "diagram" && <SchemaGraphView dump={dump} />}

          {activeView === "data" && selectedTable && <DataTable table={selectedTable} />}

          {activeView === "data" && !selectedTable && (
            <EmptyState message="Selecciona una tabla en el panel lateral." />
          )}

          {activeView === "schema" && selectedTable && <SchemaView table={selectedTable} />}

          {activeView === "schema" && !selectedTable && (
            <EmptyState message="Selecciona una tabla para ver su esquema." />
          )}
          </div>
        </main>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center text-muted-foreground">
      {message}
    </div>
  );
}
