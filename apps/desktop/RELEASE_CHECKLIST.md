# Desktop Release Checklist

## Security

- Keep `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, and `webSecurity: true`.
- Confirm new IPC channels are whitelisted in `preload.ts` and never expose raw Node APIs.
- Verify exported diagnostics are redacted and do not include raw prompt text or IDs.

## Build Matrix

- Windows: run `pnpm --filter @cu/desktop package:win` on a Windows host.
- macOS: run `pnpm --filter @cu/desktop package:mac` on a macOS host with signing credentials.
- Linux: run `pnpm --filter @cu/desktop package:linux` on a Linux host.

## Signing And Updates

- Windows needs an Authenticode certificate before public distribution.
- macOS needs Developer ID signing and notarization.
- Auto-update is intentionally disabled unless `CU_AUTO_UPDATE=1` is present.
- Set `CU_UPDATE_FEED_URL` for staging or production generic feeds.

## Smoke Test

- Launch the packaged app with a clean user-data directory.
- Import a known CSV and confirm preview, dedupe, commit, history, and undo.
- Export and restore a JSON backup, then confirm row and batch counts.
- Open Settings and verify update state, database path reveal, and backup copy.
- Force a renderer error in dev and confirm the recovery surface appears instead of a blank window.
