import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import SettingsPage from './SettingsPage';
import { useThemeStore } from '../../store/themeStore';
import { useToastStore } from '../../store/toastStore';

vi.mock('../../api/userApi', () => ({
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
  changePassword: vi.fn(),
}));

import { getSettings, updateSettings, changePassword } from '../../api/userApi';

const fakeSettings = {
  theme: 'system' as const,
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
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSettings).mockResolvedValue(fakeSettings);
  });

  afterEach(cleanup);

  it('switches between tabs', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('tab', { name: 'Password' }));
    expect(screen.getByLabelText('Current password')).toBeInTheDocument();
  });

  it('validates and submits a password change', async () => {
    vi.mocked(changePassword).mockResolvedValue({ message: 'Password updated successfully' });
    renderPage();
    await userEvent.click(screen.getByRole('tab', { name: 'Password' }));

    await userEvent.click(screen.getByRole('button', { name: 'Update password' }));
    expect(await screen.findByText('Current password is required')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Current password'), 'old-pass-123');
    await userEvent.type(screen.getByLabelText('New password'), 'new-pass-456');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'new-pass-456');
    await userEvent.click(screen.getByRole('button', { name: 'Update password' }));

    await waitFor(() =>
      expect(changePassword).toHaveBeenCalledWith({
        currentPassword: 'old-pass-123',
        newPassword: 'new-pass-456',
      })
    );
  });

  it('shows the server-provided error message on a non-401 password-change failure', async () => {
    const axiosLikeError = {
      isAxiosError: true,
      response: { data: { error: 'Too many requests, please try again later.' } },
    } as unknown as AxiosError;
    vi.mocked(changePassword).mockRejectedValue(axiosLikeError);

    renderPage();
    await userEvent.click(screen.getByRole('tab', { name: 'Password' }));
    await userEvent.type(screen.getByLabelText('Current password'), 'old-pass-123');
    await userEvent.type(screen.getByLabelText('New password'), 'new-pass-456');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'new-pass-456');
    await userEvent.click(screen.getByRole('button', { name: 'Update password' }));

    await waitFor(() =>
      expect(useToastStore.getState().toasts.some((t) => t.message === 'Too many requests, please try again later.')).toBe(true)
    );
    expect(
      useToastStore.getState().toasts.some((t) => t.message === 'Current password is incorrect')
    ).toBe(false);
  });

  it('falls back to the generic message when the failure has no server-provided message', async () => {
    vi.mocked(changePassword).mockRejectedValue(new Error('network error'));

    renderPage();
    await userEvent.click(screen.getByRole('tab', { name: 'Password' }));
    await userEvent.type(screen.getByLabelText('Current password'), 'old-pass-123');
    await userEvent.type(screen.getByLabelText('New password'), 'new-pass-456');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'new-pass-456');
    await userEvent.click(screen.getByRole('button', { name: 'Update password' }));

    await waitFor(() =>
      expect(
        useToastStore.getState().toasts.some((t) => t.message === 'Current password is incorrect')
      ).toBe(true)
    );
  });

  it('toggles a privacy setting', async () => {
    vi.mocked(updateSettings).mockResolvedValue({
      ...fakeSettings,
      privacy: { ...fakeSettings.privacy, invisibleMode: true },
    });

    renderPage();
    await userEvent.click(screen.getByRole('tab', { name: 'Privacy' }));
    const invisibleToggle = await screen.findByLabelText('Invisible mode');
    await userEvent.click(invisibleToggle);

    await waitFor(() =>
      expect(updateSettings).toHaveBeenCalledWith({ privacy: { invisibleMode: true } })
    );
  });

  it('shows the optimistic checkbox state immediately, before the mutation resolves', async () => {
    let resolveMutation: (value: typeof fakeSettings) => void = () => {};
    const pending = new Promise<typeof fakeSettings>((resolve) => {
      resolveMutation = resolve;
    });
    vi.mocked(updateSettings).mockReturnValue(pending);

    renderPage();
    await userEvent.click(screen.getByRole('tab', { name: 'Privacy' }));
    const invisibleToggle = (await screen.findByLabelText('Invisible mode')) as HTMLInputElement;
    expect(invisibleToggle.checked).toBe(false);

    await userEvent.click(invisibleToggle);

    // The mocked mutation promise is still pending here — this only passes if the
    // checkbox reflects the optimistic (onMutate) update rather than waiting for onSuccess.
    await waitFor(() => expect(invisibleToggle.checked).toBe(true));
    expect(updateSettings).toHaveBeenCalledWith({ privacy: { invisibleMode: true } });

    resolveMutation({ ...fakeSettings, privacy: { ...fakeSettings.privacy, invisibleMode: true } });
    await waitFor(() => expect(invisibleToggle.checked).toBe(true));
  });

  it('rolls back the checkbox to its previous state when the mutation fails', async () => {
    let rejectMutation: (error: Error) => void = () => {};
    const pending = new Promise<typeof fakeSettings>((_resolve, reject) => {
      rejectMutation = reject;
    });
    vi.mocked(updateSettings).mockReturnValue(pending);

    renderPage();
    await userEvent.click(screen.getByRole('tab', { name: 'Privacy' }));
    const invisibleToggle = (await screen.findByLabelText('Invisible mode')) as HTMLInputElement;
    expect(invisibleToggle.checked).toBe(false);

    await userEvent.click(invisibleToggle);

    // Optimistic update flips it on right away, while the mutation is still pending...
    await waitFor(() => expect(invisibleToggle.checked).toBe(true));

    // ...then rolls back to the pre-click state once the mutation rejects.
    rejectMutation(new Error('network error'));
    await waitFor(() => expect(invisibleToggle.checked).toBe(false));
  });

  it('switches the theme instantly and persists it', async () => {
    vi.mocked(updateSettings).mockResolvedValue({ ...fakeSettings, theme: 'dark' });

    renderPage();
    await userEvent.click(screen.getByRole('tab', { name: 'Theme' }));
    await userEvent.click(screen.getByRole('button', { name: 'dark' }));

    expect(useThemeStore.getState().theme).toBe('dark');
    await waitFor(() => expect(updateSettings).toHaveBeenCalledWith({ theme: 'dark' }));
  });
});
