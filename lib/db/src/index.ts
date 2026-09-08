import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Sized for bursty load: a single realtime event can trigger many concurrent
// REST refetches across ~200 attendees. A larger pool absorbs the burst, and a
// pending checkout queues (pg's default) rather than erroring — so we
// deliberately omit connectionTimeoutMillis (a short one turns spikes into 500s).
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  keepAlive: true,
});
export const db = drizzle(pool, { schema });

export * from "./schema";
