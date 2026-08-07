import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocationPermissionCard } from './LocationPermissionCard';

const mockPermission = vi.fn();
vi.mock('../../hooks/useLocationPermission', () => ({
  useLocationPermission: () => mockPermission(),
}));

vi.mock('../../store/locationStore', () => ({
  useLocationStore: (selector: (state: { lastSentAt: number | null }) => unknown) => selector({ lastSentAt: null }),
}));

describe('LocationPermissionCard', () => {
  const request = vi.fn();
  const openSettings = vi.fn();

  beforeEach(() => {
    request.mockReset();
    openSettings.mockReset();
  });

  afterEach(cleanup);

  it('renders nothing once permission is granted', () => {
    mockPermission.mockReturnValue({ status: 'granted', request, openSettings, isNative: false });
    render(<LocationPermissionCard />);
    expect(screen.queryByTestId('location-permission-card')).not.toBeInTheDocument();
  });

  it('shows an Allow Location button when status is prompt', () => {
    mockPermission.mockReturnValue({ status: 'prompt', request, openSettings, isNative: false });
    render(<LocationPermissionCard />);
    expect(screen.getByTestId('location-permission-card')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Allow Location' })).toBeInTheDocument();
  });

  it('shows an Allow Location button when status is denied', () => {
    mockPermission.mockReturnValue({ status: 'denied', request, openSettings, isNative: false });
    render(<LocationPermissionCard />);
    expect(screen.getByRole('button', { name: 'Allow Location' })).toBeInTheDocument();
  });

  it('shows an Open Settings button when blocked on native', () => {
    mockPermission.mockReturnValue({ status: 'blocked', request, openSettings, isNative: true });
    render(<LocationPermissionCard />);
    expect(screen.getByRole('button', { name: 'Open Settings' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Allow Location' })).not.toBeInTheDocument();
  });

  it('shows instructional text instead of a button when blocked on web', () => {
    mockPermission.mockReturnValue({ status: 'blocked', request, openSettings, isNative: false });
    render(<LocationPermissionCard />);
    expect(screen.getByText(/Site settings/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('calls request() when Allow Location is clicked', async () => {
    mockPermission.mockReturnValue({ status: 'prompt', request, openSettings, isNative: false });
    render(<LocationPermissionCard />);
    await userEvent.click(screen.getByRole('button', { name: 'Allow Location' }));
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('calls openSettings() when Open Settings is clicked', async () => {
    mockPermission.mockReturnValue({ status: 'blocked', request, openSettings, isNative: true });
    render(<LocationPermissionCard />);
    await userEvent.click(screen.getByRole('button', { name: 'Open Settings' }));
    expect(openSettings).toHaveBeenCalledTimes(1);
  });
});
