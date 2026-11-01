/**
 * Shared two-panel layout of the sign-in, registration and password pages.
 *
 * @author Kwasi Adabo Boakye
 */

import { useEffect } from 'react';
import { Logo } from '../../components/layout/Logo.jsx';
import { Credits } from '../../components/layout/Credits.jsx';

/**
 * Renders a branded panel beside the form, with the page title, subtitle, form and an optional footer.
 *
 * @param {object} props
 * @param {string} props.title Page title.
 * @param {string} [props.subtitle] Supporting text.
 * @param {import('react').ReactNode} [props.footer] Links under the form.
 * @returns {JSX.Element}
 */
export function AuthShell({ title, subtitle, children, footer }) {
  useEffect(() => {
    document.title = `${title} · UG Archives`;
  }, [title]);
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden bg-brand-900 lg:block">
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <Logo inverted to="/" />
          <div className="max-w-md">
            <p className="label-eyebrow !text-gold-300">University of Ghana, Legon</p>
            <h2 className="mt-3 text-3xl font-extrabold leading-tight text-white">
              Preserving the institutional memory of the University.
            </h2>
            <p className="mt-4 text-brand-100/80">
              Records, photographs, theses and personal papers, managed with care and made discoverable for research.
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-xs text-brand-100/60">
              Access to restricted material is logged and governed by the Archives' access conditions.
            </p>
            <Credits className="text-brand-100/50" />
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo to="/" />
          </div>
          <h1 className="text-2xl font-extrabold">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-ink-soft">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-8 text-sm text-ink-soft">{footer}</div>}
          <Credits className="mt-10 text-ink-soft lg:hidden" />
        </div>
      </div>
    </div>
  );
}
