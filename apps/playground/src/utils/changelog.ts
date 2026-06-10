/**
 * Hand-authored changelog used by the "What's new" panel inside
 * Settings and the unread-dot indicator on the Quick Tips button.
 *
 * Versions are sorted newest-first; the first element is the
 * "current" version that drives the unread badge.
 *
 * Why hand-authored:
 *   - Auto-generated changelogs (conventional-commits style) tend to
 *     spam the user with internal noise (test refactors, build chores).
 *     The What's new panel is a user-facing signpost, not a release
 *     log; each entry should be a thing they will actually notice
 *     when they open the app.
 *   - Keeping it as a TS module means the build pipeline never goes
 *     stale relative to the docs; there's no chance of a CHANGELOG.md
 *     being out of sync with what shipped.
 */

export interface ChangelogEntry {
  version: string;
  /** YYYY-MM-DD */
  date: string;
  title: string;
  highlights: string[];
}

export const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    version: '1.0.1-polish',
    date: '2026-05-23',
    title: 'Commercial polish pass',
    highlights: [
      'Day Audit redesigned: one combined hero card with auto-narrative, single-biggest highlight, and Jump-to-row.',
      'Drawers reworked: sticky internal headers, Esc closes, focus trap, drawer overlays now sit above the app header so titles are never clipped.',
      'Keyboard: press ? for the shortcuts cheatsheet; g + letter jumps between sections; Cmd/Ctrl+, opens Settings.',
      'Models page auto-hides low-activity entries (< 10 requests or > 30 days stale, $1 safety net keeps stale-but-expensive runs visible).',
      'Navigation order + visibility toggles live in Settings → Navigation, persisted across sessions.',
      'File toolbar reduced to Focus + Manage data; import/export/history moved into Settings → Data management.',
    ],
  },
];

/** Newest version string, used to gate the unread-dot indicator. */
export const LATEST_VERSION = CHANGELOG_ENTRIES[0]?.version ?? '0.0.0-unknown';
