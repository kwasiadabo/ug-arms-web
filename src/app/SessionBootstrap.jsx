/**
 * Restores the user's session and the institution settings before any page is rendered.
 *
 * @author Kwasi Adabo Boakye
 */

import { useEffect } from 'react';
import { api, setSessionExpiredHandler } from '../lib/api.js';
import { useAuth } from '../store/auth.js';
import { Mark } from '../components/layout/Logo.jsx';
import { useInstitution } from '../store/institution.js';
import { configureFormatting } from '../utils/format.js';

/**
 * Loads the public institution settings (names, locale, time zone and currency) and restores the session from the
 * HTTP-only cookies, refreshing the access token once if needed. Until the session state is known, a loading
 * indicator is shown, so pages never flash the wrong content for a signed-in user. When a later request finds the
 * session expired, the stored user is cleared.
 *
 * @param {object} props
 * @param {import('react').ReactNode} props.children The application to render once the session is known.
 * @returns {JSX.Element|null}
 */
export function SessionBootstrap({ children }) {
  const status = useAuth((s) => s.status);
  const setUser = useAuth((s) => s.setUser);
  const clear = useAuth((s) => s.clear);
  const setFromSettings = useInstitution((s) => s.setFromSettings);
  useEffect(() => {
    api
      .get('/settings/public')
      .then((r) => {
        setFromSettings(r.data.data);
        configureFormatting({
          locale: r.data.data['institution.locale'],
          timeZone: r.data.data['institution.timezone'],
          currency: r.data.data['institution.currency'],
        });
      })
      .catch(() => {});
  }, [setFromSettings]);
  useEffect(() => {
    setSessionExpiredHandler(() => clear());
    api
      .get('/auth/me')
      .then((r) => setUser(r.data.data))
      .catch(async () => {
        try {
          await api.post('/auth/refresh');
          const r = await api.get('/auth/me');
          setUser(r.data.data);
        } catch {
          clear();
        }
      });
  }, [setUser, clear]);
  if (status === 'unknown') {
    return (
      <div className="flex min-h-screen items-center justify-center" role="status" aria-label="Loading">
        <Mark className="h-10 w-10 animate-pulse" />
      </div>
    );
  }
  return children;
}
