import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConfirmDialog } from './ConfirmDialog';
import userEvent from '@testing-library/user-event';

describe('ConfirmDialog', () => {
  const renderConfirmDialog = (props = {}) => {
    return render(
      <ConfirmDialog
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Delete Item"
        {...props}
      />
    );
  };

  it('renders when isOpen is true', () => {
    renderConfirmDialog();
    expect(screen.getByText('Delete Item')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    renderConfirmDialog({ isOpen: false });
    expect(screen.queryByText('Delete Item')).not.toBeInTheDocument();
  });

  it('renders description when provided', () => {
    renderConfirmDialog({ description: 'Are you sure you want to delete this item?' });
    expect(screen.getByText('Are you sure you want to delete this item?')).toBeInTheDocument();
  });

  it('renders default confirm and cancel buttons', () => {
    renderConfirmDialog();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('calls onClose when cancel is clicked', async () => {
    const handleClose = vi.fn();
    renderConfirmDialog({ onClose: handleClose });
    await screen.getByRole('button', { name: 'Cancel' }).click();
    expect(handleClose).toHaveBeenCalled();
  });

  it('calls onConfirm when confirm is clicked for low impact', async () => {
    const handleConfirm = vi.fn();
    renderConfirmDialog({ onConfirm: handleConfirm, impact: 'low' });
    await screen.getByRole('button', { name: 'Confirm' }).click();
    expect(handleConfirm).toHaveBeenCalled();
  });

  it('calls onConfirm when confirm is clicked for medium impact', async () => {
    const handleConfirm = vi.fn();
    renderConfirmDialog({ onConfirm: handleConfirm, impact: 'medium' });
    await screen.getByRole('button', { name: 'Confirm' }).click();
    expect(handleConfirm).toHaveBeenCalled();
  });

  it('requires DELETE input for high impact', async () => {
    const handleConfirm = vi.fn();
    renderConfirmDialog({ onConfirm: handleConfirm, impact: 'high' });
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();
    await userEvent.type(screen.getByPlaceholderText('DELETE'), 'DELETE');
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeEnabled();
  });

  it('does not call onConfirm when DELETE is wrong for high impact', async () => {
    const handleConfirm = vi.fn();
    renderConfirmDialog({ onConfirm: handleConfirm, impact: 'high' });
    await userEvent.type(screen.getByPlaceholderText('DELETE'), 'WRONG');
    await screen.getByRole('button', { name: 'Confirm' }).click();
    expect(handleConfirm).not.toHaveBeenCalled();
  });

  it('resets input when dialog is reopened', async () => {
    const { rerender } = render(<ConfirmDialog isOpen={true} onClose={vi.fn()} onConfirm={vi.fn()} title="Delete" impact="high" />);
    await userEvent.type(screen.getByPlaceholderText('DELETE'), 'DELETE');
    rerender(<ConfirmDialog isOpen={false} onClose={vi.fn()} onConfirm={vi.fn()} title="Delete" impact="high" />);
    rerender(<ConfirmDialog isOpen={true} onClose={vi.fn()} onConfirm={vi.fn()} title="Delete" impact="high" />);
    expect(screen.getByPlaceholderText('DELETE')).toHaveValue('');
  });

  it('closes on backdrop click', async () => {
    const handleClose = vi.fn();
    renderConfirmDialog({ onClose: handleClose });
    const backdrop = document.querySelector('.bg-black\\/40');
    if (backdrop) {
      await userEvent.click(backdrop);
    }
    expect(handleClose).toHaveBeenCalled();
  });
});