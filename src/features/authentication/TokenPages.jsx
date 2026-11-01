/**
 * Pages reached from links in emails: email verification, account activation, password reset, and the "forgot
 * password" request.
 *
 * @author Kwasi Adabo Boakye
 */

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { api, errorMessage } from '../../lib/api.js';
import { Button, Field, Input, Alert } from '../../components/ui/index.js';
import { AuthShell } from './AuthShell.jsx';
import { passwordRule } from './RegisterPage.jsx';

/**
 * Verifies the email address from the link's token as soon as the page opens, and reports success or the reason for
 * failure.
 *
 * @returns {JSX.Element}
 */
export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const [state, setState] = useState({ status: 'working' });
  useEffect(() => {
    api
      .post('/auth/verify-email', { token: params.get('token') })
      .then(() => setState({ status: 'ok' }))
      .catch((e) => setState({ status: 'error', message: errorMessage(e) }));
  }, [params]);
  return (
    <AuthShell title="Email verification">
      {state.status === 'working' && <p className="text-sm text-ink-soft">Verifying…</p>}
      {state.status === 'ok' && (
        <>
          <Alert tone="success" icon={CheckCircle2}>
            Your email is verified.
          </Alert>
          <Button to="/login" className="mt-6 w-full">
            Sign in
          </Button>
        </>
      )}
      {state.status === 'error' && <Alert tone="danger">{state.message}</Alert>}
    </AuthShell>
  );
}

const pwSchema = z
  .object({ password: passwordRule, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });

/**
 * Shared form for choosing a password with a token from an email link, used for activation and reset.
 *
 * @param {object} props
 * @param {string} props.endpoint API path that accepts the token and password.
 * @param {string} props.title Page title.
 * @param {string} [props.subtitle] Supporting text.
 * @param {string} props.successText Message shown when the password has been set.
 * @returns {JSX.Element}
 */
function SetPasswordForm({ endpoint, title, subtitle, successText }) {
  const [params] = useSearchParams();
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(pwSchema) });

  /**
   * Sends the token and the new password, then shows the success message or the error.
   *
   * @param {object} values Validated form values.
   * @returns {Promise<void>}
   */
  const onSubmit = async ({ password }) => {
    setError(null);
    try {
      await api.post(endpoint, { token: params.get('token'), password });
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  return (
    <AuthShell title={title} subtitle={subtitle}>
      {done ? (
        <>
          <Alert tone="success" icon={CheckCircle2}>
            {successText}
          </Alert>
          <Button to="/login" className="mt-6 w-full">
            Sign in
          </Button>
        </>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {error && <Alert tone="danger">{error}</Alert>}
          <Field
            label="New password"
            required
            help="At least 10 characters with a letter and a number"
            error={errors.password?.message}
          >
            <Input type="password" autoComplete="new-password" {...register('password')} />
          </Field>
          <Field label="Confirm password" required error={errors.confirm?.message}>
            <Input type="password" autoComplete="new-password" {...register('confirm')} />
          </Field>
          <Button type="submit" className="w-full" loading={isSubmitting}>
            Save password
          </Button>
        </form>
      )}
    </AuthShell>
  );
}

/**
 * Activation page where a user created by an administrator chooses their password.
 *
 * @returns {JSX.Element}
 */
export const ActivatePage = () => (
  <SetPasswordForm
    endpoint="/auth/activate"
    title="Activate your account"
    subtitle="Choose a password to finish setting up your account."
    successText="Your account is active."
  />
);

/**
 * Page where a user chooses a new password after following a reset link.
 *
 * @returns {JSX.Element}
 */
export const ResetPasswordPage = () => (
  <SetPasswordForm
    endpoint="/auth/reset-password"
    title="Choose a new password"
    successText="Your password has been changed. All other sessions were signed out."
  />
);

/**
 * Form that asks for an email address and sends a password-reset link if an active account exists.
 *
 * @returns {JSX.Element}
 */
export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm({ resolver: zodResolver(z.object({ email: z.string().email('Enter a valid email address') })) });

  /**
   * Requests a reset link. The same confirmation is shown whether or not an account exists, so the form cannot be
   * used to discover registered addresses.
   *
   * @param {object} values Validated form values.
   * @returns {Promise<void>}
   */
  const onSubmit = async (v) => {
    await api.post('/auth/forgot-password', v).catch(() => {});
    setSent(true);
  };
  return (
    <AuthShell
      title="Reset your password"
      subtitle="We will email you a link if an active account exists."
      footer={
        <Link to="/login" className="font-semibold text-brand-700 hover:underline">
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <Alert tone="success" icon={CheckCircle2}>
          If an active account exists for that address, a reset link is on its way. It expires in one hour.
        </Alert>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Field label="Email" error={errors.email?.message}>
            <Input type="email" autoComplete="email" {...register('email')} />
          </Field>
          <Button type="submit" className="w-full" loading={isSubmitting}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
