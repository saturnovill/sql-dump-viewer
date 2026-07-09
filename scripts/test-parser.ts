import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parsePgDump } from "../src/lib/parser/pg-dump-parser";
import { findRelatedRow } from "../src/lib/relations/infer-relations";

const currentDir = dirname(fileURLToPath(import.meta.url));
const sampleDump = readFileSync(
  join(currentDir, "../fixtures/sample-dump.sql"),
  "utf8",
);

const result = parsePgDump(sampleDump, { fileName: "sample-dump.sql" });
const tableMap = new Map(result.tables.map((table) => [table.key, table]));

assert.equal(result.tables.length, 2, "expected 2 tables");
assert.equal(result.summaries.length, 2, "expected 2 summaries");
assert.equal(result.totalRows, 7, "expected 7 total rows");
assert.equal(result.relations.graph.relationCount, 1, "expected user_id relation");

const users = result.tables.find((table) => table.name === "users");
assert.ok(users, "users table should exist");
assert.equal(users.rows.length, 4, "users should have 4 rows");
assert.equal(users.columns.length, 4, "users should have 4 columns");
assert.equal(users.rows[1][1], "guest@example.com");
assert.equal(users.rows[2][0], "3");
assert.equal(users.rows[2][1], null);
assert.equal(users.searchIndex.length, 4);

const orders = result.tables.find((table) => table.name === "orders");
assert.ok(orders, "orders table should exist");
assert.equal(orders.rows.length, 3, "orders should have 3 rows");

const userRelation = result.relations.bySourceColumn
  .get("public.orders")
  ?.get("user_id");
assert.ok(userRelation, "orders.user_id should reference users");
assert.equal(userRelation.targetTableKey, "public.users");

const related = findRelatedRow(
  result.relations,
  tableMap,
  "public.orders",
  "user_id",
  "1",
);
assert.ok(related, "should resolve user_id=1");
assert.equal(related.table.name, "users");
assert.equal(related.table.rows[related.rowIndex][1], "admin@example.com");

console.log("Parser tests passed");
