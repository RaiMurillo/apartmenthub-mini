import { notFound } from 'next/navigation';

export const locales = ['nl', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'nl';

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}

/** Narrow an untrusted form value to a Locale, falling back to the default. */
export function toLocale(value: FormDataEntryValue | null): Locale {
  return typeof value === 'string' && isLocale(value) ? value : defaultLocale;
}

/** Read the [locale] route param and 404 if it is not a supported language. */
export async function resolveLocale(params: Promise<{ locale: string }>): Promise<Locale> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return locale;
}
