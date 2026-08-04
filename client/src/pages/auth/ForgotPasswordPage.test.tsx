import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ForgotPasswordPage from './ForgotPasswordPage';
import { useToastStore } from '../../store/toastStore';

vi.mock('../../api/authApi', () => ({
  forgotPassword: vi.fn(),
}));

import { forgotPassword } from '../../api/authApi';

function renderPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useToastStore.setState({ toasts: [] });
  });
  afterEach(cleanup);

  it('shows a generic confirmation message after submitting, regardless of whether the account exists', async () => {
    vi.mocked(forgotPassword).mockResolvedValue({
      message: 'If an account exists for that email, a reset link has been sent.',
    });

    renderPage();
    await userEvent.type(screen.getByLabelText('Email'), 'someone@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(
      await screen.findByText(/if an account exists for that email/i)
    ).toBeInTheDocument();
  });

  it('shows a generic error toast when the request itself fails', async () => {
    vi.mocked(forgotPassword).mockRejectedValue(new Error('network error'));

    renderPage();
    await userEvent.type(screen.getByLabelText('Email'), 'someone@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }));

    await vi.waitFor(() => {
      expect(useToastStore.getState().toasts).toEqual([
        expect.objectContaining({ message: 'Something went wrong. Please try again.', type: 'error' }),
      ]);
    });
  });
});
