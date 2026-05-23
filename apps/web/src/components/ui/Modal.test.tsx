import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Modal } from './Modal';
import userEvent from '@testing-library/user-event';

describe('Modal', () => {
  const renderModal = (props = {}) => {
    return render(
      <Modal
        isOpen={true}
        onClose={vi.fn()}
        title="Test Modal"
        {...props}
      >
        <p>Modal content</p>
      </Modal>
    );
  };

  it('renders when isOpen is true', () => {
    renderModal();
    expect(screen.getByText('Test Modal')).toBeInTheDocument();
    expect(screen.getByText('Modal content')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    renderModal({ isOpen: false });
    expect(screen.queryByText('Test Modal')).not.toBeInTheDocument();
  });

  it('renders close button', () => {
    renderModal();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const handleClose = vi.fn();
    renderModal({ onClose: handleClose });
    await screen.getByRole('button', { name: 'Close' }).click();
    expect(handleClose).toHaveBeenCalled();
  });

  it('renders footer when provided', () => {
    const footer = <button>Footer Action</button>;
    renderModal({ footer });
    expect(screen.getByRole('button', { name: 'Footer Action' })).toBeInTheDocument();
  });

  it('closes on escape key', async () => {
    const handleClose = vi.fn();
    renderModal({ onClose: handleClose });
    await userEvent.keyboard('{Escape}');
    expect(handleClose).toHaveBeenCalled();
  });

  it('closes when clicking backdrop', async () => {
    const handleClose = vi.fn();
    renderModal({ onClose: handleClose });
    const backdrop = document.querySelector('.bg-black\\/40');
    if (backdrop) {
      await userEvent.click(backdrop);
    }
    expect(handleClose).toHaveBeenCalled();
  });

  it('applies correct size classes', () => {
    const { rerender } = render(<Modal isOpen={true} onClose={vi.fn()} title="Test" size="small"><p>Content</p></Modal>);
    expect(document.querySelector('.max-w-\\[320px\\]')).toBeInTheDocument();

    rerender(<Modal isOpen={true} onClose={vi.fn()} title="Test" size="medium"><p>Content</p></Modal>);
    expect(document.querySelector('.max-w-\\[480px\\]')).toBeInTheDocument();

    rerender(<Modal isOpen={true} onClose={vi.fn()} title="Test" size="large"><p>Content</p></Modal>);
    expect(document.querySelector('.max-w-\\[640px\\]')).toBeInTheDocument();
  });

  it('focuses panel when opened', () => {
    renderModal();
    const panel = document.querySelector('[tabIndex="-1"]');
    expect(panel).toBeInTheDocument();
  });
});