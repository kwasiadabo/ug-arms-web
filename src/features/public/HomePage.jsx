/**
 * Public home page of the archives portal.
 *
 * @author Kwasi Adabo Boakye
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, ArrowRight, Library, FileText, Image as ImageIcon } from 'lucide-react';
import { api } from '../../lib/api.js';
import { Skeleton, ErrorState } from '../../components/ui/index.js';
import { Thumb } from '../../components/viewer/AssetViewer.jsx';
import { fmtNumber, humanize } from '../../utils/format.js';

/**
 * Shows the search banner, live counts of collections, published descriptions and digital items, featured
 * collections, recently published material with images, browsing by subject, and visiting information. Every figure
 * comes from the live catalogue.
 *
 * @returns {JSX.Element}
 */
export default function HomePage() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  useEffect(() => {
    document.title = 'University of Ghana Archives';
  }, []);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['public-home'],
    queryFn: () => api.get('/public/home').then((r) => r.data.data),
  });
  const browse = useQuery({
    queryKey: ['public-browse', 'subjects'],
    queryFn: () => api.get('/public/browse/subjects').then((r) => r.data.data),
  });
  return (
    <>
      <section className="relative overflow-hidden bg-brand-900 text-white">
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
          <p className="label-eyebrow !text-gold-300">University of Ghana, Legon</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-extrabold leading-[1.1] text-white sm:text-5xl">
            Explore the archives of Ghana's premier university.
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-brand-100/85">
            Council minutes and correspondence, photographs and oral histories, theses and personal papers — described,
            preserved and opened for research.
          </p>
          <form
            role="search"
            className="mt-8 flex max-w-2xl gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              navigate(`/search?q=${encodeURIComponent(q)}`);
            }}
          >
            <label htmlFor="hero-q" className="sr-only">
              Search the archives
            </label>
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-soft"
                aria-hidden
              />
              <input
                id="hero-q"
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by title, person, department, subject or reference code"
                className="h-14 w-full rounded-xl border-0 bg-white pl-12 pr-4 text-base text-ink shadow-lg focus:outline-none focus:ring-4 focus:ring-gold-300/50"
              />
            </div>
            <button
              type="submit"
              className="h-14 rounded-xl bg-gold-500 px-6 font-bold text-brand-900 shadow-lg hover:bg-gold-400"
            >
              Search
            </button>
          </form>
          {data && (
            <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4 text-sm">
              {[
                [data.stats.collections, 'Collections'],
                [data.stats.descriptions, 'Published descriptions'],
                [data.stats.digitalItems, 'Digital items online'],
              ].map(([n, l]) => (
                <div key={l}>
                  <dt className="text-brand-100/70">{l}</dt>
                  <dd className="text-2xl font-extrabold tabular-nums text-white">{fmtNumber(n)}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-16 px-4 py-14 sm:px-6">
        {error && <ErrorState error={error} onRetry={refetch} />}
        <section aria-labelledby="featured-h">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="label-eyebrow">Featured</p>
              <h2 id="featured-h" className="mt-1 text-2xl font-extrabold">
                Featured collections
              </h2>
            </div>
            <Link
              to="/collections"
              className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline"
            >
              All collections <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {isLoading && [0, 1, 2].map((i) => <Skeleton key={i} className="h-48" />)}
            {data?.featured.map((c) => (
              <Link
                key={c.id}
                to={`/records/${c.id}`}
                className="card group flex flex-col p-5 transition-shadow hover:shadow-md"
              >
                <span className="w-fit rounded-md bg-brand-50 p-2 text-brand-700">
                  <Library className="h-5 w-5" aria-hidden />
                </span>
                <p className="mt-4 text-xs font-semibold text-gold-600">{c.referenceCode}</p>
                <h3 className="mt-1 text-lg font-bold leading-snug group-hover:text-brand-800">{c.title}</h3>
                <p className="mt-1 text-sm text-ink-soft">
                  {c.dateExpression}
                  {c.extentAndMedium ? ` · ${c.extentAndMedium}` : ''}
                </p>
                {c.scopeAndContent && <p className="mt-3 line-clamp-3 text-sm text-ink-soft">{c.scopeAndContent}</p>}
              </Link>
            ))}
            {data && !data.featured.length && (
              <p className="text-sm text-ink-soft sm:col-span-3">
                Featured collections will appear here once the Archives publishes them.
              </p>
            )}
          </div>
        </section>

        {data?.highlights?.length > 0 && (
          <section aria-labelledby="images-h">
            <p className="label-eyebrow">From the photographic collections</p>
            <h2 id="images-h" className="mt-1 text-2xl font-extrabold">
              Historical images
            </h2>
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {data.highlights.map((h) => (
                <Link
                  key={h.assetId}
                  to={`/records/${h.recordId}`}
                  className="group overflow-hidden rounded-xl border border-line"
                >
                  <Thumb
                    assetId={h.assetId}
                    alt={h.title}
                    className="aspect-[4/3] w-full object-cover transition-transform group-hover:scale-[1.03]"
                  />
                  <p className="truncate px-3 py-2 text-sm font-semibold">{h.title}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="grid gap-10 lg:grid-cols-[2fr_1fr]">
          <section aria-labelledby="recent-h">
            <p className="label-eyebrow">New in the catalogue</p>
            <h2 id="recent-h" className="mt-1 text-2xl font-extrabold">
              Recently published
            </h2>
            <ul className="mt-5 divide-y divide-line rounded-xl border border-line">
              {data?.recent.map((r) => (
                <li key={r.id}>
                  <Link to={`/records/${r.id}`} className="flex items-start gap-3 px-4 py-3 hover:bg-canvas">
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
                    <span className="min-w-0">
                      <span className="block font-semibold">{r.title}</span>
                      <span className="block text-xs text-ink-soft">
                        {r.referenceCode} · {humanize(r.level)}
                        {r.dateExpression ? ` · ${r.dateExpression}` : ''}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
              {data && !data.recent.length && (
                <li className="px-4 py-6 text-sm text-ink-soft">No published descriptions yet.</li>
              )}
            </ul>
          </section>
          <section aria-labelledby="browse-h">
            <p className="label-eyebrow">Browse</p>
            <h2 id="browse-h" className="mt-1 text-2xl font-extrabold">
              By subject
            </h2>
            <div className="mt-5 flex flex-wrap gap-2">
              {browse.data?.map((s) => (
                <Link
                  key={s.value}
                  to={`/search?subjectId=${s.value}`}
                  className="rounded-full border border-line px-3 py-1.5 text-sm hover:border-brand-300 hover:bg-brand-50"
                >
                  {s.label} <span className="text-ink-soft">{s.count}</span>
                </Link>
              ))}
              {browse.data && !browse.data.length && (
                <p className="text-sm text-ink-soft">Subjects appear as descriptions are published.</p>
              )}
            </div>
            <div className="mt-8 rounded-xl border border-gold-100 bg-gold-50 p-5">
              <ImageIcon className="h-5 w-5 text-gold-600" aria-hidden />
              <h3 className="mt-2 font-bold">Planning a visit?</h3>
              <p className="mt-1 text-sm text-ink-soft">
                Book a reading-room appointment or ask an archivist for help with your research.
              </p>
              <Link
                to="/request"
                className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline"
              >
                Make a request <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
