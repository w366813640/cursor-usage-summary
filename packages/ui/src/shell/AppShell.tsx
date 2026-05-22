import type { ReactNode } from 'react';
import { cn } from '../utils';

export interface AppShellProps {
  /**
   * Vertical icon rail / expanded sidebar. Pass `null` to drop the
   * aside entirely (e.g. focus mode) — we won't reserve gutter space.
   */
  sidebar: ReactNode;
  /** Main scrollable workspace. */
  children: ReactNode;
  /** Optional right pane (Agent panel, settings drawer, etc.). */
  rightPane?: ReactNode;
  /** Optional top region reserved for the OS chrome titlebar overlay. Default 36px. */
  titlebarHeight?: number;
  /** Whether the sidebar is in expanded state (for layout width calc). */
  sidebarExpanded?: boolean;
  className?: string;
}

/**
 * The root frame that lays out [sidebar | main | rightPane?].
 * The custom Win11 titlebar lives at the very top via a dedicated drag region,
 * not as a real grid row — it floats over the layout to keep the editor area
 * pixel-perfect.
 */
export function AppShell({
  sidebar,
  children,
  rightPane,
  titlebarHeight = 36,
  sidebarExpanded = true,
  className,
}: AppShellProps) {
  const sidebarWidth = sidebarExpanded ? 240 : 48;

  return (
    <div
      className={cn(
        'relative flex h-full w-full bg-[var(--color-bg)] text-[var(--color-text)] overflow-hidden',
        className,
      )}
    >
      {/* Drag region — invisible strip across the top so the user can drag the
          window from anywhere along the very top edge. */}
      <div
        className="app-drag fixed inset-x-0 top-0 z-[1000] pointer-events-none"
        style={{ height: titlebarHeight }}
      />

      {sidebar != null ? (
        <aside
          className="relative z-20 flex-shrink-0 border-r border-[var(--color-border)] bg-[var(--color-bg)]"
          style={{
            width: sidebarWidth,
            paddingTop: titlebarHeight,
            transition: 'width 140ms ease-out',
          }}
        >
          <div className="h-full">{sidebar}</div>
        </aside>
      ) : null}

      <main
        className="relative flex-1 min-w-0 flex flex-col"
        style={{ paddingTop: titlebarHeight }}
      >
        {children}
      </main>

      {rightPane ? (
        <aside
          className="relative z-10 flex-shrink-0 border-l border-[var(--color-border)] bg-[var(--color-bg)] overflow-hidden"
          style={{ paddingTop: titlebarHeight }}
        >
          {rightPane}
        </aside>
      ) : null}
    </div>
  );
}
