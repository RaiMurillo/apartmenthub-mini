'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { locales, type Locale } from '@/lib/i18n/config';

/** Swaps the first path segment ("/nl/apply/1" -> "/en/apply/1"). */
export default function LanguageSwitcher({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const rest = pathname.split('/').slice(2).join('/');

  return (
    <div className="lang-switch" role="group" aria-label="Language">
      {locales.map((code) => (
        <Link
          key={code}
          href={`/${code}${rest ? `/${rest}` : ''}`}
          lang={code}
          hrefLang={code}
          className={code === locale ? 'active' : undefined}
          aria-current={code === locale ? 'true' : undefined}
        >
          {code.toUpperCase()}
        </Link>
      ))}
    </div>
  );
}
