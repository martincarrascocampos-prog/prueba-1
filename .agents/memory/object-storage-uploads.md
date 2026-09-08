---
name: Object storage upload validation
description: File-type restrictions on uploads must be enforced server-side, not only in the client picker
---

# Object storage upload validation

When restricting upload file types (e.g. "PDF only" for actas), enforce the
restriction in the backend presign endpoint (`POST /storage/uploads/request-url`),
not just via the client `<input accept>` / MIME guard.

**Why:** The presign endpoint accepts arbitrary `contentType`/`name`; a crafted
request bypasses the UI and gets a valid presigned URL, letting a non-PDF be
stored. Client-side `accept` is UX only, never a trust boundary.

**How to apply:** In the request-url handler validate
`contentType === "application/pdf" && name.toLowerCase().endsWith(".pdf")` (adapt
per allowed type) and return 400 otherwise, before issuing the presigned URL.

## Blueprint copy gotchas (object-storage-web + objectStorage.ts)
- The copied `lib/object-storage-web` blueprint ships a tsconfig WITHOUT
  `composite/declarationMap/emitDeclarationOnly`; since it's a referenced lib it
  must have them or `tsc --build` fails with TS6306. Add them when copying.
- Copied `objectStorage.ts` has an untyped `await response.json()` for the
  signed-url call that fails strict typecheck (TS2339 on `signed_url`); cast it
  `as { signed_url: string }`.
