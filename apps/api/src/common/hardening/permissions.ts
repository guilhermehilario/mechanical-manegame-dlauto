import { chmod, mkdir, readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';

/**
 * Data-directory hardening (R7/SEC-07, Fase 10).
 *
 * All local data (SQLite database, uploaded images/signatures, backups) is
 * PII-bearing and lives unencrypted on disk (documented trade-off — ADR-006).
 * The mitigation adopted: restrictive POSIX permissions — directories 0700,
 * files 0600 — so only the owner (the OS user running the shop terminal) can
 * read them. On Windows the POSIX bits map to the equivalent ACL (owner-only)
 * for the default single-user install.
 */

/** Ensure a directory exists with mode 0700 (idempotent, recursive). */
export async function ensurePrivateDir(path: string): Promise<string> {
  const absolute = resolve(path);
  await mkdir(absolute, { recursive: true, mode: 0o700 });
  try {
    await chmod(absolute, 0o700);
  } catch {
    // chmod can fail on filesystems without POSIX modes (e.g. some Windows
    // mounts); creation mode was already requested — not fatal.
  }
  return absolute;
}

/**
 * Applies 0700 to `root` itself, then 0600 to files and 0700 to
 * subdirectories recursively — used at boot for the storage tree (sha256
 * shard layout) and over backup folders.
 */
export async function hardenTree(root: string): Promise<void> {
  await chmod(root, 0o700).catch(() => undefined);
  let entries: Array<{ name: string; isDirectory: () => boolean; isFile: () => boolean }>;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return; // nothing to harden yet
  }
  for (const entry of entries) {
    const child = join(root, entry.name);
    if (entry.isDirectory()) {
      await chmod(child, 0o700).catch(() => undefined);
      await hardenTree(child);
    } else if (entry.isFile()) {
      await chmod(child, 0o600).catch(() => undefined);
    }
  }
}

/**
 * Boot-time hardening of every local-data location the API owns.
 * Best-effort on permission failures (never blocks boot), but directory
 * creation errors propagate — the API cannot run without its data dirs.
 */
export async function hardenDataDirectories(databaseDir: string, storageDir: string, backupDir: string): Promise<void> {
  await ensurePrivateDir(databaseDir);
  await ensurePrivateDir(storageDir);
  await ensurePrivateDir(backupDir);
  // Existing content (created before Fase 10) gets tightened too.
  await hardenTree(storageDir).catch(() => undefined);
  await hardenTree(backupDir).catch(() => undefined);
}

/** Used by tests: reads the POSIX mode of a path. */
export async function modeOf(path: string): Promise<number> {
  const info = await stat(path);
  return info.mode & 0o777;
}
