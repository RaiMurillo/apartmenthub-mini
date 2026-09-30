'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';
import { toLocale } from '@/lib/i18n/config';
import {
  applicationSchema,
  safeFileName,
  validateDocument,
  type ApplicationField,
} from '@/lib/validation';

export interface ApplyState {
  /** Field name -> error code (translated in the form component). */
  fieldErrors?: Partial<Record<ApplicationField, string>>;
  formError?: 'generic' | 'duplicate' | 'upload_failed' | 'listing_not_found';
  /** Submitted text values, so the form can be re-filled after an error. */
  values?: Record<string, string>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function submitApplication(_prev: ApplyState, formData: FormData): Promise<ApplyState> {
  const locale = toLocale(formData.get('locale'));
  const listingId = String(formData.get('listingId') ?? '');
  const user = await requireUser(locale);

  const raw = {
    fullName: String(formData.get('fullName') ?? ''),
    email: String(formData.get('email') ?? ''),
    phone: String(formData.get('phone') ?? ''),
    monthlyIncome: String(formData.get('monthlyIncome') ?? ''),
    householdSize: String(formData.get('householdSize') ?? ''),
    moveInDate: String(formData.get('moveInDate') ?? ''),
    message: String(formData.get('message') ?? ''),
  };

  if (!UUID.test(listingId)) return { formError: 'listing_not_found', values: raw };

  // 1. Validate on the server (never trust the browser).
  const parsed = applicationSchema.safeParse(raw);
  const fieldErrors: NonNullable<ApplyState['fieldErrors']> = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0]) as ApplicationField;
      fieldErrors[field] ??= issue.message; // keep the first error per field
    }
  }
  const file = formData.get('document');
  const fileError = validateDocument(file);
  if (fileError) fieldErrors.document = fileError;

  if (!parsed.success || fileError || !(file instanceof File)) {
    return { fieldErrors, values: raw };
  }

  const supabase = await createClient();

  // 2. Upload the document into the user's own folder of the private bucket.
  const documentPath = `${user.id}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(documentPath, file, { contentType: file.type });
  if (uploadError) return { formError: 'upload_failed', values: raw };

  // 3. Insert the application. tenant_id defaults to auth.uid() in the
  //    database, and RLS rejects anything that is not the caller's own row.
  const data = parsed.data;
  const { error: insertError } = await supabase.from('applications').insert({
    listing_id: listingId,
    full_name: data.fullName,
    email: data.email,
    phone: data.phone || null,
    monthly_income_eur: data.monthlyIncome,
    household_size: data.householdSize,
    move_in_date: data.moveInDate,
    message: data.message || null,
    document_path: documentPath,
  });

  if (insertError) {
    // Don't leave an orphaned file behind.
    await supabase.storage.from('documents').remove([documentPath]);
    if (insertError.code === '23505') return { formError: 'duplicate', values: raw }; // unique violation
    if (insertError.code === '23503') return { formError: 'listing_not_found', values: raw }; // FK violation
    return { formError: 'generic', values: raw };
  }

  redirect(`/${locale}/applications?submitted=1`);
}
