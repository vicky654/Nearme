import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { Toaster } from './Toaster';
import { useToastStore, toast } from '../../store/toastStore';

describe('Toaster', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    useToastStore.setState({ toasts: [] });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('shows a success toast and auto-dismisses it', async () => {
    render(<Toaster />);
    toast.success('Saved!');

    expect(await screen.findByText('Saved!')).toBeInTheDocument();

    vi.advanceTimersByTime(4100);
    await waitFor(() => expect(screen.queryByText('Saved!')).not.toBeInTheDocument());
  });

  it('shows an error toast', async () => {
    render(<Toaster />);
    toast.error('Something failed');

    expect(await screen.findByText('Something failed')).toBeInTheDocument();
  });
});
