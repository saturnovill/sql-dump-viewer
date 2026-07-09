import assert from "node:assert/strict";
import { applyPrimaryKeysAndRelations } from "../src/lib/relations/infer-relations";
import type { TableData } from "../src/lib/parser/types";

const choferes: TableData = {
  schema: "public",
  name: "choferes",
  fullName: "choferes",
  key: "public.choferes",
  columns: [
    { name: "id", sqlType: "integer", type: "number" },
    { name: "nombre", sqlType: "text", type: "text" },
  ],
  rows: [["1", "Juan Pérez"], ["2", "María López"]],
  searchIndex: ["1\u0001juan pérez", "2\u0001maría lópez"],
  primaryKeyColumn: "id",
  primaryKeyIndex: 0,
};

const viajes: TableData = {
  schema: "public",
  name: "viajes",
  fullName: "viajes",
  key: "public.viajes",
  columns: [
    { name: "id", sqlType: "integer", type: "number" },
    { name: "chofer_id", sqlType: "integer", type: "number" },
  ],
  rows: [["10", "2"]],
  searchIndex: ["10\u00012"],
  primaryKeyColumn: "id",
  primaryKeyIndex: 0,
};

const { relations } = applyPrimaryKeysAndRelations([viajes, choferes]);
const relation = relations.bySourceColumn.get("public.viajes")?.get("chofer_id");

assert.ok(relation, "chofer_id should map to choferes");
assert.equal(relation.targetTableKey, "public.choferes");

const rowIndex = relations.rowByPk.get("public.choferes")?.get("2");
assert.equal(rowIndex, 1);

console.log("Relation inference tests passed");
