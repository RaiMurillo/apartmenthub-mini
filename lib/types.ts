export const STATUSES = ['new', 'screening', 'viewing', 'approved', 'rejected'] as const;
export type ApplicationStatus = (typeof STATUSES)[number];

export function isStatus(value: string): value is ApplicationStatus {
  return (STATUSES as readonly string[]).includes(value);
}

/**
 * Which statuses an application may move to. This mirrors the trigger in
 * supabase/migrations/0004_status_workflow.sql. The UI uses it to show the
 * right buttons; the database is what actually enforces it.
 */
export const NEXT_STATUSES: Record<ApplicationStatus, ApplicationStatus[]> = {
  new: ['screening', 'rejected'],
  screening: ['viewing', 'rejected'],
  viewing: ['approved', 'rejected'],
  approved: [],
  rejected: [],
};

export interface Listing {
  id: string;
  title: string;
  city: string;
  rent_eur: number;
  bedrooms: number;
  description_nl: string;
  description_en: string;
}

export interface ApplicationRow {
  id: string;
  full_name: string;
  email: string;
  monthly_income_eur: number;
  household_size: number;
  move_in_date: string;
  status: ApplicationStatus;
  document_path: string | null;
  created_at: string;
  listing: { title: string; city: string } | null;
}

export interface StatusReportRow {
  status: ApplicationStatus;
  total: number;
  share_pct: number | null;
  avg_age_days: number | null;
}
