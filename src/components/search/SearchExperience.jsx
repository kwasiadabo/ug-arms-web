/**
 * Full search interface shared by the public portal and the staff search: query box with suggestions, filters and
 * facets, sorting, results with highlighted snippets, and paging. All state is kept in the URL, so searches can be
 * shared.
 *
 * @author Kwasi Adabo Boakye
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Search, SlidersHorizontal, Lock, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { api } from '../../lib/api.js';
import { useQueryParams, clean } from '../../hooks/useQueryParams.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { Button, Skeleton, EmptyState, ErrorState, AccessBadge, StatusBadge, cn } from '../ui/index.js';
import { Thumb } from '../viewer/AssetViewer.jsx';
import { humanize, fmtNumber } from '../../utils/format.js';

/**
 * Renders a result snippet with highlighted matches. The segments come from the server as plain text, so no HTML
 * from archival material is ever inserted into the page.
 *
 * @param {object} props
 * @param {Array<{ text: string, hit: boolean }>} props.segments Snippet segments.
 * @returns {JSX.Element|null}
 */
function Snippet({ segments }) {
  if (!segments) return null;
  return (
    <p className="mt-1.5 line-clamp-3 text-sm text-ink-soft">
      {segments.map((s, i) =>
        s.hit ? (
          <mark key={i} className="rounded bg-gold-100 px-0.5 text-ink">
            {s.text}
          </mark>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </p>
  );
}

/**
 * Suggestion list shown under the search box after two characters.
 *
 * @param {object} props
 * @param {string} props.q Current text.
 * @param {string} props.endpoint Suggestion API path.
 * @param {(s: object) => void} props.onPick Called with the chosen suggestion.
 * @returns {JSX.Element|null}
 */
function Suggest({ q, endpoint, onPick }) {
  const d = useDebounce(q, 250);
  const { data } = useQuery({
    queryKey: ['suggest', endpoint, d],
    queryFn: () => api.get(endpoint, { params: { q: d } }).then((r) => r.data.data),
    enabled: d.length >= 2,
  });
  if (!data?.length) return null;
  return (
    <ul
      role="listbox"
      className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-line bg-white shadow-lg"
    >
      {data.map((s) => (
        <li key={`${s.type}-${s.id}`} role="option" aria-selected="false">
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              onPick(s);
            }}
            className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm hover:bg-canvas"
          >
            <span className="truncate">{s.label}</span>
            <span className="shrink-0 text-xs text-ink-soft">{s.type === 'record' ? s.sub : humanize(s.type)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * Renders one facet (for example levels or creators) as a list of values with counts; the active value is
 * highlighted.
 *
 * @param {object} props
 * @param {string} props.title Facet name.
 * @param {object[]} props.items Values with counts.
 * @param {(value: string) => void} props.onSelect Called with the chosen value.
 * @returns {JSX.Element|null}
 */
function FacetGroup({ title, items, active, onSelect }) {
  if (!items?.length) return null;
  return (
    <fieldset className="border-b border-line pb-4">
      <legend className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">{title}</legend>
      <ul className="space-y-1">
        {items.slice(0, 10).map((f) => (
          <li key={f.value}>
            <button
              type="button"
              onClick={() => onSelect(String(active) === String(f.value) ? '' : f.value)}
              aria-pressed={String(active) === String(f.value)}
              className={cn(
                'flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-canvas',
                String(active) === String(f.value) && 'bg-brand-50 font-semibold text-brand-800',
              )}
            >
              <span className="truncate">{f.label ?? humanize(f.value)}</span>
              <span className="text-xs text-ink-soft tabular-nums">{f.count === '' ? '' : fmtNumber(f.count)}</span>
            </button>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

/**
 * Renders the search page and runs the search for the current URL parameters.
 *
 * @param {object} props
 * @param {string} props.endpoint Search API path.
 * @param {string} props.suggestEndpoint Suggestion API path.
 * @param {(r: object) => string} props.recordHref Link to a result.
 * @param {boolean} [props.staff=false] Whether this is the staff search.
 * @returns {JSX.Element|null}
 */
export function SearchExperience({
  endpoint,
  suggestEndpoint,
  recordHref,
  staff = false,
  title = 'Search the archives',
}) {
  const [p, set] = useQueryParams({ pageSize: 20, sort: 'relevance' });
  const [q, setQ] = useState(p.q || '');
  const [showSuggest, setShowSuggest] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  useEffect(() => {
    setQ(p.q || '');
  }, [p.q]);
  useEffect(() => {
    document.title = `${p.q ? `“${p.q}” · ` : ''}${title} · UG Archives`;
  }, [p.q, title]);
  const params = clean({
    q: p.q,
    page: p.page,
    pageSize: p.pageSize,
    sort: p.sort,
    level: p.level,
    collectionId: p.collectionId,
    creatorId: p.creatorId,
    subjectId: p.subjectId,
    dateFrom: p.dateFrom,
    dateTo: p.dateTo,
    hasDigital: p.hasDigital,
    accessLevel: p.accessLevel,
  });
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['search', endpoint, params],
    queryFn: () => api.get(endpoint, { params }).then((r) => r.data.data),
    placeholderData: keepPreviousData,
  });
  const activeFilters = [
    'level',
    'collectionId',
    'creatorId',
    'subjectId',
    'dateFrom',
    'dateTo',
    'hasDigital',
    'accessLevel',
  ].filter((k) => p[k]);
  const decades = data?.facets?.decade;

  return (
    <div>
      <form
        role="search"
        className="relative"
        onSubmit={(e) => {
          e.preventDefault();
          setShowSuggest(false);
          set({ q });
        }}
      >
        <label htmlFor="sq" className="sr-only">
          Search terms
        </label>
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-soft"
          aria-hidden
        />
        <input
          id="sq"
          type="search"
          value={q}
          autoComplete="off"
          onChange={(e) => {
            setQ(e.target.value);
            setShowSuggest(true);
          }}
          onBlur={() => setShowSuggest(false)}
          placeholder='Try "Vice Chancellor", creator:Busia, -draft, title:convocation'
          className="h-12 w-full rounded-xl border border-line bg-white pl-12 pr-28 text-base shadow-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/25"
        />
        <Button type="submit" className="absolute right-1.5 top-1.5 h-9">
          Search
        </Button>
        {showSuggest && suggestEndpoint && (
          <Suggest
            q={q}
            endpoint={suggestEndpoint}
            onPick={(s) => {
              setShowSuggest(false);
              if (s.type === 'record') window.location.assign(recordHref(s.id));
              else set({ [s.type === 'creator' ? 'creatorId' : 'subjectId']: s.id, q: '' });
            }}
          />
        )}
      </form>
      <details className="mt-2 text-xs text-ink-soft">
        <summary className="cursor-pointer">Search tips</summary>
        <p className="mt-1">
          Use quotes for an exact phrase, a minus sign to exclude a word, OR between alternatives, and field:value for
          title, ref, creator, subject, place or date.
        </p>
      </details>

      <div className="mt-6 grid gap-8 lg:grid-cols-[260px_1fr]">
        <aside className={cn('space-y-4', !filtersOpen && 'hidden lg:block')} aria-label="Filters">
          <fieldset className="border-b border-line pb-4">
            <legend className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">Date range</legend>
            <div className="flex items-center gap-2">
              <input
                aria-label="From year"
                inputMode="numeric"
                placeholder="From"
                defaultValue={p.dateFrom}
                key={`f${p.dateFrom}`}
                onBlur={(e) => set({ dateFrom: e.target.value })}
                className="h-9 w-full rounded-lg border border-line px-2 text-sm"
              />
              <span className="text-ink-soft">–</span>
              <input
                aria-label="To year"
                inputMode="numeric"
                placeholder="To"
                defaultValue={p.dateTo}
                key={`t${p.dateTo}`}
                onBlur={(e) => set({ dateTo: e.target.value })}
                className="h-9 w-full rounded-lg border border-line px-2 text-sm"
              />
            </div>
            {decades?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {decades.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => set({ dateFrom: d.value, dateTo: d.value + 9 })}
                    className="rounded-full border border-line px-2 py-0.5 text-xs hover:bg-canvas"
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            )}
          </fieldset>
          <label className="flex items-center gap-2 border-b border-line pb-4 text-sm">
            <input
              type="checkbox"
              className="accent-brand-700"
              checked={p.hasDigital === 'true'}
              onChange={(e) => set({ hasDigital: e.target.checked ? 'true' : '' })}
            />{' '}
            Digitised material online
          </label>
          <FacetGroup
            title="Collection"
            items={data?.facets?.collection}
            active={p.collectionId}
            onSelect={(v) => set({ collectionId: v })}
          />
          <FacetGroup title="Level" items={data?.facets?.level} active={p.level} onSelect={(v) => set({ level: v })} />
          <FacetGroup
            title="Creator"
            items={data?.facets?.creator}
            active={p.creatorId}
            onSelect={(v) => set({ creatorId: v })}
          />
          <FacetGroup
            title="Subject"
            items={data?.facets?.subject}
            active={p.subjectId}
            onSelect={(v) => set({ subjectId: v })}
          />
          {staff && (
            <FacetGroup
              title="Access"
              items={['open', 'staff_only', 'restricted', 'embargoed', 'confidential', 'closed'].map((v) => ({
                value: v,
                label: humanize(v),
                count: '',
              }))}
              active={p.accessLevel}
              onSelect={(v) => set({ accessLevel: v })}
            />
          )}
        </aside>

        <section aria-live="polite" aria-busy={isFetching}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-soft">
              {data ? (
                <>
                  <span className="font-bold text-ink">{fmtNumber(data.total)}</span> result
                  {data.total === 1 ? '' : 's'}
                  {p.q ? <> for “{p.q}”</> : ''}
                </>
              ) : (
                'Searching…'
              )}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon={SlidersHorizontal}
                className="lg:hidden"
                onClick={() => setFiltersOpen((o) => !o)}
                aria-expanded={filtersOpen}
              >
                Filters
              </Button>
              <label className="flex items-center gap-2 text-sm">
                Sort
                <select
                  value={p.sort}
                  onChange={(e) => set({ sort: e.target.value })}
                  className="h-9 rounded-lg border border-line bg-white px-2 text-sm"
                >
                  <option value="relevance">Relevance</option>
                  <option value="date_asc">Date (oldest)</option>
                  <option value="date_desc">Date (newest)</option>
                  <option value="title">Title</option>
                  <option value="reference">Reference code</option>
                </select>
              </label>
            </div>
          </div>
          {activeFilters.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {activeFilters.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => set({ [k]: '' })}
                  className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-800 hover:bg-brand-100"
                >
                  {humanize(k.replace(/Id$/, ''))}: {p[k].length > 20 ? 'selected' : p[k]} <X className="h-3 w-3" />
                </button>
              ))}
              <button
                type="button"
                className="text-xs font-semibold text-ink-soft underline"
                onClick={() => set(Object.fromEntries(activeFilters.map((k) => [k, ''])))}
              >
                Clear all
              </button>
            </div>
          )}
          {error && <ErrorState error={error} onRetry={refetch} />}
          {isLoading && (
            <div className="space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-28" />
              ))}
            </div>
          )}
          {data && !data.results.length && (
            <EmptyState
              icon={Search}
              title="No matching descriptions"
              description={
                staff
                  ? 'Try fewer words or remove a filter.'
                  : 'Try fewer words or remove a filter. Some material may not be publicly listed; you can ask an archivist for help.'
              }
              action={
                !staff && (
                  <Button variant="secondary" to="/request?type=enquiry">
                    Ask an archivist
                  </Button>
                )
              }
            />
          )}
          <ol className="space-y-3">
            {data?.results.map((r) => (
              <li key={r.id}>
                <Link to={recordHref(r.id)} className="card flex gap-4 p-4 transition-shadow hover:shadow-md">
                  {r.thumbnailAssetId ? (
                    <Thumb assetId={r.thumbnailAssetId} alt="" className="h-20 w-20 shrink-0 rounded-lg object-cover" />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-semibold text-gold-600">{r.referenceCode}</span>
                      <span className="text-ink-soft">{humanize(r.level)}</span>
                      {r.mode === 'metadata_only' && (
                        <span className="inline-flex items-center gap-1 text-amber-700">
                          <Lock className="h-3 w-3" /> Restricted
                        </span>
                      )}
                      {staff && (
                        <>
                          <AccessBadge level={r.effectiveAccessLevel} />
                          <StatusBadge status={r.status} />
                        </>
                      )}
                    </div>
                    <h3 className="mt-1 font-bold leading-snug">{r.title}</h3>
                    <p className="text-sm text-ink-soft">
                      {[r.dateExpression, r.extentAndMedium].filter(Boolean).join(' · ')}
                      {r.collection ? (
                        <>
                          {' '}
                          · Part of <span className="font-medium text-ink">{r.collection.title}</span>
                        </>
                      ) : null}
                    </p>
                    <Snippet segments={r.snippet} />
                  </div>
                </Link>
              </li>
            ))}
          </ol>
          {data && data.totalPages > 1 && (
            <nav aria-label="Pagination" className="mt-6 flex items-center justify-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                icon={ChevronLeft}
                disabled={p.page <= 1}
                onClick={() => {
                  set({ page: p.page - 1 }, { resetPage: false });
                  window.scrollTo(0, 0);
                }}
              >
                Previous
              </Button>
              <span className="text-sm">
                Page {p.page} of {data.totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={p.page >= data.totalPages}
                onClick={() => {
                  set({ page: p.page + 1 }, { resetPage: false });
                  window.scrollTo(0, 0);
                }}
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </nav>
          )}
        </section>
      </div>
    </div>
  );
}
