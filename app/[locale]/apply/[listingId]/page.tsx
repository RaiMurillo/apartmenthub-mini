import { notFound } from 'next/navigation';
import ApplyForm from '@/components/ApplyForm';
import { requireUser } from '@/lib/auth';
import { formatCurrency } from '@/lib/format';
import { isLocale } from '@/lib/i18n/config';
import { dictionaries } from '@/lib/i18n/dictionaries';
import { createClient } from '@/lib/supabase/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ApplyPage({
  params,
}: {
  params: Promise<{ locale: string; listingId: string }>;
}) {
  const { locale, listingId } = await params;
  if (!isLocale(locale) || !UUID.test(listingId)) notFound();

  const user = await requireUser(locale, `/${locale}/apply/${listingId}`);
  const t = dictionaries[locale];

  const supabase = await createClient();
  const { data: listing } = await supabase
    .from('listings')
    .select('id, title, city, rent_eur')
    .eq('id', listingId)
    .maybeSingle();
  if (!listing) notFound();

  return (
    <div className="narrow">
      <h1>{t.apply.title}</h1>
      <p className="muted">
        <strong>{listing.title}</strong> · {listing.city} · {t.apply.rent}{' '}
        {formatCurrency(listing.rent_eur, locale)} {t.home.perMonth}
      </p>
      <p>{t.apply.intro}</p>

      <ApplyForm
        locale={locale}
        listingId={listing.id}
        labels={t.apply}
        validation={t.validation}
        errors={t.errors}
        defaults={{ fullName: user.fullName ?? '', email: user.email }}
      />
    </div>
  );
}
