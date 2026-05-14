import { Maximize2, Minus, Square, X } from '@cu/icons';
import { useEffect, useState } from 'react';
import { cn } from '../utils';

export interface TitleBarControlsProps {
  /** Pixel height of the bar; defaults to 36 to match Electron `titleBarOverlay.height`. */
  height?: number;
  className?: string;
  hidden?: boolean;
}

interface ElectronWindowBridge {
  minimize: () => Promise<unknown>;
  toggleMaximize: () => Promise<unknown>;
  close: () => Promise<unknown>;
  isMaximized: () => Promise<boolean>;
}

interface BridgeShape {
  window?: ElectronWindowBridge;
  platform?: string;
}

declare global {
  interface Window {
    bridge?: BridgeShape;
  }
}

/**
 * Custom Win11 titlebar overlay buttons.
 *
 * In Electron we hide the native title bar via `titleBarStyle: 'hidden'` and
 * `titleBarOverlay`, and draw the controls ourselves so the bar visually merges
 * with the app background. On non-Electron environments the buttons no-op.
 */
export function TitleBarControls({ height = 36, className, hidden }: TitleBarControlsProps) {
  const [isMaximized, setIsMaximized] = useState(false);
  const bridge = typeof window !== 'undefined' ? window.bridge?.window : undefined;
  const isElectron = typeof window !== 'undefined' && Boolean(window.bridge);
  const platform = typeof window !== 'undefined' ? window.bridge?.platform : undefined;
  const isMac = platform === 'darwin';

  useEffect(() => {
    if (!bridge) return;
    void bridge.isMaximized().then(setIsMaximized);
    const interval = setInterval(() => {
      void bridge.isMaximized().then(setIsMaximized);
    }, 1000);
    return () => clearInterval(interval);
  }, [bridge]);

  if (hidden || isMac) return null;

  return (
    <div
      className={cn('app-no-drag fixed top-0 right-0 z-[1010] flex items-stretch', className)}
      style={{ height }}
    >
      <ChromeButton label="Minimize" onClick={() => bridge?.minimize()} disabled={!isElectron}>
        <Minus size={14} />
      </ChromeButton>
      <ChromeButton
        label={isMaximized ? 'Restore' : 'Maximize'}
        onClick={() => bridge?.toggleMaximize()}
        disabled={!isElectron}
      >
        {isMaximized ? <Maximize2 size={12} /> : <Square size={12} />}
      </ChromeButton>
      <ChromeButton label="Close" danger onClick={() => bridge?.close()} disabled={!isElectron}>
        <X size={14} />
      </ChromeButton>
    </div>
  );
}

function ChromeButton({
  children,
  onClick,
  label,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center px-3.5 h-full text-[var(--color-text-muted)]',
        'transition-colors duration-[100ms]',
        'hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)]',
        danger && 'hover:bg-[#E81123] hover:text-white',
        'disabled:opacity-40 disabled:pointer-events-none',
        'focus-visible:outline-none focus-visible:bg-[var(--color-surface-muted)]',
      )}
    >
      {children}
    </button>
  );
}
