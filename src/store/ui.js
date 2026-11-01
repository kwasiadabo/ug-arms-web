/**
 * Store of interface preferences: whether the sidebar is collapsed (remembered in this browser) and whether the
 * mobile navigation is open.
 *
 * @author Kwasi Adabo Boakye
 */

import { create } from 'zustand';

/**
 * Reads a remembered preference from local storage, falling back to the default when storage is unavailable or the
 * value is invalid.
 *
 * @param {string} k Storage key.
 * @param {*} d Default value.
 * @returns {*}
 */
const read = (k, d) => {
  try {
    return JSON.parse(localStorage.getItem(k)) ?? d;
  } catch {
    return d;
  }
};

export const useUi = create((set) => ({
  sidebarCollapsed: read('ugarms.sidebarCollapsed', false),
  mobileNavOpen: false,
  toggleSidebar: () =>
    set((s) => {
      try {
        localStorage.setItem('ugarms.sidebarCollapsed', JSON.stringify(!s.sidebarCollapsed));
      } catch {
        /* ignore */
      }
      return { sidebarCollapsed: !s.sidebarCollapsed };
    }),
  setMobileNav: (open) => set({ mobileNavOpen: open }),
}));
