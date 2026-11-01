/**
 * Printable finding aid of a whole collection.
 *
 * @author Kwasi Adabo Boakye
 */

import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Lock, Printer } from 'lucide-react';
import { useApi } from '../../lib/query.js';
import { PageLoader, ErrorState, Button } from '../../components/ui/index.js';
import { humanize } from '../../utils/format.js';

/**
 * Shows a collection and every publicly visible part of it as one indented hierarchy that can be printed.
 * Restricted parts are marked with a lock; hidden parts are not listed at all.
 *
 * @returns {JSX.Element}
 */
export default function FindingAidPage() {
  const { id } = useParams();
  const { data, isLoading, error, refetch } = useApi(['finding-aid', id], `/public/records/${id}/finding-aid`);
  useEffect(() => {
    if (data) document.title = `Finding aid: ${data.data.root.title} · UG Archives`;
  }, [data]);
  if (isLoading)
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <PageLoader />
      </div>
    );
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const { root, entries } = data.data;
  const minDepth = Math.min(...entries.map((e) => e.depth));
  // Order entries depth-first so the list reads as a hierarchy.
  const children = new Map();
  entries.forEach((e) => children.set(e.parentId, [...(children.get(e.parentId) || []), e]));
  const ordered = [];

  /**
   * Adds an entry and then, recursively, its children to the ordered list, so the list reads depth-first as a
   * hierarchy.
   *
   * @param {object} e The entry.
   */
  const walk = (e) => {
    ordered.push(e);
    (children.get(e.id) || []).forEach(walk);
  };
  entries.filter((e) => e.id === root.id).forEach(walk);
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <p className="label-eyebrow">Finding aid</p>
      <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">{root.title}</h1>
          <p className="text-ink-soft">{root.referenceCode}</p>
        </div>
        <Button variant="secondary" icon={Printer} onClick={() => window.print()}>
          Print
        </Button>
      </div>
      <ol className="mt-8 divide-y divide-line rounded-xl border border-line">
        {ordered.map((e) => (
          <li key={e.id} style={{ paddingLeft: `${(e.depth - minDepth) * 20 + 16}px` }} className="py-2.5 pr-4">
            <Link to={`/records/${e.id}`} className="hover:underline">
              <span className="text-xs font-semibold text-gold-600">{e.referenceCode}</span>{' '}
              <span className="text-xs text-ink-soft">{humanize(e.level)}</span>
              <span className="block font-semibold">
                {e.title}{' '}
                {e.publicVisibility === 'metadata_only' && (
                  <Lock className="inline h-3.5 w-3.5 text-amber-700" aria-label="Restricted" />
                )}
              </span>
            </Link>
            {(e.dateExpression || e.extentAndMedium) && (
              <span className="block text-xs text-ink-soft">
                {[e.dateExpression, e.extentAndMedium].filter(Boolean).join(' · ')}
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
