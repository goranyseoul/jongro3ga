import { sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { MIGRATIONS, type EmbeddedMigration } from "./migrations.gen";

// Applies the embedded drizzle/ migrations in order, once each, recorded in __pibook_migrations.
// The advisory lock serializes concurrent cold starts against one Postgres (several Vercel instances).
const LOCK_KEY = 7270710;

type AnyDb = PgDatabase<PgQueryResultHKT, Record<string, unknown>>;

function rowsOf(result: unknown): Record<string, unknown>[] {
  return ((result as { rows?: Record<string, unknown>[] }).rows ?? []) as Record<string, unknown>[];
}

export async function applyMigrations(db: AnyDb, migrations: EmbeddedMigration[] = MIGRATIONS): Promise<string[]> {
  const applied: string[] = [];
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${LOCK_KEY})`);
    await tx.execute(
      sql`CREATE TABLE IF NOT EXISTS "__pibook_migrations" ("tag" text PRIMARY KEY, "hash" text NOT NULL, "applied_at" timestamptz NOT NULL DEFAULT now())`,
    );
    const done = new Map(rowsOf(await tx.execute(sql`SELECT "tag", "hash" FROM "__pibook_migrations"`)).map((r) => [String(r.tag), String(r.hash)]));
    for (const migration of migrations) {
      const previous = done.get(migration.tag);
      if (previous !== undefined) {
        if (previous !== migration.hash) {
          console.warn(`[db] migration ${migration.tag} changed after it was applied; drizzle/ migrations must be append-only`);
        }
        continue;
      }
      for (const statement of migration.statements) await tx.execute(sql.raw(statement));
      await tx.execute(sql`INSERT INTO "__pibook_migrations" ("tag", "hash") VALUES (${migration.tag}, ${migration.hash})`);
      applied.push(migration.tag);
    }
  });
  return applied;
}
