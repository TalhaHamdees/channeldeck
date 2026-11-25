import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, beforeEach } from "vitest";
import * as schema from "@/db/schema";
import { encryptToken } from "@/lib/crypto";
import { refreshTokenFor } from "./fake-google";

/**
 * An in-memory Postgres for tests: PGlite (Postgres compiled to WebAssembly)
 * with the app's real Drizzle migrations applied. Nothing leaves the process
 * and no database credentials are needed. Each test file gets one instance,
 * and every table is emptied before each test.
 *
 * Test files route the engine to it with:
 *   vi.mock("@/db", async () => ({
 *     getDb: (await import("./helpers/test-db")).getTestDb,
 *     schema: await import("@/db/schema"),
 *   }));
 */

export type TestDb = PgliteDatabase<typeof schema>;

const MIGRATIONS = fileURLToPath(new URL("../../../../../drizzle", import.meta.url));

let client: PGlite | null = null;
let db: TestDb | null = null;

export function getTestDb(): TestDb {
  if (!db) throw new Error("Test database not started: call withTestDatabase()");
  return db;
}

export function withTestDatabase(): void {
  beforeAll(async () => {
    client = new PGlite();
    const instance = drizzle(client, { schema });
    await migrate(instance, { migrationsFolder: MIGRATIONS });

    // Production uses drizzle's postgres-js driver, where db.execute() resolves
    // to the row array itself; the PGlite driver resolves to { rows }. The
    // engine relies on the postgres-js shape (claimNextJob, the remaining-jobs
    // count), so mirror it here.
    const execute = instance.execute.bind(instance);
    Object.assign(instance, {
      execute: async (query: Parameters<typeof execute>[0]) =>
        (await execute(query)).rows,
    });
    db = instance;
  });

  beforeEach(async () => {
    // Every other table cascades from these two.
    await client!.exec("TRUNCATE channels, sync_runs CASCADE");
  });

  afterAll(async () => {
    await client?.close();
    client = null;
    db = null;
  });
}

/** Run raw SQL against the test database and return the rows. */
export async function query<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  if (!client) throw new Error("Test database not started: call withTestDatabase()");
  return (await client.query<T>(sql)).rows;
}

// ---------- seeding ----------

export async function addChannel(
  id: string,
  tokenStatus: "active" | "revoked" | "error" = "active"
): Promise<void> {
  await getTestDb()
    .insert(schema.channels)
    .values({
      id,
      title: `Channel ${id}`,
      refreshTokenEnc: encryptToken(refreshTokenFor(id)),
      tokenStatus,
    });
}

/** Queue a job directly; createdAt controls the order jobs are claimed in. */
export async function queueJob(job: {
  channelId: string;
  jobType?: "daily" | "backfill_chunk";
  dateFrom: string;
  dateTo: string;
  createdAt?: Date;
}): Promise<void> {
  await getTestDb()
    .insert(schema.syncJobs)
    .values({ jobType: "daily", ...job });
}

// ---------- reading back ----------

export async function channelRow(id: string) {
  const [row] = await query<{
    token_status: string;
    backfill_complete: boolean;
    last_synced_at: string | null;
  }>(`SELECT * FROM channels WHERE id = '${id}'`);
  return row;
}

export async function jobsFor(channelId: string) {
  return query<{
    job_type: string;
    date_from: string;
    date_to: string;
    status: string;
    attempts: number;
    last_error: string | null;
  }>(
    `SELECT job_type, date_from::text, date_to::text, status, attempts, last_error
     FROM sync_jobs WHERE channel_id = '${channelId}'
     ORDER BY job_type, date_from DESC`
  );
}

/** Every analytics table, each sorted by its primary key, for whole-state comparisons. */
export async function analyticsTables() {
  return {
    channelMetricsDaily: await query(
      "SELECT * FROM channel_metrics_daily ORDER BY channel_id, date"
    ),
    trafficSourcesDaily: await query(
      "SELECT * FROM traffic_sources_daily ORDER BY channel_id, date, source_type"
    ),
    videos: await query("SELECT * FROM videos ORDER BY id"),
    videoMetricsTotals: await query(
      "SELECT * FROM video_metrics_totals ORDER BY channel_id, range_days, video_id"
    ),
    geographyPeriod: await query(
      "SELECT * FROM geography_period ORDER BY channel_id, range_days, country"
    ),
    demographicsPeriod: await query(
      "SELECT * FROM demographics_period ORDER BY channel_id, age_group, gender"
    ),
  };
}
