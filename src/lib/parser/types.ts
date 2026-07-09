export type ColumnType = "text" | "number" | "boolean" | "date" | "json";

export type TableView = "overview" | "data" | "schema" | "diagram";

export interface ColumnDef {
  name: string;
  sqlType: string;
  type: ColumnType;
  references?: {
    tableKey: string;
    column: string;
  };
}

/** Row stored as column-aligned array for memory and speed */
export type TableRow = (string | null)[];

export interface TableSummary {
  key: string;
  schema: string;
  name: string;
  fullName: string;
  rowCount: number;
  columnCount: number;
}

export interface TableData {
  schema: string;
  name: string;
  fullName: string;
  key: string;
  columns: ColumnDef[];
  rows: TableRow[];
  /** Lowercase concatenation of cell values for fast global search */
  searchIndex: string[];
  primaryKeyColumn: string;
  primaryKeyIndex: number;
}

export interface ForeignKeyRelation {
  sourceTableKey: string;
  sourceColumn: string;
  sourceColumnIndex: number;
  targetTableKey: string;
  targetColumn: string;
}

export interface SchemaGraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
}

export interface SchemaGraph {
  edges: SchemaGraphEdge[];
  relationCount: number;
}

export interface RelationIndex {
  relations: ForeignKeyRelation[];
  bySourceColumn: Map<string, Map<string, ForeignKeyRelation>>;
  rowByPk: Map<string, Map<string, number>>;
  graph: SchemaGraph;
}

export interface ParsedDump {
  tables: TableData[];
  summaries: TableSummary[];
  fileName: string;
  totalRows: number;
  relations: RelationIndex;
}

export interface ParseProgress {
  percent: number;
  stage: "reading" | "parsing" | "complete";
  message: string;
}

export interface RelationLookupTarget {
  relation: ForeignKeyRelation;
  value: string;
}
