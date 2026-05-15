# Archived Web-Mode E2E Scripts

These Playwright smoke checks targeted the **web** build that ran in
`vite preview` (PR2–PR14, plus the production release smoke). They
all expected the renderer to host a drag-and-drop CSV uploader backed
by IndexedDB.

PR20 retired the web (IndexedDB) renderer — the browser bundle now
shows a "Open in the desktop app" notice instead of an upload UI, so
none of these scripts can complete a successful run any more.

They're kept here for historical reference (and in case a future PR
revives a stripped-down web preview). For active smoke coverage on
the desktop app, see:

- `scripts/desktop-smoke.mjs` — boot + console scan
- `scripts/desktop-ui-smoke.mjs` — boot + IPC bridge call
- `scripts/desktop-db-smoke.mjs` — better-sqlite3 round-trip
- `scripts/desktop-year-smoke.mjs` — Year-in-review + cross-month trends
- `scripts/desktop-installer-smoke.mjs` — packaged Windows binary
