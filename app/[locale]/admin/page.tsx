import Link from 'next/link';
import { updateStatus } from '@/lib/actions/admin';
import { requireAdmin } from '@/lib/auth';
import { withDocumentUrls } from '@/lib/documents';
import { formatCurrency, formatDate } from '@/lib/format';
import { resolveLocale } from '@/lib/i18n/config';
import { dictionaries } from '@/lib/i18n/dictionaries';
import { createClient } from '@/lib/supabase/server';
import { NEXT_STATUSES, STATUSES, type ApplicationRow } from '@/lib/types';

export default async function AdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const locale = await resolveLocale(params);
  const { error: actionError } = await searchParams;
  await requireAdmin(locale); // checked here too: never rely on the middleware alone
  const t = dictionaries[locale];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('applications')
    .select(
      'id, full_name, email, monthly_income_eur, household_size, move_in_date, status, document_path, created_at, listing:listings(title, city)',
    )
    .order('created_at', { ascending: true });

  const rows = await withDocumentUrls(supabase, (data ?? []) as unknown as ApplicationRow[]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{t.admin.title}</h1>
          <p className="muted">{t.admin.subtitle}</p>
        </div>
        <Link href={`/${locale}/admin/report`} className="btn btn-ghost">
          {t.admin.viewReport}
        </Link>
      </div>

      {error && <p className="form-error">{t.admin.loadError}</p>}
      {actionError && (
        <p role="alert" className="form-error">
          {t.errors.transition}
        </p>
      )}

      <div className="pipeline">
        {STATUSES.map((status) => {
          const items = rows.filter((row) => row.status === status);
          return (
            <section key={status} className="column" aria-label={t.status[status]}>
              <h2 className="column-title">
                <span className={`dot dot-${status}`} aria-hidden="true" />
                {t.status[status]}
                <span className="count">{items.length}</span>
              </h2>

              {items.length === 0 && <p className="muted small">{t.admin.empty}</p>}

              {items.map((row) => (
                <article key={row.id} className="card pipeline-card">
                  <h3>{row.full_name}</h3>
                  <p className="small muted">
                    {row.listing?.title} · {row.listing?.city}
                  </p>
                  <dl className="details">
                    <dt>{t.admin.income}</dt>
                    <dd>{formatCurrency(row.monthly_income_eur, locale)}</dd>
                    <dt>{t.admin.household}</dt>
                    <dd>
                      {row.household_size} {t.admin.people}
                    </dd>
                    <dt>{t.admin.moveIn}</dt>
                    <dd>{formatDate(row.move_in_date, locale)}</dd>
                  </dl>
                  <p className="small">
                    <a href={`mailto:${row.email}`}>{row.email}</a>
                    {row.documentUrl && (
                      <>
                        {' · '}
                        <a href={row.documentUrl} target="_blank" rel="noopener noreferrer">
                          {t.admin.document}
                        </a>
                      </>
                    )}
                  </p>

                  {NEXT_STATUSES[row.status].length === 0 ? (
                    <p className="small muted">{t.admin.final}</p>
                  ) : (
                    <div className="actions">
                      {NEXT_STATUSES[row.status].map((next) => (
                        <form key={next} action={updateStatus}>
                          <input type="hidden" name="locale" value={locale} />
                          <input type="hidden" name="id" value={row.id} />
                          <input type="hidden" name="to" value={next} />
                          <button
                            type="submit"
                            className={next === 'rejected' ? 'btn btn-small btn-danger' : 'btn btn-small btn-primary'}
                          >
                            {t.admin.moveTo} {t.status[next]}
                          </button>
                        </form>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </section>
          );
        })}
      </div>
    </>
  );
}
