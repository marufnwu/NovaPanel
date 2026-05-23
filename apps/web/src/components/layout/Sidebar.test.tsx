import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Sidebar } from './Sidebar';

vi.mock('@/components/icons', () => ({
  Icon: ({ name }: { name: string }) => <span data-icon={name}>{name}</span>,
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a>,
  useLocation: () => ({ pathname: '/' }),
}));

describe('Sidebar', () => {
  it('renders without crashing', () => {
    const { container } = render(<Sidebar />);
    expect(container).toBeTruthy();
  });

  it('renders NovaPanel text', () => {
    const { container } = render(<Sidebar />);
    expect(container.innerHTML).toContain('NovaPanel');
  });

  it('renders nav element', () => {
    const { container } = render(<Sidebar />);
    expect(container.querySelector('nav')).toBeInTheDocument();
  });

  it('renders as aside element', () => {
    const { container } = render(<Sidebar />);
    expect(container.querySelector('aside')).toBeInTheDocument();
  });

  it('renders Apps group label', () => {
    const { container } = render(<Sidebar />);
    expect(container.innerHTML).toContain('Apps');
  });

  it('renders Server group label', () => {
    const { container } = render(<Sidebar />);
    expect(container.innerHTML).toContain('Server');
  });

  it('renders Domains group label', () => {
    const { container } = render(<Sidebar />);
    expect(container.innerHTML).toContain('Domains');
  });

  it('renders System group label', () => {
    const { container } = render(<Sidebar />);
    expect(container.innerHTML).toContain('System');
  });

  it('renders Settings group label', () => {
    const { container } = render(<Sidebar />);
    expect(container.innerHTML).toContain('Settings');
  });

  it('renders anchor elements for navigation links', () => {
    const { container } = render(<Sidebar />);
    const links = container.querySelectorAll('a');
    expect(links.length).toBeGreaterThan(5);
  });

  it('renders Sites nav item', () => {
    const { container } = render(<Sidebar />);
    expect(container.innerHTML).toContain('Sites');
  });

  it('renders Databases nav item', () => {
    const { container } = render(<Sidebar />);
    expect(container.innerHTML).toContain('Databases');
  });

  it('renders Cron Jobs nav item', () => {
    const { container } = render(<Sidebar />);
    expect(container.innerHTML).toContain('Cron Jobs');
  });

  it('renders Services nav item', () => {
    const { container } = render(<Sidebar />);
    expect(container.innerHTML).toContain('Services');
  });

  it('renders Firewall nav item', () => {
    const { container } = render(<Sidebar />);
    expect(container.innerHTML).toContain('Firewall');
  });

  it('renders Backups nav item', () => {
    const { container } = render(<Sidebar />);
    expect(container.innerHTML).toContain('Backups');
  });

  it('renders Terminal nav item', () => {
    const { container } = render(<Sidebar />);
    expect(container.innerHTML).toContain('Terminal');
  });

  it('renders Files nav item', () => {
    const { container } = render(<Sidebar />);
    expect(container.innerHTML).toContain('Files');
  });

  it('renders DNS nav item', () => {
    const { container } = render(<Sidebar />);
    expect(container.innerHTML).toContain('DNS');
  });

  it('renders SSL nav item', () => {
    const { container } = render(<Sidebar />);
    expect(container.innerHTML).toContain('SSL');
  });

  it('renders Mail nav item', () => {
    const { container } = render(<Sidebar />);
    expect(container.innerHTML).toContain('Mail');
  });

  it('renders FTP nav item', () => {
    const { container } = render(<Sidebar />);
    expect(container.innerHTML).toContain('FTP');
  });

  it('renders Monitoring nav item', () => {
    const { container } = render(<Sidebar />);
    expect(container.innerHTML).toContain('Monitoring');
  });

  it('renders Logs nav item', () => {
    const { container } = render(<Sidebar />);
    expect(container.innerHTML).toContain('Logs');
  });

  it('renders Containers nav item', () => {
    const { container } = render(<Sidebar />);
    expect(container.innerHTML).toContain('Containers');
  });

  it('renders Jobs nav item', () => {
    const { container } = render(<Sidebar />);
    expect(container.innerHTML).toContain('Jobs');
  });

  it('renders Audit nav item', () => {
    const { container } = render(<Sidebar />);
    expect(container.innerHTML).toContain('Audit');
  });

  it('renders Server Settings nav item', () => {
    const { container } = render(<Sidebar />);
    expect(container.innerHTML).toContain('Server Settings');
  });

  it('renders Security nav item', () => {
    const { container } = render(<Sidebar />);
    expect(container.innerHTML).toContain('Security');
  });

  it('renders Notifications nav item', () => {
    const { container } = render(<Sidebar />);
    expect(container.innerHTML).toContain('Notifications');
  });

  it('renders Webhooks nav item', () => {
    const { container } = render(<Sidebar />);
    expect(container.innerHTML).toContain('Webhooks');
  });

  it('renders API Tokens nav item', () => {
    const { container } = render(<Sidebar />);
    expect(container.innerHTML).toContain('API Tokens');
  });

  it('renders Plugins nav item', () => {
    const { container } = render(<Sidebar />);
    expect(container.innerHTML).toContain('Plugins');
  });

  it('renders Billing nav item', () => {
    const { container } = render(<Sidebar />);
    expect(container.innerHTML).toContain('Billing');
  });

  it('renders Organizations nav item', () => {
    const { container } = render(<Sidebar />);
    expect(container.innerHTML).toContain('Organizations');
  });

  it('renders Profile nav item', () => {
    const { container } = render(<Sidebar />);
    expect(container.innerHTML).toContain('Profile');
  });
});