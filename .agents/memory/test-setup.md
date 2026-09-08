---
name: Test setup (vitest per-artifact)
description: Where automated tests live and how they run in this monorepo
---

# Test setup

Tests are configured **per-artifact with vitest**, not at the workspace root. There is no root test runner/workspace config — run each artifact's suite via its own `test` script (`pnpm --filter @workspace/<name> run test`). A validation step named `test` runs both artifact suites together.

**Why:** the repo is a pnpm monorepo with leaf artifacts that don't share a build; each artifact owns its own vitest config (node env for api-server, jsdom for fech-plenario).

## Conventions
- api-server: `vitest.config.ts` with `environment: "node"`, `fileParallelism: false` (tests share the module-level Socket.io singleton and the dev DB, so they must not run concurrently).
- Realtime/socket tests use a real `initRealtime` + `socket.io-client` against an ephemeral http server; a fake session middleware reads `uid` from the handshake query to simulate auth.
- "Mutation emits event" tests mock `../lib/realtime` (spy on `emitSessionEvent`) but hit the **real dev DB** through the router via supertest, then clean up inserted rows in `afterAll`.
- fech-plenario: `vitest.config.ts` with `environment: "jsdom"`, `setupFiles` loading `@testing-library/jest-dom`. Component tests mock `@workspace/api-client-react` hooks to feed deterministic data.

## Gotcha
- fech-plenario `tsconfig.json` excludes `**/*.test.ts` but NOT `**/*.test.tsx`, so `.tsx` test files are typechecked — keep them type-clean.
