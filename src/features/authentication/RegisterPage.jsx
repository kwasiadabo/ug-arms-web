/**
 * Researcher self-registration page. It shows the privacy notice configured by the University.
 *
 * @author Kwasi Adabo Boakye
 */

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { api, errorMessage, fieldErrors } from '../../lib/api.js';
import { Button, Field, Input, Alert } from '../../components/ui/index.js';
import { AuthShell } from './AuthShell.jsx';
import { useInstitution } from '../../store/institution.js';

export const passwordRule = z
  .string()
  .min(10, 'Use at least 10 characters')
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), 'Include at least one letter and one number');
const schema = z
  .object({
    fullName: z.string().trim().min(2, 'Enter your full name'),
    email: z.string().email('Enter a valid email address'),
    affiliation: z.string().max(255).optional(),
    password: passwordRule,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });

/**
 * Renders the registration form (name, email, affiliation and a password entered twice) and, after submission,
 * tells the researcher to check their email.
 *
 * @returns {JSX.Element}
 */
export default function RegisterPage() {
  const notice = useInstitution((s) => s.registrationNotice);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);
  const {
    register,
    handleSubmit,
    setError: setFieldError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });

  /**
   * Registers the researcher; the password confirmation is checked in the form and not sent.
   *
   * @param {object} values Validated form values.
   * @returns {Promise<void>}
   */
  const onSubmit = async ({ confirm, ...values }) => {
    setError(null);
    try {
      await api.post('/auth/register', values);
      setDone(true);
    } catch (err) {
      Object.entries(fieldErrors(err)).forEach(([k, m]) => setFieldError(k, { message: m }));
      setError(errorMessage(err));
    }
  };
  if (done) {
    return (
      <AuthShell title="Check your email" subtitle="We have sent you a link to verify your address.">
        <Alert tone="success" icon={CheckCircle2}>
          Once verified, you can sign in, save records and submit research requests.
        </Alert>
        <Button to="/login" className="mt-6 w-full">
          Go to sign in
        </Button>
      </AuthShell>
    );
  }
  return (
    <AuthShell
      title="Create a researcher account"
      subtitle="For students, faculty and visiting researchers."
      footer={
        <>
          Already registered?{' '}
          <Link to="/login" className="font-semibold text-brand-700 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="Full name" required error={errors.fullName?.message}>
          <Input autoComplete="name" {...register('fullName')} />
        </Field>
        <Field label="Email" required error={errors.email?.message}>
          <Input type="email" autoComplete="email" {...register('email')} />
        </Field>
        <Field
          label="Affiliation"
          help="University, department or organisation (optional)"
          error={errors.affiliation?.message}
        >
          <Input {...register('affiliation')} />
        </Field>
        <Field
          label="Password"
          required
          help="At least 10 characters with a letter and a number"
          error={errors.password?.message}
        >
          <Input type="password" autoComplete="new-password" {...register('password')} />
        </Field>
        <Field label="Confirm password" required error={errors.confirm?.message}>
          <Input type="password" autoComplete="new-password" {...register('confirm')} />
        </Field>
        {notice && <p className="whitespace-pre-line text-xs text-ink-soft">{notice}</p>}
        <Button type="submit" className="w-full" loading={isSubmitting}>
          Create account
        </Button>
      </form>
    </AuthShell>
  );
}
