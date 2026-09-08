---
name: Weighted results computation
description: Single source of truth for topic vote tallying; both /topics/:id/results and /history/* must use it
---

# Weighted results computation

The weighted tally for a vote topic lives in one pure helper: `artifacts/api-server/src/lib/results.ts` → `computeTopicResult(topicStatus, votesForTopic, members, attendeeIds, checkedOutIds)`.

Rules it encodes:
- Cast votes use the frozen `weight_at_vote`; non-voters use their current `votingWeight`.
- Non-voters who attended the session → `sinVoto`; non-voters who were absent → `ausente`.
- Retirees (checked-out members, ids in `checkedOutIds`) are excluded **entirely**: their cast votes are dropped from the tally AND they are not counted as `sinVoto`/`ausente`, so `total` shrinks. A retiree is NOT the same as `ausente` (ausente = never attended).
- `approved` is only computed when the topic is `cerrado` (`favor > contra`), otherwise `null`.

**Why:** the app's whole point is that every role sees the *same* numbers, and quórum/results must exclude retirees. `/topics/:id/results` (votes.ts), Histórico (`/history/me`, `/history/sessions`), and the admin Excel exports (`/sessions/:id/export/results` + `matrix`) all duplicated the math and drifted. A member could vote then check out and their weight kept counting. They now all call the one helper and pass `checkedOutIds`.

**How to apply:** never re-implement the tally inline. Every results path must pass BOTH `attendeeIds` (active, checkedOutAt null) and `checkedOutIds` (checkedOutAt not null), derived from the same attendance query. If weighting rules change, change `computeTopicResult` only. No automated parity test — verify by curl: vote → check out → confirm `favor`/`voteCount` drop and `total` shrinks (retiree weight not moved to `ausente`).

**Integrity coupling — block result-altering attendance changes after closure:** because retirees are excluded from results, self check-out (`POST /sessions/:id/attendance/checkout`) MUST require `session.status === "abierta"`. Otherwise a member can vote, wait for the session/topic to close, then check out and retroactively delete their own weight from finalized tallies. Any new attendance state transition reachable by non-admins (or any path that changes who counts) must re-check session-open before mutating, or it reopens this hole.
