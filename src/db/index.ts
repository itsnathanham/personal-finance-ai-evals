import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { neon } from "@neondatabase/serverless";
import { PGlite } from "@electric-sql/pglite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import * as schema from "./schema";
import { SCHEMA_SQL } from "./schema-sql";
import { ensureSeeded } from "./seed";

type AppDb =
  | ReturnType<typeof drizzleNeon<typeof schema>>
  | ReturnType<typeof drizzlePglite<typeof schema>>;

const globalForDb = globalThis as unknown as {
  __copilotDb?: AppDb;
  __copilotReady?: Promise<AppDb>;
  __neonSchemaReady?: boolean;
};

async function ensureNeonSchema(url: string): Promise<void> {
  // Once per warm isolate — avoid re-running DDL on every cold request path.
  if (globalForDb.__neonSchemaReady) return;
  const sql = neon(url);
  const statements = SCHEMA_SQL.split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  // Keep sequential: CREATE must precede ALTER/INDEX on the same table.
  for (const statement of statements) {
    await sql.query(statement);
  }
  globalForDb.__neonSchemaReady = true;
}

async function createNeonDb(url: string): Promise<AppDb> {
  await ensureNeonSchema(url);
  const sql = neon(url);
  return drizzleNeon({ client: sql, schema });
}

async function createPgliteDb(): Promise<AppDb> {
  // Prefer in-memory under Next.js to avoid PGlite filesystem path issues
  // with the bundler. Persist to disk only when PGLITE_DATA_DIR is set
  // (e.g. seed script / local tooling).
  const dataDir = process.env.PGLITE_DATA_DIR;
  let client: PGlite;
  if (dataDir) {
    const resolved = path.resolve(dataDir);
    mkdirSync(resolved, { recursive: true });
    client = new PGlite(resolved);
  } else {
    client = new PGlite();
  }
  const db = drizzlePglite({ client, schema });
  await client.exec(SCHEMA_SQL);
  return db;
}

export async function getDb(): Promise<AppDb> {
  if (globalForDb.__copilotDb) {
    return globalForDb.__copilotDb;
  }
  if (!globalForDb.__copilotReady) {
    globalForDb.__copilotReady = (async () => {
      const url = process.env.DATABASE_URL;
      const db =
        url && url.startsWith("postgres")
          ? await createNeonDb(url)
          : await createPgliteDb();
      await ensureSeeded(db);
      globalForDb.__copilotDb = db;
      return db;
    })();
  }
  return globalForDb.__copilotReady;
}

export type { AppDb };
