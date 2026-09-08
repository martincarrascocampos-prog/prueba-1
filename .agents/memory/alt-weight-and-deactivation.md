---
name: Alt weight & account deactivation invariants
description: Server-enforced rules for the alternative voting weight and the active/deactivated account state
---

## Alternative voting weight (`votingWeightAlt`)

Members carry two weight columns: `votingWeight` (normal) and `votingWeightAlt`. A votación records which column tallies it via `weightSource` (`"normal"` | `"alt"`).

**Rule:** `weightSource="alt"` may only persist when the votación is BOTH weighted AND estamento-restricted (`estamentos.length > 0`). Enforced in `parseVotingShape` (topics.ts), not just the UI — an API client sending `alt` on an unrestricted/unweighted topic is silently coerced to `"normal"`.

**Why:** the alternative weight is a per-estamento concept; allowing it on a pleno-completo (unrestricted) vote would tally a weight that has no meaning there and drift from what the admin sees. Frontend hides the selector unless weighted+restricted; the server is the real guard.

## Account deactivation (`active` flag)

A deactivated (`active=false`) member is NOT deleted — profile + history are preserved. They can still log in.

**Rules:**
- Frontend `AuthGuard` blocks non-admin users with `active===false` behind a full-screen "Cuenta inhabilitada" state; they can't reach vote/attendance pages. Admins are never gated (`user.rol !== "admin"` guard). `AuthUser.active` comes from `/auth/me`.
- On deactivation the server checks the member out of every open session they're actively attending (sets `checkedOutAt`) so their weight leaves all present/total tallies immediately, and evicts their live sockets from those rooms (`evictUserFromSession`). This is done at toggle time, not on the hot path.

**Why:** deactivation must remove the member's voting weight from live tallies the instant it happens (not lazily), matching the delete-time deprovisioning pattern already used for hard deletes.

**How to apply:** any new tally/aggregate that sums member weight must exclude `active=false` members; any new place that reads attendance for weight must respect `checkedOutAt`.
