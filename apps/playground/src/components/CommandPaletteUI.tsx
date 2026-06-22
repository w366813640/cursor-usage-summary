// Deep module paths (not the `'kbar'` barrel) so this chunk — and only this
// chunk — carries kbar's heavy UI plus its `fuse.js` + `react-virtual`
// dependencies. See the import note in CommandPalette.tsx for the rationale.
import { KBarAnimator } from 'kbar/lib/KBarAnimator';
import { KBarPortal } from 'kbar/lib/KBarPortal';
import { KBarPositioner } from 'kbar/lib/KBarPositioner';
import { KBarResults } from 'kbar/lib/KBarResults';
import { KBarSearch } from 'kbar/lib/KBarSearch';
import { useMatches } from 'kbar/lib/useMatches';

/**
 * Heavy half of the command palette: the portal, positioner, animator,
 * search input and the (virtualized) results list.
 *
 * This module is split out of `CommandPalette.tsx` and loaded with
 * `React.lazy` only once the palette is first opened (see `PaletteMount`
 * in CommandPalette.tsx). It is the piece that pulls kbar's heaviest code
 * plus its `fuse.js` (fuzzy match) and `react-virtual` (results list)
 * dependencies — none of which belong on the first-paint critical path,
 * since the palette is invisible until the user hits Cmd/Ctrl+K.
 *
 * The lightweight kbar core (`KBarProvider` + the `mod+k` key handler +
 * `useRegisterActions`) stays static so the shortcut and contextual action
 * registration keep working without waiting on this chunk.
 */
export default function PaletteUI() {
  return (
    <KBarPortal>
      <KBarPositioner
        style={{
          background: 'color-mix(in oklab, var(--color-bg) 70%, transparent)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 9999,
          // Bias upward — the palette feels less cramped pushed off center.
          paddingTop: '15vh',
          alignItems: 'flex-start',
        }}
      >
        <KBarAnimator
          style={{
            width: 'min(640px, 92vw)',
            background: 'var(--color-surface-raised)',
            color: 'var(--color-text)',
            border: '1px solid var(--color-border-strong)',
            borderRadius: 12,
            boxShadow:
              '0 24px 64px -16px rgba(0,0,0,0.45), 0 8px 16px -8px rgba(0,0,0,0.18), inset 0 1px 0 color-mix(in oklab, var(--color-text) 6%, transparent)',
            overflow: 'hidden',
            fontFamily: 'var(--font-sans)',
          }}
        >
          <KBarSearch
            style={{
              width: '100%',
              padding: '14px 18px',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--color-text)',
              fontSize: 15,
              fontFamily: 'var(--font-sans)',
              borderBottom: '1px solid var(--color-border)',
            }}
            placeholder="Jump to · search actions"
            defaultPlaceholder="Jump to · search actions"
          />
          <PaletteResults />
        </KBarAnimator>
      </KBarPositioner>
    </KBarPortal>
  );
}

function PaletteResults() {
  const { results } = useMatches();
  return (
    <KBarResults
      items={results}
      onRender={({ item, active }) => {
        if (typeof item === 'string') {
          return (
            <div
              style={{
                padding: '10px 18px 4px',
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--color-text-subtle)',
              }}
            >
              {item}
            </div>
          );
        }
        return (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 18px',
              cursor: 'pointer',
              background: active ? 'var(--color-surface-muted)' : 'transparent',
              borderLeft: `2px solid ${active ? 'var(--color-accent)' : 'transparent'}`,
              transition: 'background 120ms ease, border-color 120ms ease',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 14, color: 'var(--color-text)' }}>{item.name}</span>
              {item.subtitle ? (
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--color-text-subtle)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {item.subtitle}
                </span>
              ) : null}
            </div>
            {item.shortcut && item.shortcut.length > 0 ? (
              <div style={{ display: 'flex', gap: 4 }}>
                {item.shortcut.map((s, i) => (
                  <span
                    key={`${item.id}-shortcut-${i}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: 20,
                      height: 20,
                      padding: '0 6px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      textTransform: 'uppercase',
                      color: 'var(--color-text-subtle)',
                      background: 'var(--color-surface-muted)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 4,
                    }}
                  >
                    {s}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        );
      }}
    />
  );
}
