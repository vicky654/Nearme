import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ComponentType } from 'react';

function renderWithProviders(Component: ComponentType) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('GoogleButton', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    delete (window as unknown as { google?: unknown }).google;
    document.getElementById('google-identity-script')?.remove();
  });

  it('renders a disabled button with an explanatory tooltip when no client ID is configured', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '');
    vi.resetModules();
    const { GoogleButton } = await import('./GoogleButton');

    renderWithProviders(GoogleButton);

    const button = screen.getByRole('button', { name: 'Continue with Google' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('title', 'Google login is not configured yet');
  });

  it('initializes and renders the real Google button when a client ID is configured', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client-id.apps.googleusercontent.com');
    const initialize = vi.fn();
    const renderButton = vi.fn();
    (window as unknown as { google: unknown }).google = { accounts: { id: { initialize, renderButton } } };
    vi.resetModules();
    const { GoogleButton } = await import('./GoogleButton');

    renderWithProviders(GoogleButton);

    expect(initialize).toHaveBeenCalledWith(
      expect.objectContaining({ client_id: 'test-client-id.apps.googleusercontent.com' })
    );
    expect(renderButton).toHaveBeenCalled();
  });

  it('waits for the GSI script to finish loading before initializing, when window.google is not yet available', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client-id.apps.googleusercontent.com');

    const script = document.createElement('script');
    script.id = 'google-identity-script';
    document.head.appendChild(script);

    const initialize = vi.fn();
    const renderButton = vi.fn();

    vi.resetModules();
    const { GoogleButton } = await import('./GoogleButton');

    renderWithProviders(GoogleButton);

    expect(initialize).not.toHaveBeenCalled();
    expect(renderButton).not.toHaveBeenCalled();

    (window as unknown as { google: unknown }).google = { accounts: { id: { initialize, renderButton } } };
    script.dispatchEvent(new Event('load'));

    expect(initialize).toHaveBeenCalledWith(
      expect.objectContaining({ client_id: 'test-client-id.apps.googleusercontent.com' })
    );
    expect(renderButton).toHaveBeenCalled();
  });
});
