import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "./logger";

// Production deployments don't run `drizzle push`, so the server self-heals the
// schema at boot (same pattern as the connect-pg-simple session table).
// Idempotent: CREATE TABLE IF NOT EXISTS.
export async function ensureJustifiedAbsencesTable(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS justified_absences (
        session_id integer NOT NULL REFERENCES plenarias(id) ON DELETE CASCADE,
        user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT justified_absences_session_id_user_id_pk PRIMARY KEY (session_id, user_id)
      )
    `);
  } catch (err) {
    logger.error({ err }, "Failed to ensure justified_absences table");
  }
}
