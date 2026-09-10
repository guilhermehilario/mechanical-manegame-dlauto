import { contextBridge, ipcRenderer } from 'electron';

/**
 * Preload bridge (spec §21).
 * The renderer gets a minimal, typed surface — no Node, no fs, no shell.
 */
const api = {
  getApiBaseUrl(): Promise<string> {
    return ipcRenderer.invoke('api:get-base-url');
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
};

contextBridge.exposeInMainWorld('desktopApi', api);

export type DesktopApi = typeof api;
