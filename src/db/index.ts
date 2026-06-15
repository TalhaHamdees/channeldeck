import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let _db: ReturnType<typeof createDb> | null = null;

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  // prepare:false is required for Supabase's transaction-mode pooler (used on
  // Vercel serverless); it's harmless on direct/session connections too.
  const client = postgres(url, { prepare: false });
  return drizzle(client, { schema });
}

// Lazily initialized so the app can build and show the setup screen
// before any environment variables exist.
export function getDb() {
  if (!_db) _db = createDb();
  return _db;
}

export { schema };
