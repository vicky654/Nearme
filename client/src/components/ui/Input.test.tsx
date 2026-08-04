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
});
