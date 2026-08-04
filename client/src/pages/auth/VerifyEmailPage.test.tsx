import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import VerifyEmailPage from './VerifyEmailPage';

vi.mock('../../api/authApi', () => ({
  verifyEmail: vi.fn(),
}));

import { verifyEmail } from '../../api/authApi';
import type { User } from '../../types/user';

function renderPage(initialEntry: string) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <VerifyEmailPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('VerifyEmailPage', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it('shows a success message once verification completes', async () => {
    vi.mocked(verifyEmail).mockResolvedValue({
      user: { displayName: 'Alice' } as unknown as User,
    });
    renderPage('/verify-email?token=abc123');
    expect(await screen.findByText(/email verified/i)).toBeInTheDocument();
    expect(verifyEmail).toHaveBeenCalledWith('abc123');
  });

  it('shows an error message when verification fails', async () => {
    vi.mocked(verifyEmail).mockRejectedValue(new Error('invalid token'));
    renderPage('/verify-email?token=bad-token');
    expect(await screen.findByText(/invalid or has expired/i)).toBeInTheDocument();
  });
});
