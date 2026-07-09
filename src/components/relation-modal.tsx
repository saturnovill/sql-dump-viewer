"use client";

import { ChevronLeft, ExternalLink } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { RelationCell } from "@/components/relation-cell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ForeignKeyRelation, RelationIndex, TableData } from "@/lib/parser/types";
import { findRelatedRow } from "@/lib/relations/infer-relations";

export interface RelationModalEntry {
  sourceLabel: string;
  relationLabel: string;
  targetTable: TableData | null;
  rowIndex: number | null;
}

interface RelationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: RelationModalEntry | null;
  relations?: RelationIndex;
  tableMap: Map<string, TableData>;
  onOpenTable?: (tableKey: string) => void;
}

export function RelationModal({
  open,
  onOpenChange,
  entry,
  relations,
  tableMap,
  onOpenTable,
}: RelationModalProps) {
  const [stack, setStack] = useState<RelationModalEntry[]>([]);

  useEffect(() => {
    if (open && entry) {
      setStack([entry]);
    }
    if (!open) {
      setStack([]);
    }
  }, [open, entry]);

  const current = stack[stack.length - 1];
  const row =
    current?.targetTable && current.rowIndex !== null
      ? current.targetTable.rows[current.rowIndex]
      : null;
  const notFound = open && current?.targetTable && current.rowIndex === null;

  const columnRelations = useMemo(() => {
    if (!current?.targetTable || !relations) {
      return new Map<string, ForeignKeyRelation>();
    }
    return relations.bySourceColumn.get(current.targetTable.key) ?? new Map();
  }, [current?.targetTable, relations]);

  const navigateRelation = (columnName: string, value: string) => {
    if (!relations || !current?.targetTable) return;

    const relation = columnRelations.get(columnName);
    if (!relation) return;

    const match = findRelatedRow(
      relations,
      tableMap,
      current.targetTable.key,
      columnName,
      value,
    );

    setStack((previous) => [
      ...previous,
      {
        sourceLabel: `${current.targetTable!.fullName}.${columnName}`,
        relationLabel: columnName,
        targetTable: match?.table ?? tableMap.get(relation.targetTableKey) ?? null,
        rowIndex: match?.rowIndex ?? null,
      },
    ]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,720px)] w-[calc(100%-2rem)] max-w-xl flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <div className="shrink-0 space-y-3 border-b px-4 py-4 pr-12">
          <DialogHeader className="gap-1">
            <DialogTitle>Registro relacionado</DialogTitle>
            <DialogDescription className="break-all">
              {current?.sourceLabel}
              {current?.targetTable ? ` → ${current.targetTable.fullName}` : ""}
            </DialogDescription>
          </DialogHeader>

          {stack.length > 1 && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 w-fit justify-start px-0"
              onClick={() => setStack((previous) => previous.slice(0, -1))}
            >
              <ChevronLeft className="size-4" />
              Volver al registro anterior
            </Button>
          )}

          {current?.targetTable && row && (
            <div className="flex items-center justify-between gap-2">
              <Badge variant="secondary">{current.targetTable.fullName}</Badge>
              {onOpenTable && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onOpenTable(current.targetTable!.key);
                    onOpenChange(false);
                  }}
                >
                  <ExternalLink className="size-4" />
                  Abrir tabla
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {notFound && current.targetTable && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              No se encontró un registro en {current.targetTable.fullName} con ese identificador.
            </p>
          )}

          {current?.targetTable && row && (
            <div className="overflow-hidden rounded-lg border">
              <dl className="divide-y">
                {current.targetTable.columns.map((column, index) => {
                  const value = row[index];
                  const relation = columnRelations.get(column.name);

                  return (
                    <div
                      key={column.name}
                      className="grid grid-cols-[minmax(8rem,38%)_1fr] gap-3 px-4 py-3"
                    >
                      <dt className="text-xs font-medium text-muted-foreground">
                        {column.name}
                      </dt>
                      <dd className="min-w-0">
                        <RelationCell
                          value={value}
                          columnType={column.type}
                          relation={relation}
                          onRelationClick={(nextValue) =>
                            navigateRelation(column.name, nextValue)
                          }
                          maxLength={1000}
                        />
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
