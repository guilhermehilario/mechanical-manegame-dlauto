/**
 * API base URL resolution.
 *  - Browser/dev: vite env var or default localhost:3001;
 *  - Electron: main process injects window.desktopApi.getApiBaseUrl()
 *    (the API runs in-process on 127.0.0.1 with an ephemeral port).
 */
export function resolveApiBaseUrl(): string {
  interface DesktopBridge {
    getApiBaseUrl?: () => string;
  }
  const bridge = (window as unknown as { desktopApi?: DesktopBridge }).desktopApi;
  const fromDesktop = bridge?.getApiBaseUrl?.();
  if (fromDesktop) return fromDesktop;

  const fromEnv = import.meta.env.VITE_API_URL as string | undefined;
  return fromEnv ?? 'http://127.0.0.1:3001/api/v1';
}
