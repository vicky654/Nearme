import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import NearbyPage from './NearbyPage';
import { useLocationStore } from '../store/locationStore';

vi.mock('../api/friendApi', () => ({
  getNearbyUsers: vi.fn().mockResolvedValue({
    users: [],
    meta: { showingAllUsers: false, totalRegistered: 0, totalOnline: 0, radiusKm: 20 },
  }),
  updateLocation: vi.fn(),
  sendFriendRequest: vi.fn(),
  reportUser: vi.fn(),
}));
vi.mock('../api/chatApi', () => ({ createOrGetConversation: vi.fn() }));

const mockUseLocationPermission = vi.fn();
vi.mock('../hooks/useLocationPermission', () => ({
  useLocationPermission: () => mockUseLocationPermission(),
}));

function renderNearbyPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <NearbyPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('NearbyPage location gating', () => {
  beforeEach(() => {
    useLocationStore.setState({ permissionStatus: 'unknown', gpsState: 'idle', lastKnownPosition: null, lastSentAt: null });
  });

  afterEach(cleanup);

  it('shows the location permission card instead of the map/results when permission is not granted', async () => {
    mockUseLocationPermission.mockReturnValue({ status: 'denied', request: vi.fn(), openSettings: vi.fn(), isNative: false });
    renderNearbyPage();

    await waitFor(() => expect(screen.getByTestId('location-permission-card')).toBeInTheDocument());
    expect(screen.queryByText('Center me')).not.toBeInTheDocument();
  });

  it('shows the map/results and hides the permission card once granted', async () => {
    mockUseLocationPermission.mockReturnValue({ status: 'granted', request: vi.fn(), openSettings: vi.fn(), isNative: false });
    renderNearbyPage();

    await waitFor(() => expect(screen.getByText('Center me')).toBeInTheDocument());
    expect(screen.queryByTestId('location-permission-card')).not.toBeInTheDocument();
  });
});
