---
name: Socket.io realtime behind Replit proxy
description: How real-time sync is wired in this app — proxy path, session auth, room-scoped invalidation-only events
---

# Socket.io realtime

Real-time sync layers on top of the contract-first REST API. Sockets carry **only invalidation signals**, never business data — clients still refetch via React Query hooks. Keep it that way; do not start sending domain payloads over sockets.

## Path & proxy
- Socket.io is mounted at path `/api/socket.io` so it routes through the Replit reverse proxy under the api-server artifact's `/api` prefix. Both server (`io` opts) and client must use this exact path or the handshake 404s through the proxy.
- WebSocket upgrade works through the proxy; the engine.io polling handshake returns a sid before auth runs.

## Auth
- Sockets reuse the same `express-session` middleware (exported from `app.ts`). Connections with no `session.userId` are rejected at the socket connect phase with "No autenticado". The polling handshake succeeding is normal — the gate is at connection, not handshake.

## Rooms & events
- Clients join room `session:<id>`. Mutation handlers call `emitSessionEvent(sessionId, event)` with events `attendance:changed`, `session:changed`, `speaking:changed`.
- **Every mutation that changes session-scoped state must emit**, including `POST /sessions` (kept for scope-consistency even though a brand-new room has no subscribers yet).
- **Why:** emit coverage must match mutation coverage or some changes silently fall back to the 30s poll.
- **`attendance:changed` must invalidate BOTH the ballots family AND the topic-results family**, not just ballots. Retiring/re-including a member (checkout/reactivate) or any attendance change shifts weight into/out of the tally, so `/api/topics/:id/results` percentages (and the sinVoto/ausente segments) are stale too — invalidating only `/ballots` updates per-member status instantly but leaves percentages waiting on the 30s poll. There's no per-topic id on the attendance event, so invalidate the whole `/api/topics/*/{ballots,results}` families by URL prefix (jittered predicate). **Why:** the server tally already excludes checked-out members (`checkedOutIds` in `computeTopicResult`/`computeCandidateResult`), so the only gap is the client not being told to refetch results on attendance changes.

## Per-user channel (`access:changed`)
- Besides `session:<id>` and `lobby`, every socket also joins `user:<id>` on connect. Admin-driven access changes to a specific member emit `emitUserEvent(userId, "access:changed")` on that room.
- **Why it can't reuse the session room:** the member is often NOT in `session:<id>` at the moment their access changes — they were just evicted (retired / marked absent / deactivated) or were never attending (mark-present, reactivate). A `session:<id>` broadcast would miss exactly the person who needs it, so the notice must go to a room keyed on the user, not the session.
- **Emit on EVERY access transition, both directions:** loss-of-access (admin checkout, mark-absent, deactivate) AND grant-of-access (reactivate account, admin mark-present, admin re-admit/reactivate attendance). Miss a grant transition and the member stays stuck (e.g. stale "cuenta inhabilitada" screen) until an incidental refetch.
- **Client split:** `useUserLive` (mounted in `AuthGuard`, always on) invalidates `/auth/me` so the disabled/enabled screen flips instantly; `useSessionLive` also listens and re-`emit("join")` + refreshes session/topic views so a re-admitted member resubscribes. Both attach to the same socket singleton — multiple listeners per event is fine.
- **No jitter for this event:** it's a per-user signal (fan-out of 1), not a ~200-client broadcast, so invalidate directly — the jitter/coalesce machinery is only for fan-out events.
- **Add new `access:changed` emitters to the `vi.mock("../lib/realtime")` in route tests** or the mocked (undefined) `emitUserEvent` throws → route 500s. Any new realtime export has this trap across the partial mocks.

## Room-join access rule
- The `join` handler is the single chokepoint for who receives live updates, and it is **intentionally stricter than the REST view rules**: REST lets any authenticated user *fetch* any session (members need that to discover/join sessions), but live updates only flow to admins and active attendees.
  - Admins: may join any existing session room.
  - Members: may join only a session they are actively attending (an `attendance` row with `checked_out_at IS NULL`).
- **Why the divergence is deliberate:** restricting REST session-view to attendees would create a chicken-and-egg (a member must view a session to mark attendance and join it). So REST stays open and the push channel is the layer that's scoped.
- **Frontend consequence:** the join fires on socket `connect`, but a member who marks attendance *after* mounting must re-`emit("join")` (and `emit("leave")` on self check-out), or they'll miss instant updates until the next mount/poll. The member dashboard does this in the attendance/checkout mutation `onSuccess`.

## Degradation
- Polling stays on as a **larger-interval (30s) fallback** on every live query. Do not remove polling — it is the graceful-degradation path when the socket drops. The `useSessionLive` hook re-joins the room on `connect` for reconnect.
- **Reconnect catch-up:** because the fallback poll is only 30s, a brief socket drop could leave data stale for up to 30s. On a *re*connect (not the first connect) `useSessionLive` fires a jittered full invalidation (`scheduleInvalidateAll`) so missed events recover immediately. **Why:** the larger the poll interval, the more you must rely on the socket; reconnect must actively resync, not wait for the next poll.

## Fan-out throttle & eviction (durable lessons)
> Operational params (throttle window, poll intervals, pool sizing, single-instance deploy topology) live in `replit.md` "Scaling…" + "Deployment topology" — don't restate them here; keep this file to the non-obvious *why*.

- **A throttle/coalesce key must include every discriminator you must NOT merge.** Session events key on `session:<id>|<event>`, but vote tallies must add the topic: `session:<id>|votes:changed|<topicId>`. Drop the `topicId` and two concurrently-open topics collapse into one signal and one stops refreshing. Rule: never widen a key so distinct things you must distinguish share it.
- **Leading+trailing, not leading-only.** Leading keeps the instant feel; the trailing edge must fire exactly once with the latest state or the *final* update is silently lost. Coalescing is safe here only because payloads are pure refetch signals (constant per key), never domain data.
- **`evictUserFromSession` MUST await every `RemoteSocket.leave()`.** `fetchSockets()` returns RemoteSockets whose `.leave()` is **async**; callers emit a broadcast immediately after evicting, and an un-awaited leave races that emit so the just-evicted socket still receives it. Latent race — only surfaced once the throttle shifted emit timing. **Why it matters:** any "remove from room then notify the room" sequence over RemoteSockets has this hazard.
- **Reconnect must actively resync, not wait for the poll.** The larger the fallback poll interval, the longer a dropped socket stays stale; on *re*connect fire a jittered full invalidation. `invalidateQueries` refetches *active* queries regardless of `staleTime`, so a non-zero `staleTime` never blocks a live update.
- **Test isolation for module-level singletons:** the throttle map is a per-process singleton and a vitest file shares one module instance across its tests, so a pending trailing timer from one test fires during the next and skews it. `realtime.test.ts` resets it in `beforeEach` (`__resetEmitThrottleForTests()`). Symptom: a timing test that passes in isolation but fails in the full file = leaked singleton state, not a product bug.

## Build
- esbuild bundle externalizes socket.io's optional native deps `bufferutil`/`utf-8-validate` (in `build.mjs`) so bundling succeeds.
