---
name: Candidato voting modes (single + approval-style multiple)
description: Candidato defaults to single-pick; "multiple" mode is approval-style (max 1 per candidate, unused votes → abstención)
---

Candidato-type votaciones default to `candidateMode "single"` (pick ONE candidate +
abstención). The other mode, `candidateMode "multiple"` ("Voto de opciones múltiples"),
is OPT-IN via a toggle on the admin create-topic form and is **approval-style**, NOT
cumulative.

**Approval-style rules (multiple mode):**
- A voter may select AT MOST ONE vote per candidate (no stacking multiple votes on one
  option). Frontend models this as a `Set<number>` of selected candidateIds
  (`multiSelected` + `toggleCandidate` in `member/vote.tsx`), capped at `votesPerVoter`.
- Unused picks are NOT lost — they count as **abstención**. The server auto-fills the
  remainder as abstención rows; the client only sends the selected candidates each with
  `count: 1`. The confirm button stays enabled even with picks remaining and reads
  "Confirmar (N como abstención)".

**Why:** Request C — the union wanted an approval ballot ("vote for up to N, the rest is
abstention"), not cumulative voting where you dump several votes onto one candidate.

**How to apply:**
- Server (`votes.ts`) treats ALL candidato ballots as allocation-based: single = one
  allocation of count 1. Do not special-case single in the tally.
- In multiple mode the server enforces max 1 per candidate and derives the abstención
  remainder — do not trust the client to send abstención allocations.
- Admin UI requires `candidates.length >= 1` for candidato (single-candidate
  ratification is valid); do not re-impose a 2-candidate minimum.
- History `myVote` for candidato is a summary string (e.g. "Ana, Beto") rendered as-is
  by `MyVoteBadge`.
