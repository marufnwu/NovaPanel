import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Icon } from './index';

describe('Icon', () => {
  it('renders without crashing', () => {
    const { container } = render(<Icon name="icon-check" />);
    expect(container).toBeTruthy();
  });

  it('renders icon-check without throwing', () => {
    expect(() => render(<Icon name="icon-check" />)).not.toThrow();
  });

  it('renders icon-plus without throwing', () => {
    expect(() => render(<Icon name="icon-plus" />)).not.toThrow();
  });

  it('renders icon-x without throwing', () => {
    expect(() => render(<Icon name="icon-x" />)).not.toThrow();
  });

  it('renders icon-host without throwing', () => {
    expect(() => render(<Icon name="icon-host" />)).not.toThrow();
  });

  it('renders icon-database without throwing', () => {
    expect(() => render(<Icon name="icon-database" />)).not.toThrow();
  });

  it('renders icon-server without throwing', () => {
    expect(() => render(<Icon name="icon-server" />)).not.toThrow();
  });

  it('renders icon-lock without throwing', () => {
    expect(() => render(<Icon name="icon-lock" />)).not.toThrow();
  });

  it('renders icon-bell without throwing', () => {
    expect(() => render(<Icon name="icon-bell" />)).not.toThrow();
  });

  it('renders icon-settings without throwing', () => {
    expect(() => render(<Icon name="icon-settings" />)).not.toThrow();
  });

  it('renders icon-user without throwing', () => {
    expect(() => render(<Icon name="icon-user" />)).not.toThrow();
  });

  it('renders icon-search without throwing', () => {
    expect(() => render(<Icon name="icon-search" />)).not.toThrow();
  });

  it('renders icon-refresh without throwing', () => {
    expect(() => render(<Icon name="icon-refresh" />)).not.toThrow();
  });

  it('renders icon-trash without throwing', () => {
    expect(() => render(<Icon name="icon-trash" />)).not.toThrow();
  });

  it('renders icon-edit without throwing', () => {
    expect(() => render(<Icon name="icon-edit" />)).not.toThrow();
  });

  it('renders icon-plus with size prop', () => {
    expect(() => render(<Icon name="icon-plus" size={24} />)).not.toThrow();
  });

  it('renders icon-check with size prop', () => {
    expect(() => render(<Icon name="icon-check" size={16} />)).not.toThrow();
  });

  it('renders icon-info with className', () => {
    expect(() => render(<Icon name="icon-info" className="test-class" />)).not.toThrow();
  });

  it('renders null for invalid icon name', () => {
    const { container } = render(<Icon name="icon-invalid-foo-bar" as any />);
    expect(container.querySelector('svg')).not.toBeInTheDocument();
  });
});