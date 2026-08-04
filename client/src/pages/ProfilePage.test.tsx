import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProfilePage from './ProfilePage';
import { useAuthStore } from '../store/authStore';
import type { User } from '../types/user';

vi.mock('../api/userApi', () => ({
  getMe: vi.fn(),
  updateMe: vi.fn(),
}));

import { getMe, updateMe } from '../api/userApi';

const fakeUser: User = {
  id: '1',
  username: 'alice',
  displayName: 'Alice',
  email: 'alice@example.com',
  avatarUrl: '',
  bio: '',
  interests: ['chess'],
  languages: ['en'],
  role: 'user',
  status: 'active',
  theme: 'system',
  emailVerifiedAt: null,
  createdAt: new Date().toISOString(),
  privacy: {
    hideOnlineStatus: false,
    hideDistance: false,
    hideProfile: false,
    invisibleMode: false,
    privateAccount: false,
  },
};

function renderPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <ProfilePage />
    </QueryClientProvider>
  );
}

afterEach(cleanup);

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().setAuth(fakeUser, 'token-abc');
  });

  it('loads and displays the current profile', async () => {
    vi.mocked(getMe).mockResolvedValue({ user: fakeUser });
    renderPage();
    expect(await screen.findByText('Alice')).toBeInTheDocument();
  });

  it('submits updated fields', async () => {
    vi.mocked(getMe).mockResolvedValue({ user: fakeUser });
    vi.mocked(updateMe).mockResolvedValue({ user: { ...fakeUser, displayName: 'Alice Updated' } });

    renderPage();
    const editBtn = await screen.findByRole('button', { name: /edit profile/i });
    await userEvent.click(editBtn);

    const displayNameInput = await screen.findByDisplayValue('Alice');
    await userEvent.clear(displayNameInput);
    await userEvent.type(displayNameInput, 'Alice Updated');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(updateMe).toHaveBeenCalled());
  });

  it('shows an empty state when the profile fails to load', async () => {
    vi.mocked(getMe).mockRejectedValue(new Error('network error'));
    renderPage();
    expect(await screen.findByText(/couldn't load your profile/i)).toBeInTheDocument();
  });
});
