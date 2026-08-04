import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DashboardPage from './DashboardPage';
import { useAuthStore } from '../store/authStore';
import type { User } from '../types/user';

vi.mock('../api/friendApi', () => ({
  getNearbyUsers: vi.fn().mockResolvedValue({ users: [] }),
  getFriendRequests: vi.fn().mockResolvedValue({ incoming: [], outgoing: [], blocked: [] }),
}));

vi.mock('../api/chatApi', () => ({
  getConversations: vi.fn().mockResolvedValue({ conversations: [] }),
}));

const fakeUser = { id: '1', username: 'alice', displayName: 'Alice' } as unknown as User;

function renderPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('DashboardPage', () => {
  beforeEach(() => {
    useAuthStore.getState().setAuth(fakeUser, 'token');
  });

  afterEach(() => {
    cleanup();
  });

  it('greets the signed-in user by display name', () => {
    renderPage();
    expect(screen.getByText('Hello, Alice!')).toBeInTheDocument();
  });

  it('renders quick action buttons and dashboard sections', () => {
    renderPage();
    expect(screen.getByText('📍 Discover Nearby')).toBeInTheDocument();
    expect(screen.getByText('💬 Open Chat')).toBeInTheDocument();
  });
});
