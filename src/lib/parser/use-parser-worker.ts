"use client";

import { useCallback, useRef } from "react";
import type { ParsedDump } from "./types";
import type { WorkerRequest, WorkerResponse } from "./parser.worker";

export function useParserWorker() {
  const workerRef = useRef<Worker | null>(null);

  const terminateWorker = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
  }, []);

  const parseDump = useCallback(
    (
      content: string,
      fileName: string,
      callbacks: {
        onProgress: (percent: number, message: string) => void;
        onComplete: (data: ParsedDump) => void;
        onError: (message: string) => void;
      },
    ) => {
      terminateWorker();

      const worker = new Worker(
        new URL("./parser.worker.ts", import.meta.url),
        { type: "module" },
      );
      workerRef.current = worker;

      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const message = event.data;

        if (message.type === "progress") {
          callbacks.onProgress(message.percent, message.message);
          return;
        }

        if (message.type === "result") {
          callbacks.onComplete(message.data);
          terminateWorker();
          return;
        }

        if (message.type === "error") {
          callbacks.onError(message.message);
          terminateWorker();
        }
      };

      worker.onerror = () => {
        callbacks.onError("El worker falló al procesar el archivo SQL");
        terminateWorker();
      };

      const request: WorkerRequest = {
        type: "parse",
        content,
        fileName,
      };
      worker.postMessage(request);
    },
    [terminateWorker],
  );

  return { parseDump, terminateWorker };
}
