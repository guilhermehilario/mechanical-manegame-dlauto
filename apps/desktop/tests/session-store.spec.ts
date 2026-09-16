import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Bloco D/D1 — desktop session store. The module imports `electron` (app
 *.getPath), so the Electron module is mocked to a temp userData dir; the
 * filesystem interactions are REAL (persistence is the whole point).
 */

const userDataDir = vi.hoisted(() => ({ current: '' }));

vi.mock('electron', () => ({
  app: {
    getPath: (_name: string) => userDataDir.current,
  },
}));

import {
  saveSession,
  readSession,
  clearSession,
  type StoredSession,
} from '../src/main/session-store';

function makeSession(overrides: Partial<StoredSession> = {}): StoredSession {
  return {
    savedAt: new Date().toISOString(),
    refreshToken: 'rt_' + 'a'.repeat(40),
    user: { id: 'usr_1', name: 'Admin', email: 'a@b.c', role: 'ADMIN' },
    ...overrides,
  };
}

describe('desktop session-store (D1)', () => {
  beforeEach(() => {
    userDataDir.current = mkdtempSync(join(tmpdir(), 'mechanic-session-'));
  });

  afterEach(() => {
    rmSync(userDataDir.current, { recursive: true, force: true });
  });

  it('saves and reads back a session', () => {
    const session = makeSession();
    saveSession(session);

    expect(readSession()).toMatchObject({
      refreshToken: session.refreshToken,
      user: session.user,
    });
  });

  it('writes the file with owner-only permissions (0600)', () => {
    saveSession(makeSession());
    const file = join(userDataDir.current, 'session.json');
    expect(existsSync(file)).toBe(true);
    // Only the owner bits may be set.
    expect(statSync(file).mode & 0o777).toBe(0o600);
  });

  it('returns null when there is no session', () => {
    expect(readSession()).toBeNull();
  });

  it('returns null for a corrupt file (recovers by re-login)', () => {
    saveSession(makeSession());
    const file = join(userDataDir.current, 'session.json');
    const mode = statSync(file).mode;
    rmSync(file);
    const { writeFileSync } = require('node:fs') as typeof import('node:fs');
    writeFileSync(file, '{not json', { mode });
    expect(readSession()).toBeNull();
  });

  it('rejects a stored payload without a usable refresh token', () => {
    saveSession(makeSession({ refreshToken: 'short' }));
    expect(readSession()).toBeNull();
  });

  it('clearSession removes the file', () => {
    saveSession(makeSession());
    clearSession();
    expect(existsSync(join(userDataDir.current, 'session.json'))).toBe(false);
    expect(readSession()).toBeNull();
  });

  it('keeps the refresh token intact on disk (needed for rotation)', () => {
    const token = 'rt_' + 'z'.repeat(50);
    saveSession(makeSession({ refreshToken: token }));
    const raw = JSON.parse(
      readFileSync(join(userDataDir.current, 'session.json'), 'utf8'),
    ) as { refreshToken: string };
    expect(raw.refreshToken).toBe(token);
  });
});
