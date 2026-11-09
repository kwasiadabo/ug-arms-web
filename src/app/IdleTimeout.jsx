/**
 * Signs the user out after a period without keyboard, mouse, scroll or touch activity
 * (`security.idleTimeoutMinutes`, 25 minutes by default), with a warning two minutes before.
 *
 * Background requests such as the notification poll do not count as activity. The time of the last activity is
 * shared between tabs through local storage, so working in one tab keeps the others signed in, and every tab signs
 * out together.
 *
 * @author Kwasi Adabo Boakye
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../store/auth.js';
import { useInstitution } from '../store/institution.js';
import { leaveWithoutPrompt } from '../hooks/useUnsavedChanges.js';
import { Button, Dialog } from '../components/ui/index.js';

const STORAGE_KEY = 'ugarms_last_activity';
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'wheel', 'scroll', 'touchstart'];
const WRITE_EVERY_MS = 5_000;
const WARN_BEFORE_MS = 120_000;

/**
 * Reads the last activity time recorded by any tab.
 *
 * @returns {number} Milliseconds since the epoch, or 0 when unavailable.
 */
const readShared = () => {
  try {
    return Number(window.localStorage.getItem(STORAGE_KEY)) || 0;
  } catch {
    return 0;
  }
};

/**
 * Records the last activity time for the other tabs.
 *
 * @param {number} at Milliseconds since the epoch.
 */
const writeShared = (at) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(at));
  } catch {
    /* private mode or blocked storage: this tab still tracks its own activity */
  }
};

/**
 * Formats a number of milliseconds as m:ss.
 *
 * @param {number} ms Remaining time.
 * @returns {string}
 */
const clock = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * Watches for activity while a user is signed in, warns before the idle timeout and then signs out: the session is
 * revoked on the server and the page is reloaded at the sign-in page, which also discards everything held in memory.
 * A timeout of 0 turns this off.
 *
 * @returns {JSX.Element|null}
 */
export function IdleTimeout() {
  const status = useAuth((s) => s.status);
  const minutes = useInstitution((s) => s.idleTimeoutMinutes);
  const timeoutMs = minutes > 0 ? minutes * 60_000 : 0;
  const warnMs = Math.min(WARN_BEFORE_MS, timeoutMs / 2);
  const last = useRef(Date.now());
  const written = useRef(0);
  const warningShown = useRef(false);
  const signingOut = useRef(false);
  const [remaining, setRemaining] = useState(null);

  /**
   * Records activity in this tab and, at most every few seconds, for the other tabs.
   *
   * @param {boolean} [force=false] Write to shared storage now.
   */
  const touch = useCallback((force = false) => {
    const now = Date.now();
    last.current = now;
    if (force || now - written.current > WRITE_EVERY_MS) {
      written.current = now;
      writeShared(now);
    }
  }, []);

  /**
   * Revokes the session and reloads at the sign-in page, returning to the current page after sign-in.
   *
   * @returns {Promise<void>}
   */
  const signOut = useCallback(async () => {
    if (signingOut.current) return;
    signingOut.current = true;
    await api.post('/auth/logout', { reason: 'idle' }).catch(() => {});
    leaveWithoutPrompt();
    const next = `${window.location.pathname}${window.location.search}`;
    window.location.replace(`/login?reason=idle&next=${encodeURIComponent(next)}`);
  }, []);

  useEffect(() => {
    if (status !== 'authenticated' || !timeoutMs) return undefined;
    touch(true);

    /** Counts real user input as activity, except while the warning asks for a deliberate choice. */
    const onActivity = () => {
      if (!warningShown.current) touch();
    };

    /** Checks the time since the last activity in any tab and shows, updates or hides the warning. */
    const check = () => {
      const idle = Date.now() - Math.max(last.current, readShared());
      if (idle >= timeoutMs) {
        signOut();
      } else if (idle >= timeoutMs - warnMs) {
        warningShown.current = true;
        setRemaining(timeoutMs - idle);
      } else if (warningShown.current) {
        // Another tab was used, or the user chose to stay signed in.
        warningShown.current = false;
        setRemaining(null);
      }
    };

    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true, capture: true }));
    document.addEventListener('visibilitychange', check);
    const timer = window.setInterval(check, 1000);
    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity, { capture: true }));
      document.removeEventListener('visibilitychange', check);
      window.clearInterval(timer);
      warningShown.current = false;
      setRemaining(null);
    };
  }, [status, timeoutMs, warnMs, touch, signOut]);

  /** Keeps the user signed in from the warning. */
  const stay = () => {
    touch(true);
    warningShown.current = false;
    setRemaining(null);
  };

  if (remaining === null) return null;
  return (
    <Dialog
      open
      onClose={stay}
      size="sm"
      title="Are you still there?"
      description={`For security, you will be signed out after ${minutes} minutes without activity.`}
      footer={
        <>
          <Button variant="secondary" onClick={signOut}>
            Sign out now
          </Button>
          <Button onClick={stay} autoFocus>
            Stay signed in
          </Button>
        </>
      }
    >
      <p className="text-sm" role="timer">
        You will be signed out in <span className="font-semibold tabular-nums">{clock(remaining)}</span>. Unsaved
        changes will be lost.
      </p>
    </Dialog>
  );
}
