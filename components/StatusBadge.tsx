import type { ApplicationStatus } from '@/lib/types';

export default function StatusBadge({
  status,
  label,
}: {
  status: ApplicationStatus;
  label: string;
}) {
  return <span className={`badge badge-${status}`}>{label}</span>;
}
