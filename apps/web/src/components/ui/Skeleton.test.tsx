import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Skeleton, TableSkeleton, PageSkeleton } from './Skeleton';

describe('Skeleton', () => {
  it('renders with base skeleton class', () => {
    render(<Skeleton />);
    expect(document.querySelector('.skeleton')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<Skeleton className="h-8 w-32" />);
    const skeleton = document.querySelector('.skeleton');
    expect(skeleton).toHaveClass('h-8', 'w-32');
  });
});

describe('TableSkeleton', () => {
  it('renders table with headers', () => {
    render(<TableSkeleton />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Created')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('renders default 5 rows', () => {
    const { container } = render(<TableSkeleton />);
    const rows = container.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(5);
  });

  it('renders custom number of rows', () => {
    const { container } = render(<TableSkeleton rows={3} />);
    const rows = container.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(3);
  });
});

describe('PageSkeleton', () => {
  it('renders page skeleton', () => {
    render(<PageSkeleton />);
    const skeletons = document.querySelectorAll('.skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders table skeleton as part of page skeleton', () => {
    render(<PageSkeleton />);
    expect(screen.getByText('Name')).toBeInTheDocument();
  });
});