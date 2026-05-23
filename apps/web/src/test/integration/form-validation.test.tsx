import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Input } from '@/components/ui/Input';

describe('Form Validation Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

describe('Input Validation', () => {
    it('displays error message when error prop is set on Input', () => {
      const { container } = render(
        <Input
          label="Username"
          value=""
          onChange={() => {}}
          error="This field is required"
        />
      );

      const errorSpan = container.querySelector('span');
      expect(errorSpan).toBeInTheDocument();
      expect(errorSpan?.textContent).toBe('This field is required');
      expect(errorSpan?.className).toContain('text-foreground-danger');
    });

    it('Input does not show error when error prop is empty', () => {
      const { container } = render(
        <Input
          label="Username"
          value=""
          onChange={() => {}}
        />
      );

      const errorSpan = container.querySelector('span');
      expect(errorSpan).not.toBeInTheDocument();
    });

    it('accepts valid username format', async () => {
      const user = userEvent.setup();
      const handleSubmit = vi.fn();

      const TestForm = () => {
        const [value, setValue] = React.useState('');

        const onSubmit = (e: React.FormEvent) => {
          e.preventDefault();
          if (!/^[a-zA-Z0-9_]{3,}$/.test(value)) return;
          handleSubmit({ value });
        };

        return (
          <form onSubmit={onSubmit} data-testid="test-form">
            <Input
              label="Username"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
            />
            <button type="submit">Submit</button>
          </form>
        );
      };

      render(<TestForm />);
      await user.type(screen.getByLabelText('Username'), 'admin123');

      const form = screen.getByTestId('test-form');
      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      Object.defineProperty(submitEvent, 'target', { value: form });

      form.dispatchEvent(submitEvent);

      await waitFor(() => {
        expect(handleSubmit).toHaveBeenCalledWith({ value: 'admin123' });
      });
    });

    it('rejects username shorter than 3 characters', async () => {
      const user = userEvent.setup();
      const handleSubmit = vi.fn();

      const TestForm = () => {
        const [error, setError] = React.useState('');
        const [value, setValue] = React.useState('');

        const onSubmit = (e: React.FormEvent) => {
          e.preventDefault();
          if (value.length < 3) {
            setError('Username must be at least 3 characters');
            return;
          }
          setError('');
          handleSubmit({ value });
        };

        return (
          <form onSubmit={onSubmit} data-testid="test-form">
            <Input
              label="Username"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              error={error}
              required
            />
            <button type="submit">Submit</button>
          </form>
        );
      };

      render(<TestForm />);
      await user.type(screen.getByLabelText('Username'), 'ab');

      const form = screen.getByTestId('test-form');
      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      Object.defineProperty(submitEvent, 'target', { value: form });

      form.dispatchEvent(submitEvent);

      await waitFor(() => {
        const errorSpan = document.querySelector('span.text-foreground-danger');
        expect(errorSpan).toBeInTheDocument();
        expect(errorSpan?.textContent).toBe('Username must be at least 3 characters');
      });
      expect(handleSubmit).not.toHaveBeenCalled();
    });

    it('validates email format', async () => {
      const user = userEvent.setup();
      const handleSubmit = vi.fn();

      const TestForm = () => {
        const [error, setError] = React.useState('');
        const [value, setValue] = React.useState('');

        const onSubmit = (e: React.FormEvent) => {
          e.preventDefault();
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            setError('Invalid email address');
            return;
          }
          setError('');
          handleSubmit({ value });
        };

        return (
          <form onSubmit={onSubmit} data-testid="test-form">
            <Input
              label="Email"
              type="email"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              error={error}
              required
            />
            <button type="submit">Submit</button>
          </form>
        );
      };

      render(<TestForm />);
      await user.type(screen.getByLabelText('Email'), 'not-an-email');

      const form = screen.getByTestId('test-form');
      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      Object.defineProperty(submitEvent, 'target', { value: form });

      form.dispatchEvent(submitEvent);

      await waitFor(() => {
        const errorSpan = document.querySelector('span.text-foreground-danger');
        expect(errorSpan).toBeInTheDocument();
        expect(errorSpan?.textContent).toBe('Invalid email address');
      });
      expect(handleSubmit).not.toHaveBeenCalled();
    });

    it('accepts valid email format', async () => {
      const user = userEvent.setup();
      const handleSubmit = vi.fn();

      const TestForm = () => {
        const [value, setValue] = React.useState('');

        const onSubmit = (e: React.FormEvent) => {
          e.preventDefault();
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) return;
          handleSubmit({ value });
        };

        return (
          <form onSubmit={onSubmit} data-testid="test-form">
            <Input
              label="Email"
              type="email"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
            />
            <button type="submit">Submit</button>
          </form>
        );
      };

      render(<TestForm />);
      await user.type(screen.getByLabelText('Email'), 'admin@example.com');

      const form = screen.getByTestId('test-form');
      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      Object.defineProperty(submitEvent, 'target', { value: form });

      form.dispatchEvent(submitEvent);

      await waitFor(() => {
        expect(handleSubmit).toHaveBeenCalledWith({ value: 'admin@example.com' });
      });
    });

    it('validates password minimum length', async () => {
      const user = userEvent.setup();
      const handleSubmit = vi.fn();

      const TestForm = () => {
        const [error, setError] = React.useState('');
        const [value, setValue] = React.useState('');

        const onSubmit = (e: React.FormEvent) => {
          e.preventDefault();
          if (value.length < 8) {
            setError('Password must be at least 8 characters');
            return;
          }
          setError('');
          handleSubmit({ value });
        };

        return (
          <form onSubmit={onSubmit} data-testid="test-form">
            <Input
              label="Password"
              type="password"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              error={error}
              required
            />
            <button type="submit">Submit</button>
          </form>
        );
      };

      render(<TestForm />);
      await user.type(screen.getByLabelText('Password'), 'short');

      const form = screen.getByTestId('test-form');
      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      Object.defineProperty(submitEvent, 'target', { value: form });

      form.dispatchEvent(submitEvent);

      await waitFor(() => {
        const errorSpan = document.querySelector('span.text-foreground-danger');
        expect(errorSpan).toBeInTheDocument();
        expect(errorSpan?.textContent).toBe('Password must be at least 8 characters');
      });
      expect(handleSubmit).not.toHaveBeenCalled();
    });

    it('accepts password >= 8 characters', async () => {
      const user = userEvent.setup();
      const handleSubmit = vi.fn();

      const TestForm = () => {
        const [value, setValue] = React.useState('');

        const onSubmit = (e: React.FormEvent) => {
          e.preventDefault();
          if (value.length < 8) return;
          handleSubmit({ value });
        };

        return (
          <form onSubmit={onSubmit} data-testid="test-form">
            <Input
              label="Password"
              type="password"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
            />
            <button type="submit">Submit</button>
          </form>
        );
      };

      render(<TestForm />);
      await user.type(screen.getByLabelText('Password'), 'securepassword123');

      const form = screen.getByTestId('test-form');
      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      Object.defineProperty(submitEvent, 'target', { value: form });

      form.dispatchEvent(submitEvent);

      await waitFor(() => {
        expect(handleSubmit).toHaveBeenCalled();
      });
    });
  });

  describe('Port Number Validation', () => {
    it('rejects port below 1', () => {
      const isValidPort = (port: number) => port >= 1 && port <= 65535;
      expect(isValidPort(0)).toBe(false);
      expect(isValidPort(-1)).toBe(false);
    });

    it('rejects port above 65535', () => {
      const isValidPort = (port: number) => port >= 1 && port <= 65535;
      expect(isValidPort(65536)).toBe(false);
      expect(isValidPort(70000)).toBe(false);
    });

    it('accepts valid port numbers', () => {
      const isValidPort = (port: number) => port >= 1 && port <= 65535;
      expect(isValidPort(80)).toBe(true);
      expect(isValidPort(443)).toBe(true);
      expect(isValidPort(8080)).toBe(true);
      expect(isValidPort(22)).toBe(true);
      expect(isValidPort(1)).toBe(true);
      expect(isValidPort(65535)).toBe(true);
    });
  });

  describe('Domain Name Validation', () => {
    it('rejects invalid domain names', () => {
      const isValidDomain = (domain: string) => {
        const regex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
        return regex.test(domain);
      };
      expect(isValidDomain('invalid')).toBe(false);
      expect(isValidDomain(' spaces.com')).toBe(false);
      expect(isValidDomain('has spaces.com')).toBe(false);
      expect(isValidDomain('-start.com')).toBe(false);
    });

    it('accepts valid domain names', () => {
      const isValidDomain = (domain: string) => {
        const regex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
        return regex.test(domain);
      };
      expect(isValidDomain('example.com')).toBe(true);
      expect(isValidDomain('sub.example.com')).toBe(true);
      expect(isValidDomain('my-site.io')).toBe(true);
    });
  });

  describe('URL Validation', () => {
    it('rejects malformed URLs', () => {
      const isValidUrl = (url: string) => {
        try {
          new URL(url);
          return false;
        } catch {
          return true;
        }
      };
      expect(isValidUrl('not-a-url')).toBe(true);
      expect(isValidUrl('')).toBe(true);
    });

    it('accepts valid URLs', () => {
      const isValidUrl = (url: string) => {
        try {
          new URL(url);
          return true;
        } catch {
          return false;
        }
      };
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('http://localhost:8080')).toBe(true);
      expect(isValidUrl('https://sub.domain.com/path')).toBe(true);
    });

    it('rejects javascript: protocol', () => {
      const isValidHttpUrl = (url: string) => {
        try {
          const parsed = new URL(url);
          return parsed.protocol === 'https:' || parsed.protocol === 'http:';
        } catch {
          return false;
        }
      };
      expect(isValidHttpUrl('javascript:alert(1)')).toBe(false);
      expect(isValidHttpUrl('ftp://files.com')).toBe(false);
      expect(isValidHttpUrl('htp://invalid')).toBe(false);
      expect(isValidHttpUrl('https://example.com')).toBe(true);
    });
  });

  describe('Form Submit Behavior', () => {
    it('prevents submission when form is invalid', async () => {
      const user = userEvent.setup();
      const handleSubmit = vi.fn();

      const TestForm = () => {
        const [value, setValue] = React.useState('');

        const onSubmit = (e: React.FormEvent) => {
          e.preventDefault();
          if (!value.trim()) return;
          handleSubmit({ value });
        };

        return (
          <form onSubmit={onSubmit} data-testid="test-form">
            <Input
              label="Required Field"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
            />
            <button type="submit">Submit</button>
          </form>
        );
      };

      render(<TestForm />);
      await user.click(screen.getByRole('button', { name: 'Submit' }));
      expect(handleSubmit).not.toHaveBeenCalled();
    });

    it('calls submit handler when form is valid', async () => {
      const user = userEvent.setup();
      const handleSubmit = vi.fn();

      const TestForm = () => {
        const [value, setValue] = React.useState('valid input');

        const onSubmit = (e: React.FormEvent) => {
          e.preventDefault();
          if (!value.trim()) return;
          handleSubmit({ value });
        };

        return (
          <form onSubmit={onSubmit} data-testid="test-form">
            <Input
              label="Required Field"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
            />
            <button type="submit">Submit</button>
          </form>
        );
      };

      render(<TestForm />);
      await user.click(screen.getByRole('button', { name: 'Submit' }));
      expect(handleSubmit).toHaveBeenCalledWith({ value: 'valid input' });
    });

    it('clears error on valid input change', async () => {
      const user = userEvent.setup();

      const TestForm = () => {
        const [error, setError] = React.useState('This field is required');
        const [value, setValue] = React.useState('');

        const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
          setValue(e.target.value);
          if (e.target.value.trim()) setError('');
        };

        return (
          <div>
            <Input
              label="Username"
              value={value}
              onChange={onChange}
              error={error}
              required
            />
          </div>
        );
      };

      render(<TestForm />);
      expect(screen.getByText('This field is required')).toBeInTheDocument();

      await user.type(screen.getByLabelText('Username'), 'a');
      expect(screen.queryByText('This field is required')).not.toBeInTheDocument();
    });
  });

  describe('Form validation via Input error prop', () => {
    it('displays error message when error prop is set', () => {
      const { container } = render(
        <Input
          label="Username"
          value=""
          onChange={() => {}}
          error="This field is required"
        />
      );

      const errorSpan = container.querySelector('span');
      expect(errorSpan).toBeInTheDocument();
      expect(errorSpan?.textContent).toBe('This field is required');
      expect(errorSpan?.className).toContain('text-foreground-danger');
    });

    it('applies danger border styling when error is present', () => {
      const { container } = render(
        <Input
          label="Email"
          type="email"
          value="invalid"
          onChange={() => {}}
          error="Invalid email"
        />
      );

      const input = container.querySelector('input');
      expect(input?.className).toContain('border-foreground-danger');
    });

    it('shows required field error', () => {
      const { container } = render(
        <Input
          label="Password"
          type="password"
          value=""
          onChange={() => {}}
          error="Password is required"
          required
        />
      );

      const errorSpan = container.querySelector('span');
      expect(errorSpan).toBeInTheDocument();
      expect(errorSpan?.textContent).toBe('Password is required');
    });
  });
});