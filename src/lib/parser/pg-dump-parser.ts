import type {
  ColumnDef,
  ColumnType,
  ParsedDump,
  TableData,
  TableRow,
  TableSummary,
} from "./types";
import { applyPrimaryKeysAndRelations } from "@/lib/relations/infer-relations";

const CREATE_TABLE_RE =
  /^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?((?:"[^"]+"|\w+)(?:\s*\.\s*(?:"[^"]+"|\w+))?)\s*\(/i;

const COPY_RE =
  /^COPY\s+(?:ONLY\s+)?((?:"[^"]+"|\w+)(?:\s*\.\s*(?:"[^"]+"|\w+))?)\s*(?:\(([^)]+)\))?\s+FROM\s+stdin;/i;

const INSERT_RE =
  /^INSERT\s+INTO\s+(?:ONLY\s+)?((?:"[^"]+"|\w+)(?:\s*\.\s*(?:"[^"]+"|\w+))?)\s*(?:\(([^)]+)\))?\s+VALUES\s+/i;

const COPY_END_RE = /^\\\.\s*$/;

function unquoteIdentifier(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/""/g, '"');
  }
  return trimmed;
}

function parseQualifiedName(qualified: string): {
  schema: string;
  name: string;
  key: string;
  fullName: string;
} {
  const parts = qualified
    .split(".")
    .map((part) => unquoteIdentifier(part.trim()))
    .filter(Boolean);

  const schema = parts.length >= 2 ? parts[0] : "public";
  const name = parts.length >= 2 ? parts[1] : (parts[0] ?? qualified);
  const key = `${schema}.${name}`;
  const fullName = schema === "public" ? name : key;

  return { schema, name, key, fullName };
}

function inferColumnType(sqlType: string): ColumnType {
  const normalized = sqlType.toLowerCase().replace(/\s+/g, " ").trim();

  if (
    /\b(bigint|integer|int|smallint|serial|bigserial|numeric|decimal|real|double precision|float|money)\b/.test(
      normalized,
    )
  ) {
    return "number";
  }

  if (/\bboolean\b/.test(normalized)) {
    return "boolean";
  }

  if (/\b(timestamp|timestamptz|date|time|timetz|interval)\b/.test(normalized)) {
    return "date";
  }

  if (/\b(jsonb?|uuid)\b/.test(normalized)) {
    return "json";
  }

  return "text";
}

function parseColumnDefinitions(definitions: string): ColumnDef[] {
  const columns: ColumnDef[] = [];
  const parts = splitByCommaOutsideParens(definitions);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const upper = trimmed.toUpperCase();
    if (
      upper.startsWith("CONSTRAINT ") ||
      upper.startsWith("PRIMARY KEY") ||
      upper.startsWith("UNIQUE") ||
      upper.startsWith("CHECK") ||
      upper.startsWith("FOREIGN KEY") ||
      upper.startsWith("EXCLUDE")
    ) {
      continue;
    }

    const match = trimmed.match(/^"([^"]+)"\s+(.+)$|^(\w+)\s+(.+)$/i);
    if (!match) continue;

    const name = match[1] ?? match[3];
    let sqlType = (match[2] ?? match[4]).trim();

    let references: ColumnDef["references"];
    const referencesMatch = sqlType.match(
      /\s+REFERENCES\s+((?:"[^"]+"|\w+)(?:\s*\.\s*(?:"[^"]+"|\w+))?)\s*\(\s*("?)(\w+)\3\s*\)/i,
    );
    if (referencesMatch) {
      const qualified = referencesMatch[1].replace(/\s+/g, "");
      const parts = qualified.split(".");
      const schema = parts.length >= 2 ? unquoteIdentifier(parts[0]) : "public";
      const tableName = unquoteIdentifier(parts.length >= 2 ? parts[1] : parts[0]);
      references = {
        tableKey: `${schema}.${tableName}`,
        column: referencesMatch[4],
      };
    }

    sqlType = sqlType
      .replace(/\s+NOT\s+NULL.*$/i, "")
      .replace(/\s+NULL.*$/i, "")
      .replace(/\s+DEFAULT\s+.*$/i, "")
      .replace(/\s+REFERENCES\s+.*$/i, "")
      .replace(/\s+CHECK\s*\(.*$/i, "")
      .replace(/\s+COLLATE\s+\S+/i, "")
      .trim();

    columns.push({
      name: unquoteIdentifier(name),
      sqlType,
      type: inferColumnType(sqlType),
      references,
    });
  }

  return columns;
}

function splitByCommaOutsideParens(value: string): string[] {
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    const prev = value[i - 1];

    if (char === "'" && prev !== "\\" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
    } else if (char === '"' && prev !== "\\" && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
    }

    if (!inSingleQuote && !inDoubleQuote) {
      if (char === "(") depth++;
      if (char === ")") depth = Math.max(0, depth - 1);
      if (char === "," && depth === 0) {
        parts.push(current);
        current = "";
        continue;
      }
    }

    current += char;
  }

  if (current.trim()) {
    parts.push(current);
  }

  return parts;
}

