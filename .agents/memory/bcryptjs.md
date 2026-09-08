---
name: bcryptjs over bcrypt in Replit
description: bcrypt native module fails to compile; use bcryptjs (pure JS) instead
---

**Rule:** Use `bcryptjs` (pure JavaScript) instead of `bcrypt` (native module) in all packages in this project.

**Why:** `bcrypt` requires a native `.node` binary that must be compiled during install. In Replit's environment, `pnpm approve-builds` is required to allow native builds, and the binary may fail to compile or link. `bcryptjs` is a pure-JS drop-in replacement with identical API.

**How to apply:** Replace `import bcrypt from "bcrypt"` with `import bcrypt from "bcryptjs"`. The `bcrypt.hash()`, `bcrypt.compare()` APIs are identical. In `build.mjs` externals list, keep `"bcrypt"` but add `"bcryptjs"` too (it is listed as external since it's a dependency not bundled).
