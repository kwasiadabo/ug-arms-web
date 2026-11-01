/**
 * Layout of the public discovery portal: header with the crest, main navigation, a search box and the visitor's
 * sign-in or account link, a mobile menu, and the footer.
 *
 * @author Kwasi Adabo Boakye
 */

import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Menu, X, Search, UserRound } from 'lucide-react';
import { useAuth, isStaff } from '../../store/auth.js';
import { Logo } from '../../components/layout/Logo.jsx';
import { Credits } from '../../components/layout/Credits.jsx';
import { cn } from '../../components/ui/index.js';

const links = [
  { to: '/search', label: 'Search' },
  { to: '/collections', label: 'Collections' },
  { to: '/request', label: 'Research requests' },
  { to: '/help', label: 'Visiting & access' },
];

/**
 * Renders the public header, the current page and the footer. Submitting the header search opens the search page
 * with the query.
 *
 * @returns {JSX.Element}
 */
export function PublicLayout() {
  const user = useAuth((s) => s.user);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow-lg"
      >
        Skip to content
      </a>
      <div className="h-1 bg-gradient-to-r from-brand-700 via-brand-600 to-gold-500" aria-hidden />
      <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
          <Logo to="/" />
          <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  cn(
                    'rounded-lg px-3 py-2 text-sm font-semibold',
                    isActive ? 'text-brand-800' : 'text-ink-soft hover:text-ink',
                  )
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
          <form
            role="search"
            className="relative ml-auto hidden w-64 lg:block"
            onSubmit={(e) => {
              e.preventDefault();
              navigate(`/search?q=${encodeURIComponent(q)}`);
            }}
          >
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft"
              aria-hidden
            />
            <input
              type="search"
              aria-label="Search the archives"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search the archives"
              className="h-9 w-full rounded-full border border-line bg-canvas pl-9 pr-3 text-sm focus:border-brand-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-600/25"
            />
          </form>
          <div className="ml-auto flex items-center gap-2 lg:ml-0">
            {user ? (
              <Link
                to={isStaff(user) ? '/admin' : '/my'}
                className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-sm font-semibold hover:bg-canvas"
              >
                <UserRound className="h-4 w-4" />
                {isStaff(user) ? 'Staff workspace' : 'My research'}
              </Link>
            ) : (
              <Link
                to="/login"
                className="rounded-full bg-brand-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-800"
              >
                Sign in
              </Link>
            )}
            <button
              type="button"
              className="rounded-lg p-2 md:hidden"
              aria-label="Menu"
              aria-expanded={open}
              onClick={() => setOpen((o) => !o)}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {open && (
          <nav aria-label="Mobile" className="border-t border-line px-4 py-2 md:hidden">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="block rounded-lg px-3 py-2 text-sm font-semibold hover:bg-canvas"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        )}
      </header>
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <footer className="mt-16 border-t border-line bg-brand-900 text-brand-100">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-3 sm:px-6">
          <div>
            <Logo to="/" inverted />
            <p className="mt-3 text-sm text-brand-100/70">
              University of Ghana, Legon, Accra. Archival collections documenting the University's history, research and
              people.
            </p>
          </div>
          <div>
            <p className="text-sm font-bold text-white">Explore</p>
            <ul className="mt-2 space-y-1 text-sm">
              {links.map((l) => (
                <li key={l.to}>
                  <Link className="hover:text-white" to={l.to}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-sm font-bold text-white">Using the Archives</p>
            <p className="mt-2 text-sm text-brand-100/70">
              Some material is restricted to protect privacy, rights or fragile originals. Descriptions explain how to
              request access.
            </p>
          </div>
        </div>
        <div className="border-t border-white/10">
          <Credits className="mx-auto max-w-7xl px-4 py-4 text-brand-100/60 sm:px-6" />
        </div>
      </footer>
    </div>
  );
}
