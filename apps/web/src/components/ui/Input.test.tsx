import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Input } from './Input';
import userEvent from '@testing-library/user-event';

describe('Input', () => {
  it('renders with label', () => {
    render(<Input label="Email Address" />);
    expect(screen.getByLabelText('Email Address')).toBeInTheDocument();
  });

  it('renders without label', () => {
    render(<Input placeholder="Enter text" />);
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
  });

  it('shows error message', () => {
    render(<Input label="Email" error="Invalid email" />);
    expect(screen.getByText('Invalid email')).toBeInTheDocument();
  });

  it('handles input changes', async () => {
    const handleChange = vi.fn();
    const { container } = render(<Input label="Name" onChange={handleChange} />);
    const input = screen.getByLabelText('Name');
    await userEvent.type(input, 'John');
    expect(handleChange).toHaveBeenCalledTimes(4);
  });

  it('forwards ref', () => {
    let ref: HTMLInputElement | null = null;
    render(<Input label="Test" ref={(el) => { ref = el; }} />);
    expect(ref).toBeInstanceOf(HTMLInputElement);
  });

  it('is disabled when disabled prop is set', () => {
    render(<Input label="Disabled" disabled />);
    expect(screen.getByLabelText('Disabled')).toBeDisabled();
  });

  it('applies error styling', () => {
    render(<Input label="Error" error="Error message" />);
    expect(screen.getByLabelText('Error')).toHaveClass('border-foreground-danger');
  });

  it('uses generated id from label', () => {
    render(<Input label="My Label" />);
    expect(screen.getByLabelText('My Label')).toHaveAttribute('id', 'my-label');
  });
});