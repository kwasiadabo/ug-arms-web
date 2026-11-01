/**
 * Button component in the University theme, with variants (primary, secondary, ghost, danger, gold and link) and
 * sizes.
 *
 * @author Kwasi Adabo Boakye
 */

import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { cn } from './cn.js';

const variants = {
  primary: 'bg-brand-700 text-white hover:bg-brand-800 shadow-sm',
  secondary: 'bg-white text-ink border border-line hover:bg-canvas',
  ghost: 'text-ink-soft hover:bg-canvas hover:text-ink',
  danger: 'bg-red-700 text-white hover:bg-red-800 shadow-sm',
  gold: 'bg-gold-500 text-brand-900 hover:bg-gold-400 shadow-sm',
  link: 'text-brand-700 hover:underline px-0 h-auto',
};
const sizes = {
  sm: 'h-8 px-3 text-[13px] gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-11 px-5 text-[15px] gap-2',
  icon: 'h-9 w-9 justify-center',
};

/**
 * Renders a button, or a router link when `to` is given. While `loading` is true the button shows a spinner, is
 * disabled and is marked busy for screen readers.
 *
 * @param {object} props Variant, size, loading state, optional icon, `to` for links, and any native button
 *   attributes.
 * @param {import('react').Ref} ref Forwarded to the button element.
 * @returns {JSX.Element}
 */
export const Button = forwardRef(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading,
    icon: Icon,
    className,
    children,
    to,
    disabled,
    type = 'button',
    ...props
  },
  ref,
) {
  const classes = cn(
    'inline-flex items-center justify-center rounded-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap',
    variants[variant],
    variant !== 'link' && sizes[size],
    className,
  );
  const content = (
    <>
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : Icon ? (
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
      ) : null}
      {children}
    </>
  );
  if (to)
    return (
      <Link to={to} className={classes} {...props}>
        {content}
      </Link>
    );
  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {content}
    </button>
  );
});
