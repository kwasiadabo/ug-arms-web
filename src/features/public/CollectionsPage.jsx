/**
 * Public list of collections and fonds.
 *
 * @author Kwasi Adabo Boakye
 */

import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Library, Lock } from 'lucide-react';
import { useApi } from '../../lib/query.js';
import { useQueryParams } from '../../hooks/useQueryParams.js';
import { SearchInput } from '../../components/search/SearchInput.jsx';
import { Skeleton, EmptyState, ErrorState, Button } from '../../components/ui/index.js';

/**
 * Lists published top-level collections with paging; restricted collections are marked so visitors know to request
 * access before visiting.
 *
 * @returns {JSX.Element}
 */
export default function CollectionsPage() {
  const [p, set] = useQueryParams({ pageSize: 24 });
  const { data, isLoading, error, refetch } = useApi('public-collections', '/public/collections', {
    page: p.page,
    pageSize: p.pageSize,
    q: p.q,
  });
  useEffect(() => {
    document.title = 'Collections · UG Archives';
  }, []);
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <p className="label-eyebrow">Browse</p>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl font-extrabold">Collections and fonds</h1>
        <SearchInput value={p.q} onChange={(q) => set({ q })} placeholder="Filter collections" />
      </div>
      {error && <ErrorState error={error} onRetry={refetch} />}
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44" />)}
        {data?.data.map((c) => (
          <Link key={c.id} to={`/records/${c.id}`} className="card group p-5 transition-shadow hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="rounded-md bg-brand-50 p-2 text-brand-700">
                <Library className="h-5 w-5" aria-hidden />
              </span>
              {!c.scopeAndContent && (
                <span className="inline-flex items-center gap-1 text-xs text-amber-700">
                  <Lock className="h-3 w-3" /> Restricted
                </span>
              )}
            </div>
            <p className="mt-4 text-xs font-semibold text-gold-600">{c.referenceCode}</p>
            <h2 className="mt-1 text-lg font-bold leading-snug group-hover:text-brand-800">{c.title}</h2>
            <p className="mt-1 text-sm text-ink-soft">
              {[c.dateExpression, c.extentAndMedium].filter(Boolean).join(' · ')}
            </p>
            {c.scopeAndContent && <p className="mt-3 line-clamp-3 text-sm text-ink-soft">{c.scopeAndContent}</p>}
          </Link>
        ))}
      </div>
      {data && !data.data.length && <EmptyState title="No collections found" />}
      {data?.meta.totalPages > 1 && (
        <div className="mt-8 flex justify-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={p.page <= 1}
            onClick={() => set({ page: p.page - 1 }, { resetPage: false })}
          >
            Previous
          </Button>
          <span className="self-center text-sm">
            Page {p.page} of {data.meta.totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={p.page >= data.meta.totalPages}
            onClick={() => set({ page: p.page + 1 }, { resetPage: false })}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
