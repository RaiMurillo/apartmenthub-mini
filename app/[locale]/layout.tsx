import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import Header from '@/components/Header';
import { dictionaries } from '@/lib/i18n/dictionaries';
import { isLocale } from '@/lib/i18n/config';
import '../globals.css';

// Every page depends on the signed-in user (cookies), so nothing here can be
// prerendered at build time.
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { meta } = dictionaries[locale];
  return { title: meta.title, description: meta.description };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <html lang={locale}>
      <body>
        <Header locale={locale} />
        <main className="container main">{children}</main>
        <footer className="container footer">{dictionaries[locale].footer}</footer>
      </body>
    </html>
  );
}
