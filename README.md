# SQL Dump Viewer

Explora backups de PostgreSQL generados con `pg_dump` directamente en el navegador. El archivo `.sql` se procesa localmente (sin subirlo a ningún servidor) y puedes navegar tablas con búsqueda, ordenación y scroll virtualizado.

## Características

- Compatible con dumps planos de `pg_dump` (`COPY ... FROM stdin`, `CREATE TABLE`, `INSERT`)
- Sidebar virtualizado con listado de tablas y conteo de filas
- Tres vistas: **Resumen**, **Diagrama**, **Datos** y **Esquema**
- **Enlaces de relaciones**: columnas `*_id` clicables abren un modal con el registro relacionado
- **Diagrama del esquema**: grafo interactivo de tablas y relaciones (pan, zoom, clic para abrir tabla)
- Búsqueda global con debounce por fila
- Ordenación por columnas (texto, número, fecha, boolean)
- Virtualización de filas para tablas grandes
- Parseo en Web Worker para no bloquear la UI
- Listo para desplegar en Vercel (app estática, sin backend ni base de datos)

## Requisitos

- Node.js 20+
- npm
- TypeScript 7.0 (typecheck nativo) + TypeScript 6 (compatibilidad con Next.js/ESLint)

## Desarrollo local

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) y sube un archivo `.sql`.

### Ejemplo de dump compatible

```bash
pg_dump -h localhost -U deploy -d mqlogistics_production > backup.sql
```

También puedes probar con el fixture incluido:

```bash
# En la UI, sube:
fixtures/sample-dump.sql
```

## Despliegue en Vercel

1. Sube este proyecto a un repositorio Git
2. Importa el repo en [vercel.com/new](https://vercel.com/new)
3. Framework preset: **Next.js**
4. No requiere variables de entorno

O desde CLI:

```bash
npm i -g vercel
vercel
```

## Arquitectura

```text
Archivo .sql -> FileReader -> Web Worker (parser) -> Zustand store -> Sidebar + DataTable
```

Todo el procesamiento ocurre en el cliente. Los datos viven en memoria del navegador durante la sesión.

## Limitaciones

- Pensado para dumps pequeños/medianos (hasta ~200 MB según memoria del navegador)
- No restaura la base de datos; solo visualiza el contenido del dump
- Formatos custom/comprimidos de `pg_dump` no soportados (usa formato plano `.sql`)

## Scripts

- `npm run dev` — servidor de desarrollo
- `npm run typecheck` — verificación de tipos con TypeScript 7 (nativo, ~10x más rápido)
- `npm run build` — typecheck TS7 + build de producción Next.js
- `npm run start` — servidor de producción
- `npm run lint` — ESLint
- `npm run test:parser` — tests del parser SQL
