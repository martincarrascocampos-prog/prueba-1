---
name: Member management / usernames
description: Rules for creating members and how usernames behave across auth
---

- Usernames are stored **case-preserving** (trimmed only), never force-lowercased. Seed data uses mixed case (e.g. "FECH", "SESEGEN", "Cultura") and login (`/auth/login`) matches usernames with an **exact, case-sensitive** equality — so lowercasing a new member's username would make the credential the admin hands out fail to log in.
  **Why:** an earlier version lowercased on create; that silently diverged the stored username from what the admin typed, breaking case-sensitive login.
  **How to apply:** on member create, store `username.trim()` as-is. Enforce uniqueness case-**insensitively** (`lower(username) = lower(input)`) to avoid "Juan"/"juan" logical duplicates, and also catch the DB unique-violation (`code === "23505"`) and map it to HTTP 409 for the concurrent double-submit race.
