import { defineConfig } from "drizzle-kit";

// Migrations are generated into drizzle/ and applied automatically on first database use
// (lib/db/migrate.ts), so there is no manual migrate step. After `drizzle-kit generate`, run
// `node lib/db/embed-migrations.mjs` to refresh the embedded copy the server bundles.
export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
});
