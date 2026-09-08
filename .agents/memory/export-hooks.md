---
name: Export hooks are queries not mutations
description: useExportAttendance/Results/Matrix are React Query queries — call raw functions on button click
---

**Rule:** `useExportAttendance`, `useExportResults`, and `useExportMatrix` are React Query **query** hooks (not mutations). They cannot be called with `.mutate()`.

**Why:** Orval generates GET endpoints as useQuery hooks. The export endpoints (`GET /api/sessions/:id/export/attendance`, etc.) are GET requests, so they become query hooks.

**How to apply:** On button click, call the raw async fetch functions directly:
```tsx
import { exportAttendance, exportResults, exportMatrix } from "@workspace/api-client-react";

const handleExport = async () => {
  const data = await exportAttendance(sessionId);
  // use xlsx to download
};
```
Do NOT use the hook version with `.mutate()`.
