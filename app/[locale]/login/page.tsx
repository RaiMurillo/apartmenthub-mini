import { redirect } from 'next/navigation';
import AuthForm from '@/components/AuthForm';
import { getCurrentUser } from '@/lib/auth';
import { resolveLocale } from '@/lib/i18n/config';
import { dictionaries } from '@/lib/i18n/dictionaries';

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const locale = await resolveLocale(params);
  const { next } = await searchParams;
  const t = dictionaries[locale];

  const destination = next ?? `/${locale}/applications`;
  if (await getCurrentUser()) redirect(destination.startsWith(`/${locale}/`) ? destination : `/${locale}`);

  return <AuthForm locale={locale} next={destination} t={t.auth} errors={t.errors} />;
}
