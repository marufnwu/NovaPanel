import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Topbar } from './Topbar';

vi.mock('@/components/icons', () => ({
  Icon: ({ name }: { name: string }) => <span data-icon={name}>{name}</span>,
}));

vi.mock('@/components/layout/Breadcrumb', () => ({
  Breadcrumb: () => <nav data-testid="breadcrumb">breadcrumb</nav>,
}));

vi.mock('@tanstack/react-router', () => ({
  useLocation: () => ({ pathname: '/' }),
}));

describe('Topbar', () => {
  it('renders without crashing', () => {
    const { container } = render(<Topbar />);
    expect(container).toBeTruthy();
  });

  it('renders header element', () => {
    const { container } = render(<Topbar />);
    expect(container.querySelector('header')).toBeInTheDocument();
  });

  it('renders Breadcrumb', () => {
    render(<Topbar />);
    expect(screen.getByTestId('breadcrumb')).toBeInTheDocument();
  });

  it('renders search button with aria-label', () => {
    render(<Topbar />);
    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument();
  });

  it('renders notifications button with aria-label', () => {
    render(<Topbar />);
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
  });

  it('renders user menu button with aria-label', () => {
    render(<Topbar />);
    expect(screen.getByRole('button', { name: 'User menu' })).toBeInTheDocument();
  });

  it('renders three action buttons', () => {
    render(<Topbar />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBe(3);
  });
});