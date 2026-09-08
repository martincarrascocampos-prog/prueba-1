---
name: Session persistence with connect-pg-simple
description: express-session + connect-pg-simple quirks in Replit — session table, save(), trust proxy
---

**Rule:** Three things must be true for sessions to work in this project:

1. **Session table must exist.** `createTableIfMissing: true` in connect-pg-simple does NOT reliably create the table. Create manually:
   ```sql
   CREATE TABLE IF NOT EXISTS session (sid VARCHAR NOT NULL PRIMARY KEY, sess JSON NOT NULL, expire TIMESTAMP(6) NOT NULL);
   CREATE INDEX IF NOT EXISTS IDX_session_expire ON session (expire);
   ```

2. **Call `req.session.save()` explicitly after login.** Without it, the session may not be persisted before the response is sent, causing the next request to fail auth.

3. **Set `trust proxy: 1` always** (not just in production). The app always runs behind Replit's reverse proxy, even in development. Without it, session cookies may be incorrectly flagged.

**Why:** Discovered during E2E testing — all three issues caused "No autenticado" errors on subsequent requests after login, even though the cookie was set.

**How to apply:** Whenever adding a new Express session-based auth route, always call `req.session.save(cb)` after setting session data. Do not rely on auto-save.
