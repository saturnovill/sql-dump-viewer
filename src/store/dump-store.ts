import { create } from "zustand";
import type { ParsedDump, TableData, TableView } from "@/lib/parser/types";

interface DumpState {
  dump: ParsedDump | null;
  tableMap: Map<string, TableData>;
  selectedTableKey: string | null;
  activeView: TableView;
  isParsing: boolean;
  parseProgress: number;
  parseMessage: string;
  error: string | null;
  setDump: (dump: ParsedDump) => void;
  clearDump: () => void;
  selectTable: (tableKey: string) => void;
  setActiveView: (view: TableView) => void;
  setParsing: (isParsing: boolean) => void;
  setParseProgress: (percent: number, message: string) => void;
  setError: (error: string | null) => void;
}

export function getTableKey(table: Pick<TableData, "schema" | "name">): string {
  return `${table.schema}.${table.name}`;
}

export const useDumpStore = create<DumpState>((set, get) => ({
  dump: null,
  tableMap: new Map(),
  selectedTableKey: null,
  activeView: "overview",
  isParsing: false,
  parseProgress: 0,
  parseMessage: "",
  error: null,

  setDump: (dump) => {
    const tableMap = new Map(dump.tables.map((table) => [table.key, table]));
    const firstTable = dump.tables[0];

    set({
      dump,
      tableMap,
      selectedTableKey: firstTable?.key ?? null,
      activeView: "overview",
      isParsing: false,
      parseProgress: 100,
      parseMessage: "Completado",
      error: null,
    });
  },

  clearDump: () =>
    set({
      dump: null,
      tableMap: new Map(),
      selectedTableKey: null,
      activeView: "overview",
      isParsing: false,
      parseProgress: 0,
      parseMessage: "",
      error: null,
    }),

  selectTable: (tableKey) =>
    set({
      selectedTableKey: tableKey,
      activeView: "data",
    }),

  setActiveView: (view) => set({ activeView: view }),

  setParsing: (isParsing) =>
    set({
      isParsing,
      parseProgress: isParsing ? 0 : get().parseProgress,
      parseMessage: isParsing ? "Leyendo archivo..." : get().parseMessage,
      error: null,
    }),

  setParseProgress: (percent, message) =>
    set({ parseProgress: percent, parseMessage: message }),

  setError: (error) =>
    set({
      error,
      isParsing: false,
    }),
}));

export function useSelectedTable(): TableData | null {
  const selectedTableKey = useDumpStore((state) => state.selectedTableKey);
  const tableMap = useDumpStore((state) => state.tableMap);

  if (!selectedTableKey) {
    return null;
  }

  return tableMap.get(selectedTableKey) ?? null;
}
