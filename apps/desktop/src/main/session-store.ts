import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';

/**
 * Session persistence (Bloco D/D1 — docs/todo-mvp.md).
 *
 * Problem: the renderer keeps tokens in memory only (auth-store.ts, spec §20
 * anti-XSS posture), so every app restart forced a new login — unacceptable
 * for the workshop's daily machine.
 *
 * Solution: the REFRESH token is persisted on the Node side of the bridge —
 * never in the renderer, never in localStorage — inside `userData/`:
 *   - the directory already holds the database and JWT secrets (0700);
 *   - the file itself is written 0600 (R7/SEC-07 parity);
 *   - the renderer can only move tokens through the narrow IPC surface
 *     (save/clear/read), never touch the filesystem.
 *
 * The ACCESS token is NOT persisted (short-lived, 15 min): on boot the web
 * layer reads the stored refresh token and silently refreshes against the
 * API (rotating it — TokenService.rotateRefreshToken), restoring the full
 * session only if the token is still valid/active.
 *
 * The stored user is a convenience snapshot for instant paint of the shell;
 * the authoritative user comes from the refreshed access token payload.
 */

export interface StoredSession {
  /** ISO-8601 — lets the UI show "last used". */
  savedAt: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

const SESSION_FILE = 'session.json';

function sessionPath(): string {
  return join(app.getPath('userData'), SESSION_FILE);
}

function ensurePrivateDir(): void {
  try {
    mkdirSync(app.getPath('userData'), { recursive: true, mode: 0o700 });
    chmodSync(app.getPath('userData'), 0o700);
  } catch {
    // Filesystems without POSIX modes — best effort, never block boot.
  }
}

/** Persists the session (refresh token + user snapshot), 0600. */
export function saveSession(session: StoredSession): void {
  ensurePrivateDir();
  writeFileSync(sessionPath(), JSON.stringify(session, null, 2), { mode: 0o600 });
  chmodSync(sessionPath(), 0o600);
}

/** Reads the persisted session, or null when absent/corrupt. */
export function readSession(): StoredSession | null {
  try {
    if (!existsSync(sessionPath())) return null;
    const raw = readFileSync(sessionPath(), 'utf8');
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (
      typeof parsed.refreshToken !== 'string' ||
      parsed.refreshToken.length < 10 ||
      typeof parsed.user?.id !== 'string'
    ) {
      return null;
    }
    return parsed as StoredSession;
  } catch {
    // Corrupt file → treat as no session (user logs in again).
    return null;
  }
}

/** Wipes the stored session (logout, failed silent refresh, self pw change). */
export function clearSession(): void {
  try {
    rmSync(sessionPath(), { force: true });
  } catch {
    // Nothing to do — already absent.
  }
}
