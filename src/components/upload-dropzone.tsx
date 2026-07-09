"use client";

import { useCallback, useRef, useState } from "react";
import { Database, FileUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ThemeToggle } from "@/components/theme-toggle";
import { useParserWorker } from "@/lib/parser/use-parser-worker";
import { useDumpStore } from "@/store/dump-store";
import { cn } from "@/lib/utils";

export function UploadDropzone() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { parseDump } = useParserWorker();

  const isParsing = useDumpStore((state) => state.isParsing);
  const parseProgress = useDumpStore((state) => state.parseProgress);
  const parseMessage = useDumpStore((state) => state.parseMessage);
  const error = useDumpStore((state) => state.error);
  const setDump = useDumpStore((state) => state.setDump);
  const setParsing = useDumpStore((state) => state.setParsing);
  const setParseProgress = useDumpStore((state) => state.setParseProgress);
  const setError = useDumpStore((state) => state.setError);

  const processFile = useCallback(
    (file: File) => {
      if (!file.name.toLowerCase().endsWith(".sql")) {
        setError("Selecciona un archivo .sql generado con pg_dump");
        return;
      }

      setParsing(true);
      setParseProgress(0, "Leyendo archivo...");

      const reader = new FileReader();

      reader.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 20);
          setParseProgress(percent, "Leyendo archivo...");
        }
      };

      reader.onload = () => {
        const content = String(reader.result ?? "");
        setParseProgress(20, "Iniciando parseo...");

        parseDump(content, file.name, {
          onProgress: (percent, message) => {
            const scaled = 20 + Math.round(percent * 0.8);
            setParseProgress(scaled, message);
          },
          onComplete: (data) => {
            if (data.tables.length === 0) {
              setError(
                "No se encontraron tablas en el dump. Verifica que sea un archivo plano de pg_dump.",
              );
              return;
            }
            setDump(data);
          },
          onError: (message) => setError(message),
        });
      };

      reader.onerror = () => {
        setError("No se pudo leer el archivo SQL");
      };

      reader.readAsText(file);
    },
    [parseDump, setDump, setError, setParseProgress, setParsing],
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (file) {
        processFile(file);
      }
    },
    [processFile],
  );

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center px-6 py-12">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Database className="size-7" />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">SQL Dump Viewer</h1>
        <p className="mt-2 max-w-xl text-muted-foreground">
          Sube un backup de PostgreSQL generado con{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-sm">pg_dump</code>{" "}
          y explora sus tablas con búsqueda y ordenación. Todo se procesa en tu
          navegador.
        </p>
      </div>

      <div
        className={cn(
          "w-full max-w-2xl rounded-2xl border-2 border-dashed p-10 transition-colors",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border bg-card hover:border-primary/50",
          isParsing && "pointer-events-none opacity-80",
        )}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragging(false);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          handleFiles(event.dataTransfer.files);
        }}
      >
        <div className="flex flex-col items-center gap-4 text-center">
          {isParsing ? (
            <Loader2 className="size-10 animate-spin text-primary" />
          ) : (
            <FileUp className="size-10 text-muted-foreground" />
          )}

          <div>
            <p className="text-lg font-medium">
              {isParsing ? "Procesando dump..." : "Arrastra tu archivo .sql aquí"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              o selecciónalo desde tu equipo
            </p>
          </div>

          <Button
            type="button"
            disabled={isParsing}
            onClick={() => inputRef.current?.click()}
          >
            Seleccionar archivo
          </Button>

          <input
            ref={inputRef}
            type="file"
            accept=".sql,text/plain"
            className="hidden"
            onChange={(event) => handleFiles(event.target.files)}
          />
        </div>

        {isParsing && (
          <div className="mt-8 space-y-2">
            <Progress value={parseProgress} />
            <p className="text-center text-sm text-muted-foreground">
              {parseMessage} ({parseProgress}%)
            </p>
          </div>
        )}

        {error && (
          <p className="mt-6 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
