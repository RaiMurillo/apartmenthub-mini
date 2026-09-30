import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Locale } from '@/lib/i18n/config';

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string | null;
  role: 'tenant' | 'admin';
}

/** The signed-in user plus their profile, or null. Cached per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // RLS lets a user read only their own profile row.
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email ?? '',
    fullName: profile?.full_name ?? null,
    role: profile?.role === 'admin' ? 'admin' : 'tenant',
  };
});

export async function requireUser(locale: Locale, returnTo?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    const next = returnTo ? `?next=${encodeURIComponent(returnTo)}` : '';
    redirect(`/${locale}/login${next}`);
  }
  return user;
}

export async function requireAdmin(locale: Locale): Promise<CurrentUser> {
  const user = await requireUser(locale, `/${locale}/admin`);
  if (user.role !== 'admin') redirect(`/${locale}`);
  return user;
}
