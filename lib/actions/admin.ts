'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { toLocale } from '@/lib/i18n/config';
import { isStatus } from '@/lib/types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function updateStatus(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  await requireAdmin(locale); // must be a signed-in admin

  const id = String(formData.get('id') ?? '');
  const to = String(formData.get('to') ?? '');
  if (!UUID.test(id) || !isStatus(to)) redirect(`/${locale}/admin?error=transition`);

  const supabase = await createClient();
  // Three layers protect this update:
  //  1. requireAdmin() above,
  //  2. RLS: only admins may UPDATE applications,
  //  3. a database trigger that rejects invalid status transitions.
  const { data, error } = await supabase
    .from('applications')
    .update({ status: to })
    .eq('id', id)
    .select('id');

  if (error || !data?.length) redirect(`/${locale}/admin?error=transition`);

  revalidatePath(`/${locale}/admin`);
  redirect(`/${locale}/admin`);
}
