---
name: Inasistencia Justificada
description: Justified absence is a label-only overlay, never an attendance state
---

Rule: "Inasistencia Justificada" is stored in a separate `justified_absences` table (session+user PK), NOT as an attendance status. No attendance row exists — the member stays a normal absentee for quorum, denominators, and vote eligibility everywhere.

**Why:** the user explicitly required it to behave exactly like a normal absence operationally; keeping it out of the attendance table meant zero changes to quorum/results logic.

**How to apply:** any surface that shows absentees must overlay the label (attendance list `justifiedIds`, public absentee refs, member history, Excel export). Any transition to "attended" (self-attendance POST, admin mark-present) MUST delete the justified row, or a later attendance deletion silently resurrects the stale label. Admin-only: only the `PATCH .../attendance/:userId` (requireAdmin) accepts `justified`. The table is self-created at server boot (`ensureJustifiedAbsencesTable`) since prod doesn't run drizzle push.
