/**
 * Unit tests for user flows rendered with a memory router and a mocked API: sign-in, protected routes, search and
 * filtering, feedback components, and keyboard and mobile navigation.
 *
 * @author Kwasi Adabo Boakye
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  request: vi.fn(),
}));
vi.mock('../../src/lib/api.js', async (orig) => {
  const actual = await orig();
  return { ...actual, api: apiMock };
});

import LoginPage from '../../src/features/authentication/LoginPage.jsx';
import { RequireStaff, RequirePerm } from '../../src/routes/guards.jsx';
import { useAuth } from '../../src/store/auth.js';
import { SearchExperience } from '../../src/components/search/SearchExperience.jsx';
import { UploadProgress } from '../../src/components/forms/UploadProgress.jsx';
import { ErrorState, Tabs } from '../../src/components/ui/index.js';
import { PublicLayout } from '../../src/features/public/PublicLayout.jsx';
import { useState } from 'react';

const staff = {
  id: 'u1',
  fullName: 'Kofi Boateng',
  email: 'a@x',
  userType: 'staff',
  roles: ['archivist'],
  permissions: ['dashboard.view', 'records.read'],
  mustChangePassword: false,
};

/**
 * Renders routes in a memory router with a fresh query client that does not retry.
 *
 * @param {object[]} routes Route definitions.
 * @param {string} initial Address to start at.
 * @returns {object} The router, for inspecting navigation.
 */
function renderRoutes(routes, initial) {
  const router = createMemoryRouter(routes, { initialEntries: [initial] });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

beforeEach(() => {
  Object.values(apiMock).forEach((f) => f.mockReset());
  useAuth.setState({ user: null, status: 'anonymous' });
});

describe('login', () => {
  it('validates input before calling the API', async () => {
    renderRoutes([{ path: '/login', element: <LoginPage /> }], '/login');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(apiMock.post).not.toHaveBeenCalled();
  });

  it('signs in staff and redirects to the workspace; shows server errors', async () => {
    apiMock.post.mockRejectedValueOnce({
      response: { status: 401, data: { error: { message: 'Invalid email or password' } } },
    });
    const router = renderRoutes(
      [
        { path: '/login', element: <LoginPage /> },
        { path: '/admin', element: <p>Workspace</p> },
      ],
      '/login',
    );
    await userEvent.type(screen.getByLabelText('Email'), 'a@x.org');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument();
    apiMock.post.mockResolvedValueOnce({ data: { data: { user: staff } } });
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin'));
    expect(useAuth.getState().user.email).toBe('a@x');
  });
});

describe('protected routes', () => {
  const routes = [
    {
      path: '/admin',
      element: (
        <RequireStaff>
          <p>Staff area</p>
        </RequireStaff>
      ),
    },
    {
      path: '/admin/account',
      element: (
        <RequireStaff>
          <p>Account</p>
        </RequireStaff>
      ),
    },
    { path: '/login', element: <p>Login page</p> },
    { path: '/my', element: <p>Researcher area</p> },
  ];
  it('sends anonymous visitors to sign in with a return path', async () => {
    const router = renderRoutes(routes, '/admin');
    expect(await screen.findByText('Login page')).toBeInTheDocument();
    expect(router.state.location.search).toContain('next=%2Fadmin');
  });
  it('sends researchers to their own area', async () => {
    useAuth.setState({
      user: { ...staff, userType: 'researcher', permissions: ['research.request'] },
      status: 'authenticated',
    });
    renderRoutes(routes, '/admin');
    expect(await screen.findByText('Researcher area')).toBeInTheDocument();
  });
  it('forces a password change before anything else', async () => {
    useAuth.setState({ user: { ...staff, mustChangePassword: true }, status: 'authenticated' });
    const router = renderRoutes(routes, '/admin');
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/account'));
  });
  it('hides pages the role lacks and explains why', async () => {
    useAuth.setState({ user: staff, status: 'authenticated' });
    renderRoutes(
      [
        {
          path: '/admin/users',
          element: (
            <RequirePerm any={['users.manage']}>
              <p>Users</p>
            </RequirePerm>
          ),
        },
      ],
      '/admin/users',
    );
    expect(await screen.findByText('Access not permitted')).toBeInTheDocument();
    expect(screen.queryByText('Users')).not.toBeInTheDocument();
  });
});

describe('search and filtering', () => {
  it('sends the query and facet filters to the server and highlights matches', async () => {
    apiMock.get.mockImplementation((url, { params } = {}) =>
      Promise.resolve({
        data: {
          data: {
            total: 1,
            page: 1,
            pageSize: 20,
            totalPages: 1,
            results: [
              {
                id: 'r1',
                level: 'series',
                referenceCode: 'UGA/1',
                title: 'Council minutes',
                mode: 'full',
                snippet: [
                  { text: 'The ', hit: false },
                  { text: 'Council', hit: true },
                ],
              },
            ],
            facets: { level: [{ value: 'series', count: 1 }], collection: [], decade: [], creator: [], subject: [] },
            params,
          },
        },
      }),
    );
    renderRoutes(
      [
        {
          path: '/search',
          element: <SearchExperience endpoint="/public/search" recordHref={(id) => `/records/${id}`} />,
        },
      ],
      '/search',
    );
    await userEvent.type(screen.getByLabelText('Search terms'), 'Council');
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(await screen.findByRole('link', { name: /Council minutes/ })).toBeInTheDocument();
    expect(screen.getAllByText('Council').some((el) => el.tagName === 'MARK')).toBe(true);
    await userEvent.click(
      within(screen.getByRole('complementary', { name: 'Filters' })).getByRole('button', { name: /Series/ }),
    );
    await waitFor(() =>
      expect(apiMock.get).toHaveBeenLastCalledWith(
        '/public/search',
        expect.objectContaining({ params: expect.objectContaining({ q: 'Council', level: 'series' }) }),
      ),
    );
  });
});

describe('feedback components', () => {
  it('reports upload progress accessibly', () => {
    render(<UploadProgress percent={42} label="Uploading 2 file(s)" />);
    const bar = screen.getByRole('progressbar', { name: 'Uploading 2 file(s)' });
    expect(bar).toHaveAttribute('aria-valuenow', '42');
  });
  it('shows permission and connectivity errors clearly', () => {
    const { rerender } = render(<ErrorState error={{ response: { status: 403 } }} />);
    expect(screen.getByText('Access not permitted')).toBeInTheDocument();
    rerender(<ErrorState error={{ message: 'Network Error' }} onRetry={() => {}} />);
    expect(screen.getByText(/Cannot reach the server/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});

describe('navigation and keyboard access', () => {
  it('opens the mobile menu', async () => {
    renderRoutes([{ element: <PublicLayout />, children: [{ path: '/', element: <p>Home</p> }] }], '/');
    await userEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expect(screen.getByRole('navigation', { name: 'Mobile' })).toBeInTheDocument();
  });
  it('moves between tabs with arrow keys', async () => {
    /**
     * Test component that renders controlled tabs, used to check arrow-key navigation.
     *
     * @returns {JSX.Element}
     */
    function T() {
      const [v, setV] = useState('a');
      return (
        <Tabs
          value={v}
          onChange={setV}
          tabs={[
            { value: 'a', label: 'One' },
            { value: 'b', label: 'Two' },
          ]}
        />
      );
    }
    render(<T />);
    screen.getByRole('tab', { name: 'One' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Two' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Two' })).toHaveFocus();
  });
});
