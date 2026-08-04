import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { VerifyEmailBanner } from './VerifyEmailBanner';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import type { User } from '../../types/user';

vi.mock('../../api/authApi', () => ({
  resendVerification: vi.fn(),
}));

import { resendVerification } from '../../api/authApi';

function renderBanner() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <VerifyEmailBanner />
    </QueryClientProvider>
  );
}

const verifiedUser = {
  id: '1',
  username: 'alice',
  displayName: 'Alice',
  email: 'alice@example.com',
  emailVerifiedAt: '2026-01-01T00:00:00.000Z',
} as unknown as User;

const unverifiedUser = {
  id: '2',
  username: 'bob',
  displayName: 'Bob',
  email: 'bob@example.com',
  emailVerifiedAt: null,
} as unknown as User;

describe('VerifyEmailBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().clearAuth();
    useToastStore.setState({ toasts: [] });
  });

  afterEach(cleanup);

  it('renders nothing when there is no signed-in user', () => {
    renderBanner();
    expect(screen.queryByText('Please verify your email address.')).not.toBeInTheDocument();
  });

  it('renders nothing when the user has already verified their email', () => {
    useAuthStore.getState().setAuth(verifiedUser, 'token');
    renderBanner();
    expect(screen.queryByText('Please verify your email address.')).not.toBeInTheDocument();
  });

  it('renders the banner and resend button when the user is unverified', () => {
    useAuthStore.getState().setAuth(unverifiedUser, 'token');
    renderBanner();
    expect(screen.getByText('Please verify your email address.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resend verification email' })).toBeInTheDocument();
  });

  it('calls resendVerification with the user email and shows a success toast on click', async () => {
    vi.mocked(resendVerification).mockResolvedValue({ message: 'Verification email sent.' });
    useAuthStore.getState().setAuth(unverifiedUser, 'token');
    renderBanner();

    await userEvent.click(screen.getByRole('button', { name: 'Resend verification email' }));

    await waitFor(() => expect(resendVerification).toHaveBeenCalledWith('bob@example.com'));
    await waitFor(() =>
      expect(useToastStore.getState().toasts.some((t) => t.message === 'Verification email sent.')).toBe(
        true
      )
    );
  });

  it('shows an error toast when resendVerification fails', async () => {
    vi.mocked(resendVerification).mockRejectedValue(new Error('network error'));
    useAuthStore.getState().setAuth(unverifiedUser, 'token');
    renderBanner();

    await userEvent.click(screen.getByRole('button', { name: 'Resend verification email' }));

    await waitFor(() =>
      expect(
        useToastStore
          .getState()
          .toasts.some((t) => t.message === 'Unable to resend the verification email. Please try again.')
      ).toBe(true)
    );
  });

  it('dismisses the banner for the session when the dismiss button is clicked', async () => {
    useAuthStore.getState().setAuth(unverifiedUser, 'token');
    renderBanner();

    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText('Please verify your email address.')).not.toBeInTheDocument();
  });
});
