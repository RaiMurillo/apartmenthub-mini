import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { signOut } from '@/lib/actions/auth';
import { dictionaries } from '@/lib/i18n/dictionaries';
import type { Locale } from '@/lib/i18n/config';
import LanguageSwitcher from './LanguageSwitcher';

export default async function Header({ locale }: { locale: Locale }) {
  const t = dictionaries[locale];
  const user = await getCurrentUser();

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link href={`/${locale}`} className="brand">
          ApartmentHub<span>Mini</span>
        </Link>

        <nav className="nav" aria-label="Main">
          <Link href={`/${locale}`}>{t.nav.listings}</Link>
          {user && <Link href={`/${locale}/applications`}>{t.nav.myApplications}</Link>}
          {user?.role === 'admin' && (
            <>
              <Link href={`/${locale}/admin`}>{t.nav.admin}</Link>
              <Link href={`/${locale}/admin/report`}>{t.nav.report}</Link>
            </>
          )}
        </nav>

        <div className="header-actions">
          <LanguageSwitcher locale={locale} />
          {user ? (
            <form action={signOut}>
              <input type="hidden" name="locale" value={locale} />
              <button type="submit" className="btn btn-ghost">
                {t.nav.logout}
              </button>
            </form>
          ) : (
            <Link href={`/${locale}/login`} className="btn btn-primary">
              {t.nav.login}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
