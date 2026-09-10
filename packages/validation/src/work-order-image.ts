import { z } from 'zod';
import { idSchema } from './common';

/**
 * Image schemas (Fase 6). The binary travels as multipart/form-data; these
 * schemas validate the metadata the client may set — size/mime are enforced
 * server-side from the actual bytes, never trusted from the client.
 */

export const workOrderImageIdSchema = idSchema;

/** Max upload size: 5 MB (enforced against the real byte count). */
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

/** Allowed image MIME types (checked against magic bytes server-side). */
export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

export const imageCaptionSchema = z
  .string()
  .trim()
  .max(200, 'Legenda deve ter no máximo 200 caracteres')
  .optional()
  .or(z.literal(''));

export type ImageCaptionInput = z.infer<typeof imageCaptionSchema>;

/** Query for listing a work order's images. */
export const workOrderImageQuerySchema = z.object({}).strip();
