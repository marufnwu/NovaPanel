import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Breadcrumb } from './Breadcrumb';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a>,
  useLocation: () => ({ pathname: '/' }),
}));

describe('Breadcrumb', () => {
  it('renders without crashing', () => {
    const { container } = render(<Breadcrumb />);
    expect(container).toBeTruthy();
  });

  it('renders Dashboard for root path', () => {
    const { container } = render(<Breadcrumb />);
    expect(container.innerHTML).toContain('Dashboard');
  });

  it('renders span element for current path', () => {
    const { container } = render(<Breadcrumb />);
    expect(container.querySelector('span')).toBeInTheDocument();
  });
});