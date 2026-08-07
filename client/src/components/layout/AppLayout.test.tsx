import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AppLayout from './AppLayout';
import { useAuthStore } from '../../store/authStore';
import { useLocationStore } from '../../store/locationStore';
import type { User } from '../../types/user';

vi.mock('../../api/authApi', () => ({
  logoutUser: vi.fn().mockResolvedValue(undefined),
  resendVerification: vi.fn(),
}));

import { logoutUser } from '../../api/authApi';

const fakeUser = {
  id: '1',
  username: 'alice',
  displayName: 'Alice',
  email: 'alice@example.com',
  emailVerifiedAt: '2026-01-01T00:00:00.000Z',
  avatarUrl: 'https://example.com/alice.png',
} as unknown as User;

const unverifiedUser = {
  id: '2',
  username: 'bob',
  displayName: 'Bob',
  email: 'bob@example.com',
  emailVerifiedAt: null,
  avatarUrl: 'https://example.com/bob.png',
} as unknown as User;

function renderLayout() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AppLayout>
          <div>Page content</div>
        </AppLayout>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('AppLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().setAuth(fakeUser, 'token');
  });

  afterEach(() => {
    cleanup();
  });

  it('renders navigation, the signed-in user avatar, and the page content', () => {
    const { container } = renderLayout();
    expect(screen.getAllByText('Home')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Nearby')[0]).toBeInTheDocument();
    expect(screen.getByText('Page content')).toBeInTheDocument();
    expect(container.querySelectorAll('ion-content')).toHaveLength(1);
    expect(container.querySelector('ion-refresher')).toBeInTheDocument();
  });

  it('logs out and clears the auth store via ProfileDropdown', async () => {
    renderLayout();
    const avatarImg = screen.getAllByAltText('Alice')[0]!;
    await userEvent.click(avatarImg);
    const logoutBtn = await screen.findByText(/log out/i);
    await userEvent.click(logoutBtn);
    expect(logoutUser).toHaveBeenCalled();
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('does not show the verify-email banner for a verified user', () => {
    renderLayout();
    expect(screen.queryByText('Please verify your email address.')).not.toBeInTheDocument();
  });

  it('shows the verify-email banner above the page content for an unverified user', () => {
    useAuthStore.getState().setAuth(unverifiedUser, 'token');
    renderLayout();
    expect(screen.getByText('Please verify your email address.')).toBeInTheDocument();
  });

  it('probes location permission at the app root, so tracking can work without ever visiting Nearby', async () => {
    // C1: only NearbyPage/LocationPermissionCard used to call useLocationPermission();
    // AppLayout must also call it so `permissionStatus` in the shared store
    // reflects reality (and useLocationTracking can start) app-wide.
    useLocationStore.setState({ permissionStatus: 'unknown', gpsState: 'idle', lastKnownPosition: null, lastSentAt: null });
    renderLayout();
    await waitFor(() => expect(useLocationStore.getState().permissionStatus).not.toBe('unknown'));
  });
});
