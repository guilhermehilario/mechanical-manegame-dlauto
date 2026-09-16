import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { clearSession, readSession, saveSession, type StoredSession } from './session-store';

/**
 * IPC surface (spec §21). Only non-dangerous data crosses the bridge.
 *
 * Session persistence (Bloco D/D1): save/clear/read only — no filesystem
 * paths, no arbitrary read/write from the renderer. Payloads are sanitized
 * (shape + length caps) before touching the disk, and a destroyed sender is
 * rejected so no dead webview can drive the session store.
 */
export function registerIpcHandlers(getApiBaseUrl: () => string): void {
  ipcMain.handle('api:get-base-url', (event: IpcMainInvokeEvent) => {
    assertLiveSender(event);
    return getApiBaseUrl();
  });

  ipcMain.handle('session:save', (event: IpcMainInvokeEvent, session: unknown) => {
    assertLiveSender(event);
    saveSession(sanitizeSession(session));
  });

  ipcMain.handle('session:clear', (event: IpcMainInvokeEvent) => {
    assertLiveSender(event);
    clearSession();
  });

  ipcMain.handle('session:read', (event: IpcMainInvokeEvent) => {
    assertLiveSender(event);
    return readSession();
  });
}

// ─── Guardrails ──────────────────────────────────────────────────────────────

/** Rejects destroyed senders (defense in depth — spec §21 lockdown). */
function assertLiveSender(event: IpcMainInvokeEvent): void {
  if (event.sender.isDestroyed()) {
    throw new Error('IPC sender destroyed');
  }
}

function capped(value: unknown, max: number): string {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

/** Normalizes the renderer payload to the exact stored shape. */
function sanitizeSession(input: unknown): StoredSession {
  const raw = (input ?? {}) as Partial<StoredSession>;
  return {
    savedAt: new Date().toISOString(),
    refreshToken: capped(raw.refreshToken, 2048),
    user: {
      id: capped(raw.user?.id, 128),
      name: capped(raw.user?.name, 120),
      email: capped(raw.user?.email, 255),
      role: capped(raw.user?.role, 32),
    },
  };
}
