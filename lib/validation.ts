import { z } from 'zod';

export const ALLOWED_DOCUMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;

// Messages are *codes* (not sentences). The UI translates them with the
// `validation` section of the dictionary, so errors are bilingual.
const requiredText = (max: number) =>
  z.string().trim().min(1, 'required').max(max, 'out_of_range');

const wholeNumber = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(1, 'required')
    .pipe(
      z.coerce
        .number({ invalid_type_error: 'invalid_number' })
        .int('invalid_number')
        .min(min, 'out_of_range')
        .max(max, 'out_of_range'),
    );

export const applicationSchema = z.object({
  fullName: requiredText(120).pipe(z.string().min(2, 'too_short')),
  email: z.string().trim().min(1, 'required').pipe(z.string().email('invalid_email')),
  phone: z.string().trim().max(30, 'out_of_range'),
  monthlyIncome: wholeNumber(0, 1_000_000),
  householdSize: wholeNumber(1, 12),
  moveInDate: z
    .string()
    .trim()
    .min(1, 'required')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'invalid_date')
    .refine((value) => !Number.isNaN(Date.parse(value)), 'invalid_date'),
  message: z.string().trim().max(1000, 'out_of_range'),
});

export type ApplicationInput = z.infer<typeof applicationSchema>;
export type ApplicationField = keyof ApplicationInput | 'document';

export type FileErrorCode = 'file_required' | 'file_type' | 'file_size';

export function validateDocument(file: FormDataEntryValue | null): FileErrorCode | null {
  if (!(file instanceof File) || file.size === 0) return 'file_required';
  if (!ALLOWED_DOCUMENT_TYPES.includes(file.type)) return 'file_type';
  if (file.size > MAX_DOCUMENT_BYTES) return 'file_size';
  return null;
}

/** Keep only characters that are safe in a storage object path. */
export function safeFileName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
  return cleaned.slice(-80) || 'document';
}
