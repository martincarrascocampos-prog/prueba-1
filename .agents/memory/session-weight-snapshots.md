---
name: Per-session weight snapshots
description: Why voting weights are frozen per session and how legacy/prod data was backfilled
---

Rule: every denominator, tally, roster weight, and export for a session must read weights from the `session_weights` snapshot (overlay helpers in `api-server/src/lib/sessionWeights.ts`), never directly from `users.voting_weight`.

**Why:** votes froze `weight_at_vote`, but denominators (absent/non-voter weight, presentWeight/totalWeight) read current user weights — so editing a member's ponderación retro-changed past sessions' percentages. The user explicitly required past results to stay fixed (consejeros at their original 0.75 in the pre-existing prod sessions).

**How to apply:** new endpoints that compute session totals must overlay `applySessionWeights`/`sessionWeightFor`. Snapshots are written at session create + first attendance; anyone missing falls back to current weight. Legacy sessions are handled by an idempotent startup backfill (consejeros=0.75 when a session has no snapshot rows) — prod data self-heals on deploy boot, no manual prod writes needed (agent has read-only prod access anyway).
