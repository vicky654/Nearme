import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LoginPage from './LoginPage';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { useToastStore } from '../../store/toastStore';
import type { User } from '../../types/user';

vi.mock('../../api/authApi', () => ({
  loginUser: vi.fn(),
  googleLogin: vi.fn(),
}));

import { loginUser } from '../../api/authApi';

function renderLoginPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().clearAuth();
  });

  afterEach(cleanup);

  it('shows a validation error when submitting an empty form', async () => {
    renderLoginPage();
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByText('Enter a valid email')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveFocus();
  });

  it('logs in and stores the user and access token on success', async () => {
    const fakeUser = {
      id: '1',
      username: 'alice',
      displayName: 'Alice',
      theme: 'dark',
    } as unknown as User;
    vi.mocked(loginUser).mockResolvedValue({ user: fakeUser, accessToken: 'token-abc' });

    renderLoginPage();
    await userEvent.type(screen.getByLabelText('Email'), 'alice@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'supersecret123');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    await waitFor(() => expect(useAuthStore.getState().accessToken).toBe('token-abc'));
    expect(useAuthStore.getState().user).toEqual(fakeUser);
    expect(useThemeStore.getState().theme).toBe('dark');
  });

  it('shows a friendly message for incorrect credentials', async () => {
    vi.mocked(loginUser).mockRejectedValue({
      isAxiosError: true,
      response: { status: 401, data: { error: 'Invalid email or password' } },
    });
    renderLoginPage();
    await userEvent.type(screen.getByLabelText('Email'), 'alice@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong-password');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    await waitFor(() => expect(useToastStore.getState().toasts.some((item) => item.message === 'The email or password you entered is incorrect.')).toBe(true));
  });
});
