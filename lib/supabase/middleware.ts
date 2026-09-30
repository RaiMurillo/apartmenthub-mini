import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Locale } from '@/lib/i18n/config';
import { getSupabaseEnv } from './env';

const PROTECTED = /^\/(nl|en)\/(applications|apply|admin)(\/|$)/;

/**
 * Runs on every request: refreshes the Supabase session cookie and sends
 * signed-out visitors away from pages that need a login.
 * (Authorization, e.g. "is this an admin?", is checked again on the server
 * in the pages themselves. The middleware is only a convenience.)
 */
export async function updateSession(request: NextRequest, locale: Locale) {
  let response = NextResponse.next({ request });
  const { url, anonKey } = getSupabaseEnv();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // getUser() verifies the token with Supabase (unlike getSession()).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;
  if (!user && PROTECTED.test(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = `/${locale}/login`;
    loginUrl.search = `?next=${encodeURIComponent(pathname + search)}`;
    const redirect = NextResponse.redirect(loginUrl);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  return response;
}
