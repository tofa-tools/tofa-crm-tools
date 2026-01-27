import { z } from 'zod';

export const ImportPreviewRowSchema = z.object({
  data: z.record(z.any()),
  errors: z.array(z.string()),
  row_index: z.number().optional(),
});

export const ImportPreviewResponseSchema = z.object({
  total_rows: z.number(),
  valid_rows: z.number(),
  invalid_rows: z.number(),
  total_errors: z.number(),
  preview_data: z.object({
    valid: z.array(ImportPreviewRowSchema),
    invalid: z.array(ImportPreviewRowSchema),
  }),
  summary: z.object({
    valid_count: z.number(),
    invalid_count: z.number(),
    error_count: z.number(),
  }),
  column_mapping: z.record(z.string()).optional(),
  available_columns: z.array(z.string()).optional(),
  required_columns: z.record(z.string()).optional(),
});

export type ImportPreviewRow = z.infer<typeof ImportPreviewRowSchema>;
export type ImportPreviewResponse = z.infer<typeof ImportPreviewResponseSchema>;

