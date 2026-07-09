/// <reference lib="webworker" />

import { parsePgDump } from "./pg-dump-parser";
import type { ParsedDump } from "./types";

export type WorkerRequest = {
  type: "parse";
  content: string;
  fileName: string;
};

export type WorkerResponse =
  | {
      type: "progress";
      percent: number;
      message: string;
    }
  | {
      type: "result";
      data: ParsedDump;
    }
  | {
      type: "error";
      message: string;
    };

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const payload = event.data;

  if (payload.type !== "parse") {
    return;
  }

  try {
    const data = parsePgDump(payload.content, {
      fileName: payload.fileName,
      onProgress: (percent, message) => {
        const response: WorkerResponse = {
          type: "progress",
          percent,
          message,
        };
        self.postMessage(response);
      },
    });

    const response: WorkerResponse = {
      type: "result",
      data,
    };
    self.postMessage(response);
  } catch (error) {
    const response: WorkerResponse = {
      type: "error",
      message:
        error instanceof Error ? error.message : "Error desconocido al parsear el dump",
    };
    self.postMessage(response);
  }
};
