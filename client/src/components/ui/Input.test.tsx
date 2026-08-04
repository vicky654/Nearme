import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Input } from './Input';

afterEach(() => cleanup());

describe('Input', () => {
  it('associates the label with the input via htmlFor/id', () => {
    render(<Input label="Email" id="email" />);
    const input = screen.getByLabelText('Email');
    expect(input).toBeInTheDocument();
  });

  it('shows an error message when error is provided', () => {
    render(<Input label="Email" id="email" error="Email is required" />);
    expect(screen.getByText('Email is required')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
  });

  it('links the input to its error message via aria-describedby and announces it via role="alert"', () => {
    render(<Input label="Email" id="email" error="Email is required" />);
    const input = screen.getByLabelText('Email');
    const errorMessage = screen.getByRole('alert');

    expect(errorMessage).toHaveTextContent('Email is required');
    expect(errorMessage).toHaveAttribute('id', 'email-error');
    expect(input).toHaveAttribute('aria-describedby', 'email-error');
  });

  it('omits aria-describedby when there is no error', () => {
    render(<Input label="Email" id="email" />);
    expect(screen.getByLabelText('Email')).not.toHaveAttribute('aria-describedby');
  });

  it('toggles password visibility when the show/hide button is clicked', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    render(<Input label="Password" id="password" type="password" />);
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');

    const toggleButton = screen.getByRole('button', { name: 'Show password' });
    await user.click(toggleButton);
    expect(input).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(input).toHaveAttribute('type', 'password');
  });
});
