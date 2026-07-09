import type {
  ForeignKeyRelation,
  RelationIndex,
  SchemaGraph,
  TableData,
} from "@/lib/parser/types";

function tableNameCandidates(baseName: string): string[] {
  const base = baseName.toLowerCase();
  const candidates = new Set<string>([base, `${base}s`, `${base}es`]);

  if (base.endsWith("y") && base.length > 1) {
    candidates.add(`${base.slice(0, -1)}ies`);
  }

  if (base.endsWith("s") || base.endsWith("x") || base.endsWith("z")) {
    candidates.add(`${base}es`);
  }

  return Array.from(candidates);
}

function resolveTableKey(
  baseName: string,
  tablesByName: Map<string, string>,
): string | null {
  for (const candidate of tableNameCandidates(baseName)) {
    const match = tablesByName.get(candidate);
    if (match) {
      return match;
    }
  }
  return null;
}

function detectPrimaryKey(table: TableData): { name: string; index: number } {
  const idIndex = table.columns.findIndex((column) => column.name.toLowerCase() === "id");
  if (idIndex >= 0) {
    return { name: table.columns[idIndex].name, index: idIndex };
  }

  return {
    name: table.columns[0]?.name ?? "id",
    index: 0,
  };
}

function buildRowLookup(tables: TableData[]): Map<string, Map<string, number>> {
  const rowByPk = new Map<string, Map<string, number>>();

  for (const table of tables) {
    const pkIndex = table.primaryKeyIndex;
    const lookup = new Map<string, number>();

    for (let rowIndex = 0; rowIndex < table.rows.length; rowIndex++) {
      const pkValue = table.rows[rowIndex][pkIndex];
      if (pkValue !== null && pkValue !== "") {
        lookup.set(pkValue, rowIndex);
      }
    }

    rowByPk.set(table.key, lookup);
  }

  return rowByPk;
}

function inferRelations(tables: TableData[]): ForeignKeyRelation[] {
  const tablesByName = new Map<string, string>();
  for (const table of tables) {
    tablesByName.set(table.name.toLowerCase(), table.key);
    tablesByName.set(table.fullName.toLowerCase(), table.key);
  }

  const relations: ForeignKeyRelation[] = [];
  const seen = new Set<string>();

  for (const table of tables) {
    for (let columnIndex = 0; columnIndex < table.columns.length; columnIndex++) {
      const column = table.columns[columnIndex];
      let targetTableKey: string | null = null;
      let targetColumn = "id";

      if (column.references) {
        targetTableKey = column.references.tableKey;
        targetColumn = column.references.column;
      } else if (column.name.toLowerCase().endsWith("_id")) {
        const baseName = column.name.slice(0, -3);
        targetTableKey = resolveTableKey(baseName, tablesByName);
      }

      if (!targetTableKey || targetTableKey === table.key) {
        continue;
      }

      const targetTable = tables.find((item) => item.key === targetTableKey);
      if (!targetTable) continue;

      targetColumn = targetTable.primaryKeyColumn;
      const dedupeKey = `${table.key}:${column.name}:${targetTableKey}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      relations.push({
        sourceTableKey: table.key,
        sourceColumn: column.name,
        sourceColumnIndex: columnIndex,
        targetTableKey,
        targetColumn,
      });
    }
  }

  return relations;
}

function buildGraph(relations: ForeignKeyRelation[]): SchemaGraph {
  const edges = relations.map((relation) => ({
    id: `${relation.sourceTableKey}.${relation.sourceColumn}->${relation.targetTableKey}`,
    source: relation.sourceTableKey,
    target: relation.targetTableKey,
    label: relation.sourceColumn,
  }));

  return {
    edges,
    relationCount: relations.length,
  };
}

export function buildRelationIndex(tables: TableData[]): RelationIndex {
  const relations = inferRelations(tables);
  const bySourceColumn = new Map<string, Map<string, ForeignKeyRelation>>();

  for (const relation of relations) {
    const tableRelations =
      bySourceColumn.get(relation.sourceTableKey) ?? new Map<string, ForeignKeyRelation>();
    tableRelations.set(relation.sourceColumn, relation);
    bySourceColumn.set(relation.sourceTableKey, tableRelations);
  }

  return {
    relations,
    bySourceColumn,
    rowByPk: buildRowLookup(tables),
    graph: buildGraph(relations),
  };
}

export function applyPrimaryKeysAndRelations(tables: TableData[]): {
  tables: TableData[];
  relations: RelationIndex;
} {
  const tablesWithPk = tables.map((table) => {
    const primaryKey = detectPrimaryKey(table);
    return {
      ...table,
      primaryKeyColumn: primaryKey.name,
      primaryKeyIndex: primaryKey.index,
    };
  });

  const relations = buildRelationIndex(tablesWithPk);

  return {
    tables: tablesWithPk,
    relations,
  };
}

export function findRelatedRow(
  relations: RelationIndex,
  tableMap: Map<string, TableData>,
  sourceTableKey: string,
  sourceColumn: string,
  value: string | null,
): { table: TableData; rowIndex: number } | null {
  if (value === null || value === "") {
    return null;
  }

  const relation = relations.bySourceColumn.get(sourceTableKey)?.get(sourceColumn);
  if (!relation) {
    return null;
  }

  const targetTable = tableMap.get(relation.targetTableKey);
  if (!targetTable) {
    return null;
  }

  const rowIndex = relations.rowByPk.get(relation.targetTableKey)?.get(value);
  if (rowIndex === undefined) {
    return null;
  }

  return { table: targetTable, rowIndex };
}
