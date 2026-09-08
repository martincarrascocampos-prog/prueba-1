---
name: Estamentos are fixed divisions (no CRUD)
description: Per-votación "por estamento" eligibility is a fixed whitelist, not a user-managed catalog
---

Estamentos (per-votación voting eligibility) are a FIXED set of divisions, NOT a
CRUD-managed catalog. The only allowed values map to `users.group`:
`["CEE", "Consejeros FECh", "COSEFECH"]` (CEE reps are labeled "Delegade").
**Mesa Directiva is intentionally excluded** from eligibility scoping.

**Why:** Product decision (Request D) — the earlier estamentos CRUD page/table was
removed because divisions are stable org units, not free-form data. Letting admins
invent arbitrary estamentos (or scope a votación to Mesa Directiva) was unwanted.

**How to apply:**
- Whitelist lives server-side as `ALLOWED_ESTAMENTOS` in `topics.ts`;
  `parseVotingShape()` filters incoming `estamentos` to it (silent drop of others,
  not a 400). Any UI chip list must stay in sync with this constant.
- Empty estamentos set = Pleno completo (all attendees eligible).
- The `topic_estamentos` join table is KEPT for per-votación eligibility; only the
  standalone estamentos catalog table + `/admin/estamentos` CRUD were removed.
