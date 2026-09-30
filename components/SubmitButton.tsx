'use client';

import { useFormStatus } from 'react-dom';

export default function SubmitButton({
  label,
  pendingLabel,
  className = 'btn btn-primary',
}: {
  label: string;
  pendingLabel: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-disabled={pending}>
      {pending ? pendingLabel : label}
    </button>
  );
}
