import type { Locale } from './i18n/config';

const intlLocale: Record<Locale, string> = { nl: 'nl-NL', en: 'en-GB' };

export function formatCurrency(amount: number, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale[locale], {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(value: number, locale: Locale, maximumFractionDigits = 1): string {
  return new Intl.NumberFormat(intlLocale[locale], { maximumFractionDigits }).format(value);
}

/** Works for both timestamps and date-only strings ("2026-12-01"). */
export function formatDate(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale[locale], {
    dateStyle: 'medium',
    timeZone: 'Europe/Amsterdam',
  }).format(new Date(value));
}
