import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card } from './Card';

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText('Card content')).toBeInTheDocument();
  });

  it('renders with title', () => {
    render(<Card title="Card Title">Content</Card>);
    expect(screen.getByText('Card Title')).toBeInTheDocument();
  });

  it('renders with action', () => {
    const action = <button>Action</button>;
    render(<Card title="Title" action={action}>Content</Card>);
    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument();
  });

  it('renders without title or action', () => {
    const { container } = render(<Card>Content only</Card>);
    expect(container.querySelector('.flex.items-center.justify-between')).toBeNull();
  });

  it('applies custom className', () => {
    render(<Card className="custom-class">Content</Card>);
    expect(screen.getByText('Content').closest('.bg-background-primary')).toHaveClass('custom-class');
  });

  it('renders with title and action together', () => {
    const action = <button>Edit</button>;
    render(
      <Card title="My Card" action={action}>
        <p>Body content</p>
      </Card>
    );
    expect(screen.getByText('My Card')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByText('Body content')).toBeInTheDocument();
  });
});