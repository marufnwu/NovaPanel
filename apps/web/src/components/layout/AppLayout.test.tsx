import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { AppLayout } from './AppLayout';

vi.mock('@/components/icons', () => ({
  Icon: ({ name }: { name: string }) => <span data-icon={name}>{name}</span>,
}));

vi.mock('@/components/layout/Sidebar', () => ({
  Sidebar: () => <aside data-testid="sidebar">sidebar</aside>,
}));

vi.mock('@/components/layout/Topbar', () => ({
  Topbar: () => <header data-testid="topbar">topbar</header>,
}));

vi.mock('@/components/layout/StatusBar', () => ({
  StatusBar: () => <div data-testid="status-bar">status-bar</div>,
}));

vi.mock('@/components/layout/Breadcrumb', () => ({
  Breadcrumb: () => <nav data-testid="breadcrumb">breadcrumb</nav>,
}));

vi.mock('@tanstack/react-router', () => ({
  Outlet: () => <div data-testid="outlet">Content</div>,
}));

describe('AppLayout', () => {
  it('renders without crashing', () => {
    const { container } = render(<AppLayout />);
    expect(container).toBeTruthy();
  });

  it('has h-screen class', () => {
    const { container } = render(<AppLayout />);
    const div = container.querySelector('.h-screen');
    expect(div).toBeInTheDocument();
  });

  it('has flex class', () => {
    const { container } = render(<AppLayout />);
    const div = container.querySelector('.flex');
    expect(div).toBeInTheDocument();
  });

  it('has overflow-hidden class', () => {
    const { container } = render(<AppLayout />);
    const div = container.querySelector('.overflow-hidden');
    expect(div).toBeInTheDocument();
  });

  it('renders Sidebar as aside element', () => {
    const { container } = render(<AppLayout />);
    const aside = container.querySelector('aside');
    expect(aside).toBeInTheDocument();
  });

  it('renders header element (Topbar)', () => {
    const { container } = render(<AppLayout />);
    const header = container.querySelector('header');
    expect(header).toBeInTheDocument();
  });

  it('renders main element', () => {
    const { container } = render(<AppLayout />);
    const main = container.querySelector('main');
    expect(main).toBeInTheDocument();
  });

  it('renders Outlet content', () => {
    const { getByTestId } = render(<AppLayout />);
    expect(getByTestId('outlet')).toBeInTheDocument();
  });
});