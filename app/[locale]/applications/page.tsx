import Link from 'next/link';
import StatusBadge from '@/components/StatusBadge';
import { requireUser } from '@/lib/auth';
import { withDocumentUrls } from '@/lib/documents';
import { formatDate } from '@/lib/format';
import { resolveLocale } from '@/lib/i18n/config';
import { dictionaries } from '@/lib/i18n/dictionaries';
import { createClient } from '@/lib/supabase/server';
import type { ApplicationRow } from '@/lib/types';

export default async function ApplicationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ submitted?: string }>;
}) {
  const locale = await resolveLocale(params);
  const { submitted } = await searchParams;
  await requireUser(locale, `/${locale}/applications`);
  const t = dictionaries[locale];

  // No .eq('tenant_id', ...) filter on purpose: row-level security already
  // limits this query to the signed-in tenant's own rows.
  const supabase = await createClient();
  const { data } = await supabase
    .from('applications')
    .select(
      'id, full_name, email, monthly_income_eur, household_size, move_in_date, status, document_path, created_at, listing:listings(title, city)',
    )
    .order('created_at', { ascending: false });

  const rows = await withDocumentUrls(supabase, (data ?? []) as unknown as ApplicationRow[]);

  return (
    <>
      <h1>{t.applications.title}</h1>

      {submitted && (
        <p role="status" className="form-notice">
          {t.applications.submittedBanner}
        </p>
      )}

      {rows.length === 0 ? (
        <div className="card empty">
          <p className="muted">{t.applications.empty}</p>
          <Link href={`/${locale}`} className="btn btn-primary">
            {t.applications.browse}
          </Link>
        </div>
      ) : (
        <ul className="application-list">
          {rows.map((row) => (
            <li key={row.id} className="card application">
              <div>
                <h2>{row.listing?.title}</h2>
                <p className="muted">
                  {row.listing?.city} · {t.applications.submitted}{' '}
                  {formatDate(row.created_at, locale)}
                </p>
                {row.documentUrl && (
                  <a href={row.documentUrl} target="_blank" rel="noopener noreferrer">
                    {t.applications.viewDocument}
                  </a>
                )}
              </div>
              <StatusBadge status={row.status} label={t.status[row.status]} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
