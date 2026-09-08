---
name: Account deletion must revoke active access
description: Deleting a user must purge their sessions + disconnect sockets, not just delete the row
---

When an account is deleted (`DELETE /members/:id`), removing the `users` row is NOT
enough. You MUST also, in the same handler:
- Purge the user's active login sessions from the connect-pg-simple `session` table:
  `DELETE FROM session WHERE sess->>'userId' ~ '^[0-9]+$' AND (sess->>'userId')::int = $id`
  (the regex guard tolerates malformed/legacy rows so the cast can't throw).
- Force-disconnect all their live sockets: `disconnectUser(id)` in `realtime.ts`
  (`io.fetchSockets()` + `socket.disconnect(true)` across all rooms).

**Why:** `requireAuth`/`requireAdmin` only check `req.session.userId` presence — they do
NOT verify the user still exists. Without explicit revocation, a deleted user keeps full
authenticated REST + realtime access via their already-issued cookie/socket until the
7-day session expiry. Architect flagged this as a serious deprovisioning hole.

**How to apply:** Do revocation at delete time. We deliberately did NOT add a per-request
user-exists DB lookup — it would add a query to every request and the app targets ~200
concurrent users. Any future "disable/ban user" flow must follow the same revoke-on-action
pattern.
