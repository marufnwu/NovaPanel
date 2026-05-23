import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Tabs } from './Tabs';

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  useSearch: () => ({}),
  useLocation: () => ({ pathname: '/sites/site-1', search: '' }),
}));

describe('Tabs', () => {
  const tabs = [
    { id: 'general', label: 'General' },
    { id: 'advanced', label: 'Advanced' },
    { id: 'domains', label: 'Domains' },
  ];

  it('renders all tabs', () => {
    render(<Tabs tabs={tabs} />);
    expect(screen.getByText('General')).toBeInTheDocument();
    expect(screen.getByText('Advanced')).toBeInTheDocument();
    expect(screen.getByText('Domains')).toBeInTheDocument();
  });

  it('shows active indicator on first tab by default', () => {
    render(<Tabs tabs={tabs} />);
    const generalTab = screen.getByText('General').closest('button');
    expect(generalTab?.querySelector('span[class*="bottom-0"]')).toBeInTheDocument();
  });

  it('handles tab click', async () => {
    render(<Tabs tabs={tabs} />);
    await screen.getByText('Advanced').click();
  });

  it('applies active styling to selected tab', () => {
    render(<Tabs tabs={tabs} />);
    const tabs_list = screen.getAllByRole('button');
    expect(tabs_list[0]).toHaveClass('text-foreground-primary', 'font-medium');
    expect(tabs_list[1]).toHaveClass('text-foreground-secondary');
  });

  it('applies custom className', () => {
    render(<Tabs tabs={tabs} className="custom-tabs" />);
    expect(screen.getByText('General').closest('.border-b')).toHaveClass('custom-tabs');
  });

  it('renders single tab', () => {
    render(<Tabs tabs={[{ id: 'only', label: 'Only Tab' }]} />);
    expect(screen.getByText('Only Tab')).toBeInTheDocument();
  });

  it('renders empty tabs array', () => {
    render(<Tabs tabs={[]} />);
    expect(document.querySelector('nav')).toBeInTheDocument();
  });
});