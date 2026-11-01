/**
 * Sign-in page for staff and registered researchers.
 *
 * @author Kwasi Adabo Boakye
 */

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { api, errorMessage } from '../../lib/api.js';
import { useAuth, isStaff } from '../../store/auth.js';
import { Button, Field, Input, Alert } from '../../components/ui/index.js';
import { AuthShell } from './AuthShell.jsx';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

/**
 * Renders the sign-in form with links to registration and password reset.
 *
 * @returns {JSX.Element}
 */
export default function LoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const setUser = useAuth((s) => s.setUser);
  const [error, setError] = useState(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });

  /**
   * Signs in and goes to the page the user came from (only paths within the application are accepted, to prevent
   * open redirects), otherwise to the staff dashboard or the researcher area.
   *
   * @param {object} values Validated form values.
   * @returns {Promise<void>}
   */
  const onSubmit = async (values) => {
    setError(null);
    try {
      const res = await api.post('/auth/login', values);
      const user = res.data.data.user;
      setUser(user);
      const next = params.get('next');
      navigate(next?.startsWith('/') && !next.startsWith('//') ? next : isStaff(user) ? '/admin' : '/my', {
        replace: true,
      });
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  return (
    <AuthShell
      title="Sign in"
      subtitle="Staff and registered researchers"
      footer={
        <>
          New researcher?{' '}
          <Link to="/register" className="font-semibold text-brand-700 hover:underline">
            Create an account
          </Link>{' '}
          ·{' '}
          <Link to="/" className="font-semibold text-brand-700 hover:underline">
            Browse the catalogue
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="Email" error={errors.email?.message}>
          <Input type="email" autoComplete="username" autoFocus {...register('email')} />
        </Field>
        <Field
          label="Password"
          error={errors.password?.message}
          hint={
            <Link to="/forgot-password" className="text-brand-700 hover:underline">
              Forgot password?
            </Link>
          }
        >
          <Input type="password" autoComplete="current-password" {...register('password')} />
        </Field>
        <Button type="submit" className="w-full" loading={isSubmitting}>
          Sign in
        </Button>
      </form>
    </AuthShell>
  );
}
