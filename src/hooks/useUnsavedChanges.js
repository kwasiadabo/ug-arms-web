/**
 * Hook that warns before leaving a form with unsaved changes.
 *
 * @author Kwasi Adabo Boakye
 */

import { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';

/**
 * Asks for confirmation before navigating to another page within the application, or closing or reloading the
 * browser tab, while the form has unsaved changes.
 *
 * @param {boolean} dirty Whether the form has unsaved changes.
 * @param {string} [message] Message shown in the confirmation.
 */
export function useUnsavedChanges(dirty, message = 'You have unsaved changes. Leave without saving?') {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (blocker.state === 'blocked') {
      if (window.confirm(message)) blocker.proceed();
      else blocker.reset();
    }
  }, [blocker, message]);
  useEffect(() => {
    if (!dirty) return undefined;

    /**
     * Asks the browser to show its "leave site?" confirmation.
     *
     * @param {BeforeUnloadEvent} e The unload event.
     */
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = message;
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty, message]);
}
