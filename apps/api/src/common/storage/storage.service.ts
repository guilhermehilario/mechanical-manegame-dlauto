import { createHash } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { dirname } from 'node:path';
import { Injectable } from '@nestjs/common';
import type { Env } from '@mechanic-system/config';
import { DomainError } from '../../common/errors/domain.error';
import { ErrorCodes } from '@mechanic-system/types';

/**
 * StorageService (Fase 6): content-addressed file storage on local disk.
 *
 * - Files are keyed by their own sha256 → identical bytes are stored once
 *   (dedup) and any corruption is detectable;
 * - Layout: <STORAGE_DIR>/ab/ab3f... (first 2 hex chars as a subdirectory,
 *   avoiding huge flat directories);
 * - The API validates mime + size from the REAL bytes (magic-number sniffing),
 *   never trusting client headers (spec security model);
 * - Everything is loopback/offline — no cloud dependency (offline-first §20).
 */

const MAGIC_BYTES: Array<{ mime: string; test: (bytes: Uint8Array) => boolean }> = [
  // JPEG: FF D8 FF
  {
    mime: 'image/jpeg',
    test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  // PNG: 89 50 4E 47
  {
    mime: 'image/png',
    test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  },
  // GIF: "GIF8"
  {
    mime: 'image/gif',
    test: (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38,
  },
  // WebP: "RIFF" .... "WEBP"
  {
    mime: 'image/webp',
    test: (b) =>
      b[0] === 0x52 &&
      b[1] === 0x49 &&
      b[2] === 0x46 &&
      b[3] === 0x46 &&
      b[8] === 0x57 &&
      b[9] === 0x45 &&
      b[10] === 0x42 &&
      b[11] === 0x50,
  },
];

export interface StoredFile {
  storageKey: string; // relative path under the storage root
  sha256: string;
  mimeType: string;
  sizeBytes: number;
}

@Injectable()
export class StorageService {
  private readonly root: string;

  constructor(env: Env) {
    this.root = resolve(process.cwd(), env.STORAGE_DIR);
  }

  /**
   * Persists bytes on disk after validating type/size from the bytes
   * themselves. Throws 413/415 DomainErrors on violation.
   */
  async save(buffer: Buffer, maxBytes: number, allowedMimes: readonly string[]): Promise<StoredFile> {
    if (buffer.length === 0) {
      throw new DomainError(ErrorCodes.UNSUPPORTED_MEDIA_TYPE, 'Arquivo vazio', 415);
    }
    if (buffer.length > maxBytes) {
      throw new DomainError(
        ErrorCodes.IMAGE_TOO_LARGE,
        `Arquivo excede o limite de ${Math.floor(maxBytes / 1024 / 1024)} MB`,
        413,
      );
    }
    const detected = detectMime(buffer);
    if (!detected || !allowedMimes.includes(detected)) {
      throw new DomainError(
        ErrorCodes.UNSUPPORTED_MEDIA_TYPE,
        'Formato de imagem não suportado (use JPEG, PNG, WebP ou GIF)',
        415,
      );
    }
    const sha256 = createHash('sha256').update(buffer).digest('hex');
    const storageKey = `${sha256.slice(0, 2)}/${sha256}`;
    const absolutePath = this.absolutePathFor(storageKey);
    try {
      await mkdir(dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, buffer, { flag: 'wx' }); // dedup: never rewrite
    } catch (error) {
      // EEXIST = same content already stored — fine. Anything else is real.
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw new DomainError(
          ErrorCodes.STORAGE_UNAVAILABLE,
          'Não foi possível gravar o arquivo no armazenamento local',
          500,
        );
      }
    }
    return { storageKey, sha256, mimeType: detected, sizeBytes: buffer.length };
  }

  /** Reads the bytes for a storage key (used by the download endpoint). */
  async read(storageKey: string): Promise<Buffer> {
    try {
      return await readFile(this.absolutePathFor(storageKey));
    } catch {
      throw new DomainError(ErrorCodes.IMAGE_NOT_FOUND, 'Arquivo não encontrado no disco', 404);
    }
  }

  /**
   * Removes the file only if no other DB row references the same content
   * (content addressing = shared bytes). The caller passes a reference count.
   */
  async removeIfUnused(storageKey: string, remainingReferences: number): Promise<void> {
    if (remainingReferences > 0) return;
    try {
      await unlink(this.absolutePathFor(storageKey));
    } catch {
      // Already gone — deletion is idempotent.
    }
  }

  absolutePathFor(storageKey: string): string {
    // Defense in depth: a key must never escape the storage root.
    const path = resolve(this.root, storageKey);
    if (!path.startsWith(this.root)) {
      throw new DomainError(ErrorCodes.VALIDATION_ERROR, 'Chave de armazenamento inválida', 400);
    }
    return join(path);
  }
}

/** Sniffs the MIME type from magic bytes; returns null when unrecognized. */
function detectMime(buffer: Buffer): string | null {
  const head = buffer.subarray(0, 12);
  for (const candidate of MAGIC_BYTES) {
    if (candidate.test(head)) return candidate.mime;
  }
  return null;
}
