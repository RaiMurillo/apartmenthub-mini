import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { formatNumber } from '@/lib/format';
import { resolveLocale } from '@/lib/i18n/config';
import { dictionaries } from '@/lib/i18n/dictionaries';
import { createClient } from '@/lib/supabase/server';
import type { StatusReportRow } from '@/lib/types';

export default async function ReportPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await resolveLocale(params);
  await requireAdmin(locale);
  const t = dictionaries[locale];

  // The aggregation happens in Postgres: see supabase/migrations/0005_reports.sql
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('report_applications_per_status');
  const rows = (data ?? []) as StatusReportRow[];
  const grandTotal = rows.reduce((sum, row) => sum + Number(row.total), 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{t.report.title}</h1>
          <p className="muted">{t.report.subtitle}</p>
        </div>
        <Link href={`/${locale}/admin`} className="btn btn-ghost">
          {t.admin.backToPipeline}
        </Link>
      </div>

      {error && <p className="form-error">{t.report.loadError}</p>}

      <div className="card table-card">
        <table className="report-table">
          <thead>
            <tr>
              <th>{t.report.status}</th>
              <th className="num">{t.report.total}</th>
              <th>{t.report.share}</th>
              <th className="num">{t.report.avgAge}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.status}>
                <td>
                  <span className={`dot dot-${row.status}`} aria-hidden="true" />
                  {t.status[row.status]}
                </td>
                <td className="num">{row.total}</td>
                <td>
                  <div className="bar" aria-hidden="true">
                    <div
                      className={`bar-fill bar-${row.status}`}
                      style={{ width: `${row.share_pct ?? 0}%` }}
                    />
                  </div>
                  <span className="small muted">
                    {formatNumber(row.share_pct ?? 0, locale)}%
                  </span>
                </td>
                <td className="num">
                  {row.avg_age_days === null ? '–' : formatNumber(row.avg_age_days, locale)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th>{t.report.totalRow}</th>
              <th className="num">{grandTotal}</th>
              <th />
              <th />
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}
