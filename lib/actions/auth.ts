'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { toLocale, type Locale } from '@/lib/i18n/config';

export type AuthErrorCode =
  | 'missing_fields'
  | 'invalid_credentials'
  | 'signup_failed'
  | 'weak_password';

export interface AuthState {
  error?: AuthErrorCode;
  /** Set after sign-up when Supabase requires the user to confirm their email. */
  notice?: 'check_email';
}

/** Only allow redirects back into our own site, in the current language. */
function safeNext(next: FormDataEntryValue | null, locale: Locale): string {
  if (typeof next === 'string' && next.startsWith(`/${locale}/`) && !next.startsWith('//')) {
    return next;
  }
  return `/${locale}/applications`;
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const locale = toLocale(formData.get('locale'));
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  if (!email || !password) return { error: 'missing_fields' };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: 'invalid_credentials' };

  redirect(safeNext(formData.get('next'), locale));
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const locale = toLocale(formData.get('locale'));
  const fullName = String(formData.get('fullName') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  if (!fullName || !email || !password) return { error: 'missing_fields' };
  if (password.length < 8) return { error: 'weak_password' };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    // Picked up by the handle_new_user() trigger to fill profiles.full_name.
    options: { data: { full_name: fullName } },
  });
  if (error) return { error: 'signup_failed' };

  // With "Confirm email" enabled there is no session until the link is clicked.
  if (!data.session) return { notice: 'check_email' };

  redirect(safeNext(formData.get('next'), locale));
}

export async function signOut(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`/${locale}`);
}
