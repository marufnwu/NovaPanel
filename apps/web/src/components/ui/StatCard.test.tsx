import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatCard } from './StatCard';

describe('StatCard', () => {
  it('renders label and value', () => {
    render(<StatCard label="CPU Usage" value="45" />);
    expect(screen.getByText('CPU Usage')).toBeInTheDocument();
    expect(screen.getByText('45')).toBeInTheDocument();
  });

  it('renders with number value', () => {
    render(<StatCard label="Memory" value={75} />);
    expect(screen.getByText('75')).toBeInTheDocument();
  });

  it('renders with sub text', () => {
    render(<StatCard label="Disk" value="50%" sub="of 500GB" />);
    expect(screen.getByText('Disk')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('of 500GB')).toBeInTheDocument();
  });

  it('applies danger color for values >= 90', () => {
    render(<StatCard label="High" value={95} />);
    expect(screen.getByText('95')).toHaveClass('text-foreground-danger');
  });

  it('applies warning color for values >= 70', () => {
    render(<StatCard label="Medium" value={75} />);
    expect(screen.getByText('75')).toHaveClass('text-foreground-warning');
  });

  it('applies primary color for values < 70', () => {
    render(<StatCard label="Low" value={50} />);
    expect(screen.getByText('50')).toHaveClass('text-foreground-primary');
  });

  it('does not apply color for string values', () => {
    render(<StatCard label="Status" value="Running" />);
    expect(screen.getByText('Running')).not.toHaveClass(/text-foreground-/);
  });

  it('applies custom className', () => {
    render(<StatCard label="Custom" value="10" className="custom-class" />);
    expect(screen.getByText('10').closest('.bg-background-secondary')).toHaveClass('custom-class');
  });

  it('handles numeric string value for color threshold', () => {
    render(<StatCard label="String" value={92} />);
    expect(screen.getByText('92')).toHaveClass('text-foreground-danger');
  });
});