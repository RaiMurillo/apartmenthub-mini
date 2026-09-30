import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { resolveLocale } from '@/lib/i18n/config';
import { dictionaries } from '@/lib/i18n/dictionaries';
import { formatCurrency } from '@/lib/format';
import type { Listing } from '@/lib/types';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await resolveLocale(params);
  const t = dictionaries[locale];

  // Listings are public: the RLS policy allows anonymous reads of active rows.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('listings')
    .select('id, title, city, rent_eur, bedrooms, description_nl, description_en')
    .eq('is_active', true)
    .order('rent_eur', { ascending: true });
  const listings = (data ?? []) as Listing[];

  return (
    <>
      <section className="hero">
        <h1>{t.home.title}</h1>
        <p>{t.home.subtitle}</p>
      </section>

      {error && <p className="form-error">{t.home.loadError}</p>}
      {!error && listings.length === 0 && <p className="muted">{t.home.empty}</p>}

      <div className="listing-grid">
        {listings.map((listing) => (
          <article key={listing.id} className="card listing">
            <p className="listing-city">{listing.city}</p>
            <h2>{listing.title}</h2>
            <p className="listing-meta">
              <strong>{formatCurrency(listing.rent_eur, locale)}</strong> {t.home.perMonth}
              {' · '}
              {listing.bedrooms === 0
                ? t.home.studio
                : `${listing.bedrooms} ${
                    listing.bedrooms === 1 ? t.home.bedroomOne : t.home.bedroomMany
                  }`}
            </p>
            <p className="muted">
              {locale === 'nl' ? listing.description_nl : listing.description_en}
            </p>
            <Link href={`/${locale}/apply/${listing.id}`} className="btn btn-primary">
              {t.home.apply}
            </Link>
          </article>
        ))}
      </div>
    </>
  );
}
