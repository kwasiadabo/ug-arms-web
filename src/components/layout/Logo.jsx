/**
 * University of Ghana crest and the application logo.
 *
 * @author Kwasi Adabo Boakye
 */

import { Link } from 'react-router-dom';
import { cn } from '../ui/index.js';
import { useInstitution } from '../../store/institution.js';

/** University of Ghana crest (transparent background), served from /brand/ug-crest.png. */
export const CREST_SRC = `${import.meta.env.BASE_URL}brand/ug-crest.png`;

/**
 * Renders the crest image (decorative, so hidden from screen readers).
 *
 * @param {object} props
 * @param {string} [props.className] Size classes.
 * @returns {JSX.Element|null}
 */
export function Mark({ className }) {
  return <img src={CREST_SRC} alt="" aria-hidden className={cn('object-contain', className)} draggable={false} />;
}

/**
 * Renders the crest with the institution's short name and tagline as a home link.
 *
 * @param {object} props
 * @param {boolean} [props.compact] Show the crest only.
 * @param {boolean} [props.inverted] Use light text on dark backgrounds.
 * @param {string} [props.to='/admin'] Link target.
 * @returns {JSX.Element|null}
 */
export function Logo({ compact, inverted, to = '/admin' }) {
  const { shortName, tagline } = useInstitution();
  return (
    <Link to={to} className="flex items-center gap-2.5" aria-label={`${shortName} home`}>
      <Mark className="h-10 w-10 shrink-0" />
      {!compact && (
        <span className="leading-tight">
          <span className={cn('block text-[13.5px] font-extrabold', inverted ? 'text-white' : 'text-ink')}>
            {shortName}
          </span>
          <span
            className={cn(
              'block text-[10.5px] font-semibold uppercase tracking-[0.1em]',
              inverted ? 'text-gold-300' : 'text-gold-600',
            )}
          >
            {tagline}
          </span>
        </span>
      )}
    </Link>
  );
}
