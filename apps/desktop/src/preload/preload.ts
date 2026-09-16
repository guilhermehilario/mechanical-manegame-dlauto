import { contextBridge, ipcRenderer } from 'electron';

/**
 * Preload bridge (spec §21).
 * The renderer gets a minimal, typed surface — no Node, no fs, no shell.
 *
 * R2 (REL-01/SEC-03): `getApiBaseUrl` MUST be synchronous. The old version
 * returned a Promise (ipcRenderer.invoke) while the web layer treats the
 * bridge result as a string, so the packaged app fetched `[object Promise]`.
 * The main process passes the final URL via webPreferences
 * `additionalArguments` (`--mechanic-api-base-url=…`), which lands in
 * process.argv here — no async round-trip, correct even before
 * `did-finish-load`. `onApiReady` stays event-based for ordering concerns.
 *
 * Session persistence (Bloco D/D1): `saveSession`/`clearSession`/`readSession`
 * proxy the userData-backed store on the main process. Only the refresh token
 * + a user snapshot travel through this narrow surface — the access token is
 * never persisted anywhere.
 */

/** Reads the injected `--mechanic-api-base-url=` argument, if present. */
function apiBaseUrlFromArgv(): string | null {
  const prefix = '--mechanic-api-base-url=';
  const arg = process.argv.find((value) => value.startsWith(prefix));
  return arg ? decodeURIComponent(arg.slice(prefix.length)) : null;
}

/** Shape exchanged over the bridge (mirrors main/session-store.ts). */
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

const api = {
  /** Synchronous: the URL is injected via additionalArguments (see above). */
  getApiBaseUrl(): string {
    return apiBaseUrlFromArgv() ?? '';
  },
  onApiReady(callback: (payload: { baseUrl: string }) => void): () => void {
    const listener = (_event: unknown, payload: { baseUrl: string }): void => {
      callback(payload);
    };
    ipcRenderer.on('api:ready', listener);
    return () => {
      ipcRenderer.off('api:ready', listener);
    };
  },
  saveSession(session: DesktopStoredSession): Promise<void> {
    return ipcRenderer.invoke('session:save', session) as Promise<void>;
  },
  clearSession(): Promise<void> {
    return ipcRenderer.invoke('session:clear') as Promise<void>;
  },
  readSession(): Promise<DesktopStoredSession | null> {
    return ipcRenderer.invoke('session:read') as Promise<DesktopStoredSession | null>;
  },
};

contextBridge.exposeInMainWorld('desktopApi', api);

export type DesktopApi = typeof api;
