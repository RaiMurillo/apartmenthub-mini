'use client';

import { useActionState } from 'react';
import { submitApplication, type ApplyState } from '@/lib/actions/applications';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import type { Locale } from '@/lib/i18n/config';
import SubmitButton from './SubmitButton';

interface Props {
  locale: Locale;
  listingId: string;
  labels: Dictionary['apply'];
  validation: Dictionary['validation'];
  errors: Dictionary['errors'];
  defaults: { fullName: string; email: string };
}

export default function ApplyForm({ locale, listingId, labels, validation, errors, defaults }: Props) {
  const [state, action] = useActionState<ApplyState, FormData>(submitApplication, {});
  const values = state.values ?? {};

  const messageFor = (field: string) => {
    const code = state.fieldErrors?.[field as keyof typeof state.fieldErrors];
    if (!code) return null;
    return (validation as Record<string, string>)[code] ?? validation.invalid;
  };

  return (
    <form action={action} className="card form" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="listingId" value={listingId} />

      {state.formError && (
        <p role="alert" className="form-error">
          {errors[state.formError]}
        </p>
      )}

      <Field id="fullName" label={labels.fullName} error={messageFor('fullName')}>
        <input
          id="fullName"
          name="fullName"
          type="text"
          autoComplete="name"
          defaultValue={values.fullName ?? defaults.fullName}
        />
      </Field>

      <div className="grid-2">
        <Field id="email" label={labels.email} error={messageFor('email')}>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={values.email ?? defaults.email}
          />
        </Field>
        <Field id="phone" label={labels.phone} error={messageFor('phone')}>
          <input id="phone" name="phone" type="tel" autoComplete="tel" defaultValue={values.phone} />
        </Field>
      </div>

      <div className="grid-3">
        <Field id="monthlyIncome" label={labels.income} error={messageFor('monthlyIncome')}>
          <input
            id="monthlyIncome"
            name="monthlyIncome"
            type="number"
            inputMode="numeric"
            min={0}
            defaultValue={values.monthlyIncome}
          />
        </Field>
        <Field id="householdSize" label={labels.household} error={messageFor('householdSize')}>
          <input
            id="householdSize"
            name="householdSize"
            type="number"
            inputMode="numeric"
            min={1}
            max={12}
            defaultValue={values.householdSize ?? '1'}
          />
        </Field>
        <Field id="moveInDate" label={labels.moveIn} error={messageFor('moveInDate')}>
          <input id="moveInDate" name="moveInDate" type="date" defaultValue={values.moveInDate} />
        </Field>
      </div>

      <Field id="message" label={labels.message} error={messageFor('message')}>
        <textarea id="message" name="message" rows={4} defaultValue={values.message} />
      </Field>

      <Field
        id="document"
        label={labels.document}
        hint={labels.documentHint}
        error={messageFor('document')}
      >
        <input
          id="document"
          name="document"
          type="file"
          accept="application/pdf,image/jpeg,image/png"
        />
      </Field>

      <SubmitButton label={labels.submit} pendingLabel={labels.submitting} />
    </form>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className={error ? 'field has-error' : 'field'}>
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && !error && <small>{hint}</small>}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
