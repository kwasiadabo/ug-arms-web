/**
 * Unit tests for the sign-out after inactivity: the warning before the timeout, staying signed in, activity in
 * another tab, and the sign-out itself.
 *
 * @author Kwasi Adabo Boakye
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { IdleTimeout } from '../../src/app/IdleTimeout.jsx';
import { useAuth } from '../../src/store/auth.js';
import { useInstitution } from '../../src/store/institution.js';
import { api } from '../../src/lib/api.js';

const replace = vi.fn();
const originalLocation = window.location;

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(api, 'post').mockResolvedValue({});
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { pathname: '/admin/transfers', search: '?status=draft', replace },
  });
  window.localStorage.clear();
  useAuth.setState({ user: { id: 'u1', fullName: 'Efua Asante', permissions: [] }, status: 'authenticated' });
  // One minute keeps the test short: the warning then appears 30 seconds before sign-out.
  useInstitution.setState({ idleTimeoutMinutes: 1 });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  replace.mockReset();
  Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
});

/**
 * Moves the fake clock forward and lets the component react.
 *
 * @param {number} ms Milliseconds to advance.
 * @returns {Promise<void>}
 */
const wait = (ms) => act(() => vi.advanceTimersByTimeAsync(ms));

describe('IdleTimeout', () => {
  it('warns before the timeout and then signs out to the sign-in page', async () => {
    render(<IdleTimeout />);
    await wait(25_000);
    expect(screen.queryByText('Are you still there?')).not.toBeInTheDocument();
    await wait(10_000);
    expect(screen.getByText('Are you still there?')).toBeInTheDocument();
    await wait(26_000);
    expect(api.post).toHaveBeenCalledWith('/auth/logout', { reason: 'idle' });
    expect(replace).toHaveBeenCalledWith(
      `/login?reason=idle&next=${encodeURIComponent('/admin/transfers?status=draft')}`,
    );
  });

  it('stays signed in when the user chooses to', async () => {
    render(<IdleTimeout />);
    await wait(35_000);
    await act(async () => screen.getByRole('button', { name: 'Stay signed in' }).click());
    expect(screen.queryByText('Are you still there?')).not.toBeInTheDocument();
    await wait(40_000);
    expect(replace).not.toHaveBeenCalled();
  });

  it('counts activity in another tab', async () => {
    render(<IdleTimeout />);
    await wait(35_000);
    window.localStorage.setItem('ugarms_last_activity', String(Date.now()));
    await wait(1_000);
    expect(screen.queryByText('Are you still there?')).not.toBeInTheDocument();
  });

  it('does nothing when signed out or when the timeout is 0', async () => {
    useInstitution.setState({ idleTimeoutMinutes: 0 });
    render(<IdleTimeout />);
    await wait(120_000);
    expect(api.post).not.toHaveBeenCalled();
  });
});
