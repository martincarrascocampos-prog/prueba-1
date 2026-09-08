import { sql, eq } from "drizzle-orm";
import { db, sessionWeightsTable } from "@workspace/db";
import { logger } from "./logger";

// Per-session frozen voting weights. Every session gets a snapshot of all
// members' weights at creation time; later weight edits never retro-affect an
// existing session's totals, quorums, or denominators. Members created after
// the session who still join it (open older session) get a snapshot row on
// first attendance. Anyone missing from the snapshot falls back to their
// current weight.

export interface SessionWeightEntry {
  weight: string;
  weightAlt: string;
}

export type SessionWeightMap = Map<number, SessionWeightEntry>;

export async function getSessionWeightMap(sessionId: number): Promise<SessionWeightMap> {
  const rows = await db
    .select()
    .from(sessionWeightsTable)
    .where(eq(sessionWeightsTable.sessionId, sessionId));
  return new Map(rows.map((r) => [r.userId, { weight: r.weight, weightAlt: r.weightAlt }]));
}

// All snapshot rows grouped by session — for endpoints that load every session.
export async function getAllSessionWeightMaps(): Promise<Map<number, SessionWeightMap>> {
  const rows = await db.select().from(sessionWeightsTable);
  const bySession = new Map<number, SessionWeightMap>();
  for (const r of rows) {
    let m = bySession.get(r.sessionId);
    if (!m) bySession.set(r.sessionId, (m = new Map()));
    m.set(r.userId, { weight: r.weight, weightAlt: r.weightAlt });
  }
  return bySession;
}

// Overlay snapshot weights onto member rows (falls back to current weights
// for anyone missing from the snapshot).
export function applySessionWeights<
  M extends { id: number; votingWeight: string; votingWeightAlt: string },
>(members: M[], weights: SessionWeightMap | undefined): M[] {
  if (!weights || weights.size === 0) return members;
  return members.map((m) => {
    const w = weights.get(m.id);
    return w ? { ...m, votingWeight: w.weight, votingWeightAlt: w.weightAlt } : m;
  });
}

// Effective frozen weight for one member (used when freezing weight_at_vote).
export function sessionWeightFor(
  weights: SessionWeightMap,
  userId: number,
  useAlt: boolean,
  fallback: { votingWeight: string; votingWeightAlt: string },
): string {
  const w = weights.get(userId);
  if (w) return useAlt ? w.weightAlt : w.weight;
  return useAlt ? fallback.votingWeightAlt : fallback.votingWeight;
}

// Snapshot every existing user's weights for a freshly created session.
export async function snapshotSessionWeights(sessionId: number): Promise<void> {
  await db.execute(sql`
    INSERT INTO session_weights (session_id, user_id, weight, weight_alt)
    SELECT ${sessionId}, id, voting_weight, voting_weight_alt FROM users
    ON CONFLICT (session_id, user_id) DO NOTHING
  `);
}

// Late-created member joining an older open session: freeze their weights at
// first attendance (no-op if a snapshot row already exists).
export async function ensureSessionWeightForUser(sessionId: number, userId: number): Promise<void> {
  await db.execute(sql`
    INSERT INTO session_weights (session_id, user_id, weight, weight_alt)
    SELECT ${sessionId}, id, voting_weight, voting_weight_alt FROM users WHERE id = ${userId}
    ON CONFLICT (session_id, user_id) DO NOTHING
  `);
}

// One-time backfill for sessions created before weight snapshots existed.
// Per explicit instruction, Consejeros FECh weighed 0.75 in every pre-existing
// session (their original seeded weight); everyone else keeps their current
// weight. Only touches sessions that have NO snapshot rows, so it is a no-op
// once every session is snapshotted. Idempotent and safe to run at startup.
export async function backfillLegacySessionWeights(): Promise<void> {
  try {
    const result = await db.execute(sql`
      INSERT INTO session_weights (session_id, user_id, weight, weight_alt)
      SELECT p.id, u.id,
             CASE WHEN u."group" = 'Consejeros FECh' THEN 0.75 ELSE u.voting_weight END,
             u.voting_weight_alt
      FROM plenarias p
      CROSS JOIN users u
      WHERE NOT EXISTS (
        SELECT 1 FROM session_weights sw WHERE sw.session_id = p.id
      )
      AND (u.created_at <= p.created_at OR EXISTS (
        SELECT 1 FROM attendance a WHERE a.session_id = p.id AND a.user_id = u.id
      ))
      ON CONFLICT (session_id, user_id) DO NOTHING
    `);
    const n = result.rowCount ?? 0;
    if (n > 0) logger.info({ rows: n }, "Backfilled legacy session weight snapshots");
  } catch (err) {
    logger.error({ err }, "Failed to backfill legacy session weights");
  }
}
