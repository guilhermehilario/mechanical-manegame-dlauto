/**
 * Typed access to the Electron preload bridge (`window.desktopApi`).
 *
 * In a plain browser (vite dev server) the bridge is absent — every helper
 * degrades gracefully so the web app keeps working unchanged (spec §22: same
 * code for web and desktop flows).
 */

export interface DesktopStoredSession {
  savedAt: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

interface DesktopBridge {
  getApiBaseUrl?: () => string;
  onApiReady?: (callback: (payload: { baseUrl: string }) => void) => () => void;
  saveSession?: (session: DesktopStoredSession) => Promise<void>;
  clearSession?: () => Promise<void>;
  readSession?: () => Promise<DesktopStoredSession | null>;
}

function bridge(): DesktopBridge | null {
  return (window as unknown as { desktopApi?: DesktopBridge }).desktopApi ?? null;
}

/** True when running inside Electron (bridge present). */
export function isDesktop(): boolean {
  return bridge() !== null;
}

export function saveSessionToDesktop(session: DesktopStoredSession): Promise<void> {
  const api = bridge();
  return api?.saveSession ? api.saveSession(session) : Promise.resolve();
}

export function clearDesktopSession(): Promise<void> {
  const api = bridge();
  return api?.clearSession ? api.clearSession() : Promise.resolve();
}

export function readDesktopSession(): Promise<DesktopStoredSession | null> {
  const api = bridge();
  if (!api?.readSession) return Promise.resolve(null);
  return api.readSession();
}
