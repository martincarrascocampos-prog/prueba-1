---
name: Public (unauthed) endpoints hygiene
description: Rules for the pre-login public transparency page and its endpoints — phase-scoped exposure, roster PII policy, no internal storage keys
---

There is a PUBLIC pre-login transparency page at route `/` (no AuthGuard) backed by
two unauthenticated endpoints under `/api/public/*`. It shows ALL plenary sessions
grouped by phase (`activo`/`futuro`/`pasado`) plus a per-session attendance roster.

**What each phase may expose (the invariant):**
- `pasado` (held & closed): full weighted vote tallies (`topics`) + attendance roster + acta.
- `activo` (`status === "abierta"`): attendance roster + live meeting link, **but NO vote tallies** (`topics: []`).
- `futuro` (`cerrada` + `scheduledAt` in the future): title/schedule/link only, **no roster, no tallies**.
- **Why the gating:** in-progress and not-yet-held votes must never be public; only a *closed* session's results are final and publishable. Suppress `topics` for anything but `pasado`.

**Roster PII policy (intentional, transparency requirement):**
- Public roster DOES expose member display name + group + attendance modality (online/presencial) and the absentee list. This is deliberate — the page is a "línea de transparencia".
- Per-member ballot detail (`ballots: name/group/status/voteLabel`) IS public for `pasado` topics only — also deliberate. It must NOT expose usernames or weights. Authenticated `GET /topics/:id/ballots` is open to any member but nulls `username` for non-admins (username doubles as login identifier).
- It must NOT expose passwords/plainPassword, voting weights, or usernames. Roster is built from ACTIVE members only.

**Retirados-as-present invariant:**
- A member who attended then checked out counts as PRESENT everywhere (roster/`presentCount`/`attended`), never as absentee — but their weight stays OUT of vote tallies (`computeTopicResult` still excludes `checkedOutIds`). Presence classification and tally denominators are separate concerns; never conflate them.
- The retired-early distinction is ADMIN-ONLY: the public roster shows retirados as plain attendees (no `retiredEarly` field) and public ballots collapse `checkedOut` → `present`. Admin ballots/exports keep "Retirado".

**Session-scoped rosters (no retroactivity):**
- A member "exists" for a session only if `user.createdAt <= session.createdAt` OR they have an attendance row in it (shared helper `scopeMembersToSession`). New members must never retro-affect earlier sessions' totals, quorums, absentee lists, ballots, or exports — "su existencia es posterior a su creación". Apply the same scoping in EVERY roster/denominator consumer (history, results, ballots, exports, live attendance) or totals drift between views.

**Always, for any public/unauthed field here:**
- Never expose internal object-storage keys (`actaObjectPath`): null it out, signal availability via `hasActa`, and stream via the dedicated `/public/sessions/:id/acta` (re-checks closed + stored path — no arbitrary object access).

**How to apply:** `AdminHistorySession` is SHARED by admin `/history/sessions` + public `/public/history`. New fields there are OPTIONAL and only the public route populates the transparency-specific ones (`phase`, `attendees`, `absentees`). When adding any field, audit whether it is safe to serve unauthenticated and whether the admin route must also set it.
