/**
 * Layout of the staff interface: permission-filtered sidebar, top bar with catalogue search, notifications and user
 * menu, and the page content.
 *
 * @author Kwasi Adabo Boakye
 */

import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, ChevronsLeft, ChevronsRight, LogOut, Menu, Search, User, X, Globe, KeyRound } from 'lucide-react';
import { api } from '../../lib/api.js';
import { useAuth } from '../../store/auth.js';
import { useUi } from '../../store/ui.js';
import { visibleNav } from './nav.js';
import { cn, Button } from '../ui/index.js';
import { relative } from '../../utils/format.js';
import { Logo } from './Logo.jsx';
import { Credits } from './Credits.jsx';

/**
 * Renders the navigation groups the user may see, highlighting the current page.
 *
 * @param {object} props
 * @param {boolean} props.collapsed Show icons only.
 * @param {() => void} [props.onNavigate] Called after a link is followed (closes the mobile menu).
 * @returns {JSX.Element|null}
 */
function Sidebar({ collapsed, onNavigate }) {
  const user = useAuth((s) => s.user);
  const groups = visibleNav(user?.permissions);
  return (
    <nav aria-label="Main" className="flex-1 overflow-y-auto px-2 pb-6">
      {groups.map((g) => (
        <div key={g.group} className="mt-4">
          {!collapsed && (
            <p className="px-3 pb-1 text-[10.5px] font-bold uppercase tracking-[0.12em] text-brand-200/70">{g.group}</p>
          )}
          <ul className="space-y-0.5">
            {g.items.map((i) => (
              <li key={i.to}>
                <NavLink
                  to={i.to}
                  end={i.end}
                  onClick={onNavigate}
                  title={collapsed ? i.label : undefined}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors',
                      isActive
                        ? 'bg-white/12 text-white shadow-[inset_2px_0_0_var(--color-gold-300)]'
                        : 'text-brand-100/85 hover:bg-white/6 hover:text-white',
                      collapsed && 'justify-center px-0',
                    )
                  }
                >
                  <i.icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
                  {!collapsed && <span className="truncate">{i.label}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/**
 * Notification bell with the unread count and the latest notifications, refreshed every minute. Notifications can
 * be opened and marked as read individually or all at once; the panel closes when clicking outside it.
 *
 * @returns {JSX.Element}
 */
function Notifications() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const ref = useRef(null);
  const { data } = useQuery({
    queryKey: ['notifications', 'latest'],
    queryFn: () => api.get('/notifications', { params: { pageSize: 8 } }).then((r) => r.data),
    refetchInterval: 60_000,
  });
  const markAll = useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const markOne = useMutation({
    mutationFn: (id) => api.post(`/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
  useEffect(() => {
    /**
     * Closes the notifications panel when a click lands outside it.
     *
     * @param {MouseEvent} e The click.
     */
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const unread = data?.meta?.unread || 0;
  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 min-w-4 rounded-full bg-gold-500 px-1 text-[10px] font-bold leading-4 text-brand-900">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </Button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-[22rem] max-w-[calc(100vw-1rem)] rounded-xl border border-line bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <p className="text-sm font-bold">Notifications</p>
            {unread > 0 && (
              <button
                type="button"
                className="text-xs font-semibold text-brand-700 hover:underline"
                onClick={() => markAll.mutate()}
              >
                Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-96 divide-y divide-line overflow-y-auto">
            {(data?.data || []).map((n) => (
              <li key={n.id}>
                <Link
                  to={n.link || '#'}
                  onClick={() => {
                    if (!n.readAt) markOne.mutate(n.id);
                    setOpen(false);
                  }}
                  className={cn('block px-4 py-3 text-sm hover:bg-canvas', !n.readAt && 'bg-brand-50/50')}
                >
                  <p className="font-semibold">{n.title}</p>
                  {n.body && <p className="mt-0.5 line-clamp-2 text-ink-soft">{n.body}</p>}
                  <p className="mt-1 text-xs text-ink-soft">{relative(n.createdAt)}</p>
                </Link>
              </li>
            ))}
            {!data?.data?.length && (
              <li className="px-4 py-8 text-center text-sm text-ink-soft">You are all caught up.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Menu with the user's name and main role, links to their account and security settings, and sign-out.
 *
 * @returns {JSX.Element}
 */
function UserMenu() {
  const [open, setOpen] = useState(false);
  const user = useAuth((s) => s.user);
  const clear = useAuth((s) => s.clear);
  const navigate = useNavigate();
  const qc = useQueryClient();

  /**
   * Signs out on the server, clears the stored user and all cached data, and returns to the sign-in page.
   *
   * @returns {Promise<void>}
   */
  const logout = async () => {
    await api.post('/auth/logout').catch(() => {});
    clear();
    qc.clear();
    navigate('/login');
  };
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-canvas"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-700 text-xs font-bold text-white">
          {user?.fullName
            ?.split(' ')
            .map((p) => p[0])
            .slice(0, 2)
            .join('')}
        </span>
        <span className="hidden text-left md:block">
          <span className="block text-[13px] font-semibold leading-4">{user?.fullName}</span>
          <span className="block text-[11px] text-ink-soft">{user?.roles?.[0]?.replace(/_/g, ' ')}</span>
        </span>
      </button>
      {open && (
        <div
          className="absolute right-0 z-30 mt-2 w-56 rounded-xl border border-line bg-white p-1.5 shadow-xl"
          onMouseLeave={() => setOpen(false)}
        >
          <Link
            to="/admin/account"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-canvas"
            onClick={() => setOpen(false)}
          >
            <User className="h-4 w-4" /> My account
          </Link>
          <Link
            to="/admin/account?tab=security"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-canvas"
            onClick={() => setOpen(false)}
          >
            <KeyRound className="h-4 w-4" /> Password & sessions
          </Link>
          <Link
            to="/"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-canvas"
            onClick={() => setOpen(false)}
          >
            <Globe className="h-4 w-4" /> Public catalogue
          </Link>
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-red-700 hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Catalogue search box in the top bar, shown to users who can read descriptions.
 *
 * @returns {JSX.Element}
 */
function GlobalSearch() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const can = useAuth((s) => s.can);
  if (!can('records.read')) return <div className="flex-1" />;
  return (
    <form
      role="search"
      className="relative max-w-md flex-1"
      onSubmit={(e) => {
        e.preventDefault();
        navigate(`/admin/search?q=${encodeURIComponent(q)}`);
      }}
    >
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft"
        aria-hidden
      />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search the catalogue…"
        aria-label="Search the catalogue"
        className="h-9 w-full rounded-lg border border-line bg-canvas pl-9 pr-3 text-sm focus:border-brand-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-600/25"
      />
    </form>
  );
}

/**
 * Renders the staff layout around the current page. The mobile menu closes on navigation, and the sidebar can be
 * collapsed.
 *
 * @returns {JSX.Element}
 */
export function AdminLayout() {
  const { sidebarCollapsed, toggleSidebar, mobileNavOpen, setMobileNav } = useUi();
  const location = useLocation();
  useEffect(() => {
    setMobileNav(false);
  }, [location.pathname, setMobileNav]);
  return (
    <div className="flex min-h-screen bg-canvas">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow-lg"
      >
        Skip to content
      </a>
      <aside
        className={cn(
          'sticky top-0 hidden h-screen shrink-0 flex-col bg-brand-900 transition-[width] lg:flex',
          sidebarCollapsed ? 'w-[72px]' : 'w-64',
        )}
      >
        <div
          className={cn(
            'flex h-16 items-center border-b border-white/10 px-4',
            sidebarCollapsed && 'justify-center px-0',
          )}
        >
          <Logo compact={sidebarCollapsed} inverted />
        </div>
        <Sidebar collapsed={sidebarCollapsed} />
        <Credits
          compact={sidebarCollapsed}
          stacked
          className={cn('border-t border-white/10 px-4 py-3 text-brand-100/50', sidebarCollapsed && 'text-center')}
        />
        <button
          type="button"
          onClick={toggleSidebar}
          className="flex items-center gap-2 border-t border-white/10 px-4 py-3 text-xs font-semibold text-brand-100/80 hover:text-white"
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? (
            <ChevronsRight className="mx-auto h-4 w-4" />
          ) : (
            <>
              <ChevronsLeft className="h-4 w-4" /> Collapse
            </>
          )}
        </button>
      </aside>
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMobileNav(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-brand-900">
            <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
              <Logo inverted />
              <button
                type="button"
                onClick={() => setMobileNav(false)}
                aria-label="Close navigation"
                className="text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <Sidebar collapsed={false} onNavigate={() => setMobileNav(false)} />
            <Credits stacked className="border-t border-white/10 px-4 py-3 text-brand-100/50" />
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-white/95 px-4 backdrop-blur sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Open navigation"
            onClick={() => setMobileNav(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <GlobalSearch />
          <div className="ml-auto flex items-center gap-1">
            <Notifications />
            <UserMenu />
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
