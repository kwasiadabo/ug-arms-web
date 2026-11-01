/**
 * Page heading with breadcrumbs, used at the top of every staff page.
 *
 * @author Kwasi Adabo Boakye
 */

import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useEffect } from 'react';

/**
 * Renders the breadcrumb trail; the last item is marked as the current page.
 *
 * @param {object} props
 * @param {Array<{ label: string, to?: string }>} props.items Trail from the top down.
 * @returns {JSX.Element|null}
 */
export function Breadcrumbs({ items }) {
  if (!items?.length) return null;
  return (
    <nav aria-label="Breadcrumb" className="mb-2">
      <ol className="flex flex-wrap items-center gap-1 text-xs text-ink-soft">
        {items.map((b, i) => (
          <li key={`${b.label}-${i}`} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3 w-3" aria-hidden />}
            {b.to && i < items.length - 1 ? (
              <Link to={b.to} className="hover:text-brand-700 hover:underline">
                {b.label}
              </Link>
            ) : (
              <span aria-current={i === items.length - 1 ? 'page' : undefined} className="max-w-[24ch] truncate">
                {b.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/**
 * Renders the page title with breadcrumbs, an optional eyebrow, description, metadata and actions, and sets the
 * browser tab title.
 *
 * @param {object} props
 * @param {import('react').ReactNode} props.title Title.
 * @param {string} [props.documentTitle] Tab title when the title is not plain text.
 * @returns {JSX.Element|null}
 */
export function PageHeader({ title, description, actions, breadcrumbs, eyebrow, meta, documentTitle }) {
  useEffect(() => {
    const t = documentTitle ?? (typeof title === 'string' ? title : null);
    if (t) document.title = `${t} · UG Archives`;
  }, [title, documentTitle]);
  return (
    <header className="mb-6">
      <Breadcrumbs items={breadcrumbs} />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && <p className="mb-1 text-xs font-bold tracking-wide text-brand-700">{eyebrow}</p>}
          <h1 className="text-2xl font-extrabold leading-tight sm:text-[26px]">{title}</h1>
          {description && <p className="mt-1.5 max-w-3xl text-sm text-ink-soft">{description}</p>}
          {meta && <div className="mt-2.5 flex flex-wrap items-center gap-2">{meta}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
