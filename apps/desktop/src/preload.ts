import { contextBridge, ipcRenderer } from 'electron';

type ThemeMode = 'light' | 'dark' | 'system';

interface AppInfo {
  platform: NodeJS.Platform;
  isDesktop: boolean;
  version: string;
  appName: string;
}

// The renderer talks to the main process exclusively through this
// bridge — never via direct ipcRenderer access (sandbox is on). PR16
// will extend this with `bridge.db.*`; keep the shape additive so the
// renderer can ship a single union type that always reflects the
// latest capabilities.
const bridge = {
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('window:toggleMaximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized') as Promise<boolean>,
  },
  theme: {
    getSystem: () => ipcRenderer.invoke('theme:get-system') as Promise<'light' | 'dark'>,
    set: (mode: ThemeMode) => ipcRenderer.invoke('theme:set', mode),
    onSystemChanged: (cb: (mode: 'light' | 'dark') => void) => {
      const handler = (_event: unknown, mode: 'light' | 'dark') => cb(mode);
      ipcRenderer.on('theme:system-changed', handler);
      return () => ipcRenderer.removeListener('theme:system-changed', handler);
    },
  },
  app: {
    getInfo: () => ipcRenderer.invoke('app:get-info') as Promise<AppInfo>,
  },
  platform: process.platform,
} as const;

contextBridge.exposeInMainWorld('bridge', bridge);

export type Bridge = typeof bridge;
