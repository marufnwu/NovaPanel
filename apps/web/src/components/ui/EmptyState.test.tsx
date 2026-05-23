import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders title', () => {
    render(<EmptyState title="No items found" />);
    expect(screen.getByText('No items found')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(
      <EmptyState
        title="No items"
        description="Create your first item to get started"
      />
    );
    expect(screen.getByText('Create your first item to get started')).toBeInTheDocument();
  });

  it('renders icon when provided', () => {
    render(
      <EmptyState
        icon="icon-folder"
        title="Empty folder"
      />
    );
    expect(screen.getByTestId('icon-icon-folder')).toBeInTheDocument();
  });

  it('does not render icon when not provided', () => {
    render(<EmptyState title="No icon" />);
    expect(document.querySelector('[data-testid^="icon-"]')).toBeNull();
  });

  it('renders action button when provided', () => {
    const handleClick = vi.fn();
    render(
      <EmptyState
        title="No items"
        action={{ label: 'Create Item', onClick: handleClick }}
      />
    );
    const button = screen.getByRole('button', { name: 'Create Item' });
    expect(button).toBeInTheDocument();
    button.click();
    expect(handleClick).toHaveBeenCalled();
  });

  it('does not render action when not provided', () => {
    render(<EmptyState title="No action" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('applies custom className via icon', () => {
    render(
      <EmptyState
        icon="icon-info"
        title="Info"
      />
    );
    expect(screen.getByTestId('icon-icon-info')).toHaveClass('mb-3');
  });
});