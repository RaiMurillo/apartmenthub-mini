'use client';

import { useActionState, useState } from 'react';
import { signIn, signUp, type AuthState } from '@/lib/actions/auth';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import type { Locale } from '@/lib/i18n/config';
import SubmitButton from './SubmitButton';

interface Props {
  locale: Locale;
  next: string;
  t: Dictionary['auth'];
  errors: Dictionary['errors'];
}

export default function AuthForm({ locale, next, t, errors }: Props) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  return (
    <div className="card auth-card">
      <div className="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'login'}
          className={mode === 'login' ? 'tab active' : 'tab'}
          onClick={() => setMode('login')}
        >
          {t.tabLogin}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'signup'}
          className={mode === 'signup' ? 'tab active' : 'tab'}
          onClick={() => setMode('signup')}
        >
          {t.tabSignup}
        </button>
      </div>

      {mode === 'login' ? (
        <LoginForm locale={locale} next={next} t={t} errors={errors} />
      ) : (
        <SignupForm locale={locale} next={next} t={t} errors={errors} />
      )}
    </div>
  );
}

function LoginForm({ locale, next, t, errors }: Props) {
  const [state, action] = useActionState<AuthState, FormData>(signIn, {});

  return (
    <form action={action} className="form">
      <h1>{t.loginTitle}</h1>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="next" value={next} />

      <label className="field">
        <span>{t.email}</span>
        <input type="email" name="email" autoComplete="email" required />
      </label>
      <label className="field">
        <span>{t.password}</span>
        <input type="password" name="password" autoComplete="current-password" required />
      </label>

      {state.error && (
        <p role="alert" className="form-error">
          {errors[state.error]}
        </p>
      )}
      <SubmitButton label={t.loginButton} pendingLabel={t.pending} />
    </form>
  );
}

function SignupForm({ locale, next, t, errors }: Props) {
  const [state, action] = useActionState<AuthState, FormData>(signUp, {});

  return (
    <form action={action} className="form">
      <h1>{t.signupTitle}</h1>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="next" value={next} />

      <label className="field">
        <span>{t.fullName}</span>
        <input type="text" name="fullName" autoComplete="name" required />
      </label>
      <label className="field">
        <span>{t.email}</span>
        <input type="email" name="email" autoComplete="email" required />
      </label>
      <label className="field">
        <span>{t.password}</span>
        <input
          type="password"
          name="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
        <small>{t.passwordHint}</small>
      </label>

      {state.error && (
        <p role="alert" className="form-error">
          {errors[state.error]}
        </p>
      )}
      {state.notice === 'check_email' && (
        <p role="status" className="form-notice">
          {t.checkEmail}
        </p>
      )}
      <SubmitButton label={t.signupButton} pendingLabel={t.pending} />
    </form>
  );
}
