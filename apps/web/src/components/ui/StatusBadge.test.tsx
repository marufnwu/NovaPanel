import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it('renders running status', () => {
    render(<StatusBadge status="running" />);
    expect(screen.getByText('Running')).toBeInTheDocument();
    expect(screen.getByText('Running')).toHaveClass('text-foreground-success');
  });

  it('renders stopped status', () => {
    render(<StatusBadge status="stopped" />);
    expect(screen.getByText('Stopped')).toBeInTheDocument();
    expect(screen.getByText('Stopped')).toHaveClass('text-foreground-danger');
  });

  it('renders pending status', () => {
    render(<StatusBadge status="pending" />);
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('renders deploying status with pulse animation', () => {
    render(<StatusBadge status="deploying" />);
    const badge = screen.getByText('Deploying');
    expect(badge).toBeInTheDocument();
    expect(badge.querySelector('.dot-pulse')).toBeInTheDocument();
  });

  it('renders active status', () => {
    render(<StatusBadge status="active" />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders inactive status', () => {
    render(<StatusBadge status="inactive" />);
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('renders expired status', () => {
    render(<StatusBadge status="expired" />);
    expect(screen.getByText('Expired')).toBeInTheDocument();
  });

  it('renders completed status', () => {
    render(<StatusBadge status="completed" />);
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('renders failed status', () => {
    render(<StatusBadge status="failed" />);
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('renders restoring status', () => {
    render(<StatusBadge status="restoring" />);
    expect(screen.getByText('Restoring')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<StatusBadge status="running" className="custom-class" />);
    expect(screen.getByText('Running')).toHaveClass('custom-class');
  });

  it('defaults to pending for unknown status', () => {
    render(<StatusBadge status="pending" />);
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });
});