function splitCopyFields(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let escaping = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }

    if (char === "\\") {
      current += char;
      escaping = true;
      continue;
    }

    if (char === "\t") {
      fields.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  fields.push(current);
  return fields;
}

function unescapeCopyField(field: string): string | null {
  if (field === "\\N") {
    return null;
  }

  let result = "";
  for (let i = 0; i < field.length; i++) {
    const char = field[i];

    if (char !== "\\" || i + 1 >= field.length) {
      result += char;
      continue;
    }

    const next = field[++i];
    switch (next) {
      case "b":
        result += "\b";
        break;
      case "f":
        result += "\f";
        break;
      case "n":
        result += "\n";
        break;
      case "r":
        result += "\r";
        break;
      case "t":
        result += "\t";
        break;
      case "v":
        result += "\v";
        break;
      case "\\":
        result += "\\";
        break;
      default: {
        if (/[0-7]/.test(next)) {
          const octal = field.slice(i, i + 3);
          const match = octal.match(/^[0-7]{1,3}/);
          if (match) {
            result += String.fromCharCode(parseInt(match[0], 8));
            i += match[0].length - 1;
            break;
          }
        }
        result += next;
      }
    }
  }

  return result;
}

function parseInsertValues(valuesPart: string): (string | null)[] {
  const values: (string | null)[] = [];
  let current = "";
  let inSingleQuote = false;
  let depth = 0;

  const trimmed = valuesPart.trim().replace(/;\s*$/, "");

  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];
    const prev = trimmed[i - 1];

    if (char === "'" && prev !== "\\" && depth === 0) {
      inSingleQuote = !inSingleQuote;
      current += char;
      continue;
    }

    if (!inSingleQuote) {
      if (char === "(") depth++;
      if (char === ")") depth--;
      if (char === "," && depth === 0) {
        values.push(parseInsertValue(current.trim()));
        current = "";
        continue;
      }
    }

    current += char;
  }

  if (current.trim()) {
    values.push(parseInsertValue(current.trim()));
  }

  return values;
}

function parseInsertValue(raw: string): string | null {
  const value = raw.trim().replace(/^\(/, "").replace(/\)$/, "").trim();

  if (/^NULL$/i.test(value)) {
    return null;
  }

  if (value.startsWith("'") && value.endsWith("'")) {
    return value
      .slice(1, -1)
      .replace(/''/g, "'")
      .replace(/\\'/g, "'")
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t");
  }

  return value;
}

function buildSearchIndex(row: TableRow): string {
  const parts: string[] = [];
  for (let i = 0; i < row.length; i++) {
    const value = row[i];
    if (value !== null) {
      parts.push(value.toLowerCase());
    }
  }
  return parts.join("\u0001");
}

function pushRow(table: TableData, values: (string | null)[]): void {
  const row: TableRow = values.slice();
  table.rows.push(row);
  table.searchIndex.push(buildSearchIndex(row));
}

function ensureTable(
  tables: Map<string, TableData>,
  qualifiedName: string,
  columnNames?: string[],
): TableData {
  const { schema, name, key, fullName } = parseQualifiedName(qualifiedName);

  const existing = tables.get(key);
  if (existing) {
    if (columnNames?.length && existing.columns.length === 0) {
      existing.columns = columnNames.map((column) => ({
        name: unquoteIdentifier(column),
        sqlType: "text",
        type: "text" as ColumnType,
      }));
    }
    return existing;
  }

  const table: TableData = {
    schema,
    name,
    fullName,
    key,
    columns:
      columnNames?.map((column) => ({
        name: unquoteIdentifier(column),
        sqlType: "text",
        type: "text" as ColumnType,
      })) ?? [],
    rows: [],
    searchIndex: [],
    primaryKeyColumn: "id",
    primaryKeyIndex: 0,
  };

  tables.set(key, table);
  return table;
}

function* iterateLines(content: string): Generator<string, void, void> {
  let start = 0;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (char !== "\n" && char !== "\r") continue;

    if (char === "\r" && content[i + 1] === "\n") {
      yield content.slice(start, i);
      start = i + 2;
      i++;
      continue;
    }

    yield content.slice(start, i);
    start = i + 1;
  }

  if (start < content.length) {
    yield content.slice(start);
  }
}

export interface ParseOptions {
  fileName?: string;
  onProgress?: (percent: number, message: string) => void;
}

