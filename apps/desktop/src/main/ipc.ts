import { ipcMain } from 'electron';

/**
 * IPC surface (spec §21). Only non-dangerous data crosses the bridge.
 */
export function registerIpcHandlers(getApiBaseUrl: () => string): void {
  ipcMain.handle('api:get-base-url', () => getApiBaseUrl());
}
