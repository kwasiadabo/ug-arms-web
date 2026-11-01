/**
 * Session store (Zustand): the signed-in user, whether the session is known, and permission checks for the
 * interface.
 *
 * Permission checks here only decide what to show; the server enforces every permission independently.
 *
 * @author Kwasi Adabo Boakye
 */

import { create } from 'zustand';

export const useAuth = create((set, get) => ({
  user: null,
  status: 'unknown', // unknown | authenticated | anonymous
  setUser: (user) => set({ user, status: user ? 'authenticated' : 'anonymous' }),
  clear: () => set({ user: null, status: 'anonymous' }),
  can: (...perms) => {
    const p = get().user?.permissions || [];
    return perms.every((x) => p.includes(x));
  },
  canAny: (...perms) => {
    const p = get().user?.permissions || [];
    return perms.some((x) => p.includes(x));
  },
}));

/**
 * Tells whether a user should see the staff interface: they hold at least one staff permission and are not a
 * researcher account.
 *
 * @param {object|null} user The signed-in user.
 * @returns {boolean}
 */
export const isStaff = (user) =>
  Boolean(
    user?.permissions?.some((p) =>
      [
        'records.read',
        'transfer.submit',
        'users.manage',
        'audit.read',
        'appointments.manage',
        'dashboard.view',
      ].includes(p),
    ) && user?.userType !== 'researcher',
  );
