import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import DashboardPage from './DashboardPage';
import { useAuthStore } from '../store/authStore';
import type { User } from '../types/user';

const fakeUser = { id: '1', username: 'alice', displayName: 'Alice' } as unknown as User;

describe('DashboardPage', () => {
  beforeEach(() => {
    useAuthStore.getState().setAuth(fakeUser, 'token');
  });

  afterEach(() => {
    cleanup();
  });

  it('greets the signed-in user by display name', () => {
    render(<DashboardPage />);
    expect(screen.getByText('Welcome back, Alice!')).toBeInTheDocument();
  });

  it('shows a placeholder empty state for upcoming features', () => {
    render(<DashboardPage />);
    expect(screen.getByText('More is on the way')).toBeInTheDocument();
  });
});
