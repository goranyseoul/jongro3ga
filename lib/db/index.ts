import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { applyMigrations } from "./migrate";
import { schema, type Schema } from "./schema";

// Database connection (track AUTH).
// - DATABASE_URL set: Postgres over @neondatabase/serverless (Pool, so transactions work).
// - otherwise: embedded PGlite persisted to .data/pglite (PGLITE_DIR overrides the folder).
//   On Vercel without DATABASE_URL the filesystem is read-only and per-instance, so PGlite runs
//   in memory and a warning is logged: accounts vanish when the instance is recycled.
//   PGLITE_DIR=memory forces in-memory PGlite (tests).
// Migrations from drizzle/ (embedded in migrations.gen.ts) are applied on first use.

export type Db = PgDatabase<PgQueryResultHKT, Schema>;
export type DbKind = "neon" | "pglite-file" | "pglite-memory";

export interface DbHandle {
  db: Db;
  kind: DbKind;
  close(): Promise<void>;
}

interface DbGlobals {
  handle?: Promise<DbHandle>;
}

declare global {
  var __pibookDb: DbGlobals | undefined;
}

const globals = (): DbGlobals => (globalThis.__pibookDb ??= {});

export function dbKind(): DbKind {
  if (process.env.DATABASE_URL) return "neon";
  if (process.env.PGLITE_DIR === "memory" || process.env.VERCEL) return "pglite-memory";
  return "pglite-file";
}

export function pgliteDir(): string {
  return process.env.PGLITE_DIR || join(process.cwd(), ".data", "pglite");
}

async function open(kind: DbKind): Promise<DbHandle> {
  if (kind === "neon") {
    const [{ Pool }, { drizzle }] = await Promise.all([import("@neondatabase/serverless"), import("drizzle-orm/neon-serverless")]);
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const db = drizzle({ client: pool, schema }) as unknown as Db;
    return { db, kind, close: () => pool.end() };
  }

  const [{ PGlite }, { drizzle }] = await Promise.all([import("@electric-sql/pglite"), import("drizzle-orm/pglite")]);
  let client: InstanceType<typeof PGlite>;
  if (kind === "pglite-file") {
    const dir = pgliteDir();
    mkdirSync(dir, { recursive: true });
    client = new PGlite(dir);
  } else {
    if (process.env.VERCEL && process.env.PGLITE_DIR !== "memory") {
      console.warn("[db] DATABASE_URL is not set on Vercel: using in-memory PGlite, data is lost when the instance restarts");
    }
    client = new PGlite();
  }
  await client.waitReady;
  const db = drizzle({ client, schema }) as unknown as Db;
  return { db, kind, close: () => client.close() };
}

/** The process-wide database, migrated. Concurrent first calls share one open + migrate. */
export function getDbHandle(): Promise<DbHandle> {
  const g = globals();
  if (!g.handle) {
    const kind = dbKind();
    const pending = open(kind).then(async (handle) => {
      try {
        await applyMigrations(handle.db);
      } catch (error) {
        await handle.close().catch(() => undefined);
        throw error;
      }
      return handle;
    });
    // a failed open must not poison the process: the next call retries
    pending.catch((error: unknown) => {
      console.error("[db] failed to open the database", error);
      if (globals().handle === pending) globals().handle = undefined;
    });
    g.handle = pending;
  }
  return g.handle;
}

export async function getDb(): Promise<Db> {
  return (await getDbHandle()).db;
}

/** Closes and forgets the process database (tests, or switching PGLITE_DIR). */
export async function closeDb(): Promise<void> {
  const g = globals();
  const pending = g.handle;
  g.handle = undefined;
  if (!pending) return;
  try {
    await (await pending).close();
  } catch {
    // already failed to open: nothing to close
  }
}

/** A separate, migrated in-memory PGlite database, not the process singleton (contract tests). */
export async function openMemoryDb(): Promise<DbHandle> {
  const handle = await open("pglite-memory");
  await applyMigrations(handle.db);
  return handle;
}

export { schema };
