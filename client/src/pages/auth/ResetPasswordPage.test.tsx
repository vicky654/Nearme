import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ResetPasswordPage from './ResetPasswordPage';

vi.mock('../../api/authApi', () => ({
  resetPassword: vi.fn(),
}));

import { resetPassword } from '../../api/authApi';

function renderPage(initialEntry: string) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <ResetPasswordPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('ResetPasswordPage', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it('shows a mismatch error when passwords do not match', async () => {
    renderPage('/reset-password?token=abc123');
    await userEvent.type(screen.getByLabelText('New password'), 'password-one');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'password-two');
    await userEvent.click(screen.getByRole('button', { name: 'Reset password' }));
    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();
  });

  it('submits the token from the URL with the new password', async () => {
    vi.mocked(resetPassword).mockResolvedValue({ message: 'Password reset successfully' });

    renderPage('/reset-password?token=abc123');
    await userEvent.type(screen.getByLabelText('New password'), 'brand-new-pass');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'brand-new-pass');
    await userEvent.click(screen.getByRole('button', { name: 'Reset password' }));

    expect(resetPassword).toHaveBeenCalled();
    expect(vi.mocked(resetPassword).mock.calls[0]?.[0]).toEqual({
      token: 'abc123',
      password: 'brand-new-pass',
    });
  });
});
