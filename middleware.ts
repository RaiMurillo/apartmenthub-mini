import { NextResponse, type NextRequest } from 'next/server';
import { defaultLocale, isLocale, type Locale } from '@/lib/i18n/config';
import { updateSession } from '@/lib/supabase/middleware';

function preferredLocale(request: NextRequest): Locale {
  const saved = request.cookies.get('NEXT_LOCALE')?.value;
  if (isLocale(saved)) return saved;

  // "en-US,en;q=0.9,nl;q=0.8" -> ['en', 'en', 'nl']
  const tags = (request.headers.get('accept-language') ?? '')
    .split(',')
    .map((part) => part.split(';')[0].trim().slice(0, 2).toLowerCase());
  return tags.find(isLocale) ?? defaultLocale;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const segment = pathname.split('/')[1];

  // "/" or "/apply/123" without a language -> redirect to "/nl/..." or "/en/..."
  if (!isLocale(segment)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${preferredLocale(request)}${pathname === '/' ? '' : pathname}`;
    return NextResponse.redirect(url);
  }

  const response = await updateSession(request, segment);
  response.cookies.set('NEXT_LOCALE', segment, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });
  return response;
}

export const config = {
  // Skip Next.js internals and static files (anything with a file extension).
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
