import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RegisterPage from './RegisterPage';
import type { User } from '../../types/user';

vi.mock('../../api/authApi', () => ({
  registerUser: vi.fn(),
  googleLogin: vi.fn(),
}));

import { registerUser } from '../../api/authApi';

function renderRegisterPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(cleanup);

  it('shows a validation error for a too-short password', async () => {
    renderRegisterPage();
    await userEvent.type(screen.getByLabelText('Password'), 'short');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('At least 8 characters')).toBeInTheDocument();
  });

  it('submits registration with the entered values', async () => {
    const fakeUser = { id: '1', username: 'bob', displayName: 'Bob' } as unknown as User;
    vi.mocked(registerUser).mockResolvedValue({ user: fakeUser });

    renderRegisterPage();
    await userEvent.type(screen.getByLabelText('Username'), 'bob');
    await userEvent.type(screen.getByLabelText('Display name'), 'Bob');
    await userEvent.type(screen.getByLabelText('Email'), 'bob@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'supersecret123');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => expect(registerUser).toHaveBeenCalled());
    expect(vi.mocked(registerUser).mock.calls[0]?.[0]).toEqual({
      username: 'bob',
      displayName: 'Bob',
      email: 'bob@example.com',
      password: 'supersecret123',
    });
  });
});
