import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProtectedRoute from './ProtectedRoute';
import { useAuthStore } from '../../store/authStore';
import type { User } from '../../types/user';

function renderWithRoute(initialPath: string) {
  const router = createMemoryRouter(
    [
      {
        element: <ProtectedRoute />,
        children: [{ path: '/dashboard', element: <div>Dashboard content</div> }],
      },
      { path: '/login', element: <div>Login page</div> },
    ],
    { initialEntries: [initialPath] }
  );
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}

describe('ProtectedRoute', () => {
  afterEach(() => {
    cleanup();
  });

  it('redirects to /login when there is no authenticated user', () => {
    useAuthStore.getState().clearAuth();
    renderWithRoute('/dashboard');
    expect(screen.getByText('Login page')).toBeInTheDocument();
  });

  it('renders the protected content when a user is authenticated', () => {
    useAuthStore.getState().setAuth({ id: '1', username: 'test' } as unknown as User, 'token');
    renderWithRoute('/dashboard');
    expect(screen.getByText('Dashboard content')).toBeInTheDocument();
  });
});
