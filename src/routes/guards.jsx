/**
 * Route guards. They decide what the interface shows; the server enforces the same rules independently on every
 * request.
 *
 * @author Kwasi Adabo Boakye
 */

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, isStaff } from '../store/auth.js';
import { EmptyState } from '../components/ui/index.js';
import { ShieldOff } from 'lucide-react';

/**
 * Shows the page only to signed-in users; others are sent to the sign-in page and returned here afterwards.
 *
 * @param {object} props
 * @param {import('react').ReactNode} props.children The protected page.
 * @returns {JSX.Element|null}
 */
export function RequireAuth({ children }) {
  const user = useAuth((s) => s.user);
  const location = useLocation();
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return children;
}

/**
 * Shows the staff interface only to staff. Researchers are sent to their own area, and staff who must change a
 * temporary password are sent to the password page first.
 *
 * @param {object} props
 * @param {import('react').ReactNode} props.children The protected page.
 * @returns {JSX.Element|null}
 */
export function RequireStaff({ children }) {
  const user = useAuth((s) => s.user);
  const location = useLocation();
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (!isStaff(user)) return <Navigate to="/my" replace />;
  if (user.mustChangePassword && !location.pathname.startsWith('/admin/account'))
    return <Navigate to="/admin/account?tab=security&required=1" replace />;
  return children;
}

/**
 * Shows a page only if the user holds at least one of the listed permissions; otherwise explains that access is not
 * permitted.
 *
 * @param {object} props
 * @param {string[]} props.any Permissions, any one of which is sufficient.
 * @param {import('react').ReactNode} props.children The protected page.
 * @returns {JSX.Element|null}
 */
export function RequirePerm({ any, children }) {
  const perms = useAuth((s) => s.user?.permissions || []);
  if (!any.some((p) => perms.includes(p))) {
    return (
      <EmptyState
        icon={ShieldOff}
        title="Access not permitted"
        description="Your role does not include access to this area. Contact the Archives if you need it."
      />
    );
  }
  return children;
}
