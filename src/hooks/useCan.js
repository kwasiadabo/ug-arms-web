/**
 * Permission-check hook for components.
 *
 * @author Kwasi Adabo Boakye
 */

import { useAuth } from '../store/auth.js';

/**
 * Returns the signed-in user with helpers that check permissions: `can` requires all listed permissions and
 * `canAny` at least one. These only decide what to show; the server enforces the same rules.
 *
 * @returns {{ user: object|null, can: (...perms: string[]) => boolean, canAny: (...perms: string[]) => boolean }}
 */
export function useCan() {
  const user = useAuth((s) => s.user);
  const perms = user?.permissions || [];
  return {
    user,
    can: (...p) => p.every((x) => perms.includes(x)),
    canAny: (...p) => p.some((x) => perms.includes(x)),
  };
}
