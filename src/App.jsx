/**
 * Root application component: data fetching (TanStack Query), session restoration, routing and toast notifications.
 *
 * Queries are cached for 30 seconds, are not refetched on window focus, and are retried at most once more except
 * for 401, 403 and 404 responses, which retrying would not fix.
 *
 * @author Kwasi Adabo Boakye
 */

import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { router } from './routes/router.jsx';
import { SessionBootstrap } from './app/SessionBootstrap.jsx';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, err) => count < 2 && ![401, 403, 404].includes(err?.response?.status),
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * Renders the application providers, the router and the toast container.
 *
 * @returns {JSX.Element}
 */
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionBootstrap>
        <RouterProvider router={router} />
      </SessionBootstrap>
      <Toaster
        position="top-right"
        richColors
        closeButton
        toastOptions={{ style: { fontFamily: 'Manrope, sans-serif' } }}
      />
    </QueryClientProvider>
  );
}
