---
name: api-server bundled dev requires restart
description: Why editing api-server route files needs a workflow restart, not HMR
---

The `@workspace/api-server` dev script runs `pnpm run build && pnpm run start`
(esbuild bundle, then `node dist/index.mjs`). There is **no watch/HMR** on the
server — it serves whatever was bundled at start time.

**Rule:** After editing anything under `artifacts/api-server/src/` (new routes,
mounts, handlers), you MUST restart the `artifacts/api-server: API Server`
workflow before the changes take effect. Otherwise live requests hit the stale
build and new endpoints return 404 even though the source is correct.

**Why:** Caused real confusion debugging new `/speaking-turns` routes — they
404'd against the running server until the workflow was restarted, despite being
mounted correctly in `routes/index.ts`.
