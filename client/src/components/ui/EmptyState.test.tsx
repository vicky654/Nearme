import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { EmptyState } from './EmptyState';
import { Button } from './Button';

afterEach(() => cleanup());

describe('EmptyState', () => {
  it('renders the title, optional description, and optional action', () => {
    render(
      <EmptyState
        title="No chats yet"
        description="Start a conversation from Discover"
        action={<Button>Discover people</Button>}
      />
    );

    expect(screen.getByText('No chats yet')).toBeInTheDocument();
    expect(screen.getByText('Start a conversation from Discover')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Discover people' })).toBeInTheDocument();
  });

  it('renders without description or action', () => {
    render(<EmptyState title="Nothing here" />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });
});
