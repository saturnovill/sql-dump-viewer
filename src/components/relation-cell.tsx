"use client";

import { Link2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ColumnType, ForeignKeyRelation } from "@/lib/parser/types";
import { cn } from "@/lib/utils";

interface RelationCellProps {
  value: string | null;
  columnType?: ColumnType;
  relation?: ForeignKeyRelation;
  onRelationClick?: (value: string) => void;
  maxLength?: number;
  className?: string;
}

function parseBoolean(value: string): boolean | null {
  const normalized = value.toLowerCase();
  if (normalized === "t" || normalized === "true" || normalized === "1") {
    return true;
  }
  if (normalized === "f" || normalized === "false" || normalized === "0") {
    return false;
  }
  return null;
}

function formatText(value: string, maxLength: number): string {
  if (value.length > maxLength) {
    return `${value.slice(0, maxLength)}…`;
  }
  return value;
}

function NilBadge() {
  return (
    <Badge
      variant="outline"
      className="border-muted-foreground/20 bg-muted font-mono text-xs text-muted-foreground"
    >
      nil
    </Badge>
  );
}

function BooleanBadge({ value }: { value: string }) {
  const parsed = parseBoolean(value);

  if (parsed === true) {
    return (
      <Badge className="border-transparent bg-emerald-600 font-mono text-xs text-white hover:bg-emerald-600">
        true
      </Badge>
    );
  }

  if (parsed === false) {
    return (
      <Badge className="border-transparent bg-red-600 font-mono text-xs text-white hover:bg-red-600">
        false
      </Badge>
    );
  }

  return <span className="font-mono text-xs">{value}</span>;
}

export function RelationCell({
  value,
  columnType,
  relation,
  onRelationClick,
  maxLength = 200,
  className,
}: RelationCellProps) {
  if (value === null) {
    return <NilBadge />;
  }

  if (columnType === "boolean") {
    return <BooleanBadge value={value} />;
  }

  const isClickable = relation && onRelationClick;

  if (isClickable) {
    return (
      <button
        type="button"
        onClick={() => onRelationClick(value)}
        className={cn(
          "inline-flex max-w-full items-center gap-1 truncate rounded px-1 py-0.5 font-mono text-xs text-primary underline-offset-2 hover:bg-primary/10 hover:underline",
          className,
        )}
        title={`Ver ${relation.targetTableKey} #${value}`}
      >
        <Link2 className="size-3 shrink-0" />
        {formatText(value, maxLength)}
      </button>
    );
  }

  return (
    <span
      className={cn("block max-w-full truncate font-mono text-xs break-all", className)}
      title={value}
    >
      {formatText(value, maxLength)}
    </span>
  );
}
