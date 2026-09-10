import { z } from 'zod';

/**
 * Report query schemas (Fase 8).
 * Periods are inclusive `YYYY-MM-DD` dates resolved in the workshop's
 * local timezone server-side. Unknown keys are rejected (spec §30-style).
 */

const reportPeriodObjectSchema = z.object({
  from: z.string().date('Formato de data inválido (use YYYY-MM-DD)').optional(),
  to: z.string().date('Formato de data inválido (use YYYY-MM-DD)').optional(),
});

const periodOrdering = (data: { from?: string; to?: string }) =>
  data.from === undefined || data.to === undefined || data.from <= data.to;

export const reportPeriodSchema = reportPeriodObjectSchema.strict().refine(periodOrdering, {
  message: '`from` deve ser anterior ou igual a `to`',
  path: ['from'],
});

export type ReportPeriodQuery = z.infer<typeof reportPeriodSchema>;

export const topReportQuerySchema = reportPeriodObjectSchema
  .extend({
    limit: z.coerce
      .number({ invalid_type_error: 'Limite deve ser um número' })
      .int('Limite deve ser inteiro')
      .min(1)
      .max(50)
      .default(10),
  })
  .strict()
  .refine(periodOrdering, {
    message: '`from` deve ser anterior ou igual a `to`',
    path: ['from'],
  });

export type TopReportQuery = z.infer<typeof topReportQuerySchema>;