export function parsePgDump(content: string, options: ParseOptions = {}): ParsedDump {
  const tables = new Map<string, TableData>();
  const contentLength = content.length;

  let inCreateTable = false;
  let createTableBuffer = "";
  let createTableQualifiedName = "";

  let inCopy = false;
  let copyTable: TableData | null = null;
  let copyColumnCount = 0;

  let lineIndex = 0;
  let lastReportAt = 0;

  const report = (message: string) => {
    if (!options.onProgress) return;
    const now = performance.now();
    if (now - lastReportAt < 120 && lineIndex > 0) return;
    lastReportAt = now;
    const percent = Math.min(99, Math.round((lineIndex / Math.max(contentLength, 1)) * 100));
    options.onProgress(percent, message);
  };

  for (const line of iterateLines(content)) {
    lineIndex += line.length + 1;

    if (lineIndex % 250_000 < line.length) {
      report(`Procesando ${Math.round((lineIndex / contentLength) * 100)}% del archivo`);
    }

    if (inCopy) {
      if (COPY_END_RE.test(line)) {
        inCopy = false;
        copyTable = null;
        copyColumnCount = 0;
        continue;
      }

      if (!copyTable) continue;

      const fields = splitCopyFields(line);
      const fieldCount = fields.length;

      if (copyTable.columns.length === 0 && fieldCount > 0) {
        copyTable.columns = Array.from({ length: fieldCount }, (_, index) => ({
          name: `column_${index + 1}`,
          sqlType: "text",
          type: "text" as ColumnType,
        }));
        copyColumnCount = fieldCount;
      }

      const rowValues: (string | null)[] = new Array(copyColumnCount);
      for (let i = 0; i < copyColumnCount; i++) {
        rowValues[i] = i < fieldCount ? unescapeCopyField(fields[i]) : null;
      }
      pushRow(copyTable, rowValues);
      continue;
    }

    if (inCreateTable) {
      createTableBuffer += `\n${line}`;
      if (line.includes(");")) {
        const bodyMatch = createTableBuffer.match(/\(([\s\S]*)\)\s*;?\s*$/);
        if (bodyMatch) {
          const table = ensureTable(tables, createTableQualifiedName);
          table.columns = parseColumnDefinitions(bodyMatch[1]);
        }
        inCreateTable = false;
        createTableBuffer = "";
        createTableQualifiedName = "";
      }
      continue;
    }

    const createMatch = line.match(CREATE_TABLE_RE);
    if (createMatch) {
      createTableQualifiedName = createMatch[1].replace(/\s+/g, "");
      if (line.includes(");")) {
        const inlineBody = line.match(/\(([\s\S]*)\)\s*;?\s*$/);
        if (inlineBody) {
          const table = ensureTable(tables, createTableQualifiedName);
          table.columns = parseColumnDefinitions(inlineBody[1]);
        }
      } else {
        inCreateTable = true;
        createTableBuffer = line;
      }
      continue;
    }

    const copyMatch = line.match(COPY_RE);
    if (copyMatch) {
      const columnNames = copyMatch[2]
        ?.split(",")
        .map((column) => unquoteIdentifier(column.trim()))
        .filter(Boolean);

      copyTable = ensureTable(tables, copyMatch[1], columnNames);
      copyColumnCount =
        copyTable.columns.length > 0
          ? copyTable.columns.length
          : (columnNames?.length ?? 0);
      inCopy = true;
      continue;
    }

    const insertMatch = line.match(INSERT_RE);
    if (insertMatch) {
      const columnNames = insertMatch[2]
        ?.split(",")
        .map((column) => unquoteIdentifier(column.trim()))
        .filter(Boolean);

      const table = ensureTable(tables, insertMatch[1], columnNames);
      const valuesPart = line.slice(insertMatch[0].length);
      const values = parseInsertValues(valuesPart);
      const columnCount = table.columns.length || values.length;

      if (table.columns.length === 0 && columnCount > 0) {
        table.columns = Array.from({ length: columnCount }, (_, index) => ({
          name: columnNames?.[index] ?? `column_${index + 1}`,
          sqlType: "text",
          type: "text",
        }));
      }

      const rowValues: (string | null)[] = new Array(columnCount);
      for (let i = 0; i < columnCount; i++) {
        rowValues[i] = values[i] ?? null;
      }
      pushRow(table, rowValues);
    }
  }

  options.onProgress?.(100, "Parseo completado");

  const sortedTables = Array.from(tables.values()).sort((a, b) =>
    a.fullName.localeCompare(b.fullName),
  );

  let totalRows = 0;
  const summaries: TableSummary[] = sortedTables.map((table) => {
    totalRows += table.rows.length;
    return {
      key: table.key,
      schema: table.schema,
      name: table.name,
      fullName: table.fullName,
      rowCount: table.rows.length,
      columnCount: table.columns.length,
    };
  });

  const { tables: finalizedTables, relations } =
    applyPrimaryKeysAndRelations(sortedTables);

  return {
    tables: finalizedTables,
    summaries,
    fileName: options.fileName ?? "dump.sql",
    totalRows,
    relations,
  };
}
