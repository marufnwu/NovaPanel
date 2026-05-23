import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DataTable } from './DataTable';

interface TestItem {
  id: string;
  name: string;
  status: string;
}

describe('DataTable', () => {
  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Name' },
    { key: 'status', label: 'Status' },
  ];

  const data: TestItem[] = [
    { id: '1', name: 'Item 1', status: 'active' },
    { id: '2', name: 'Item 2', status: 'inactive' },
  ];

  it('renders table with data', () => {
    render(<DataTable columns={columns} data={data} />);
    expect(screen.getByText('ID')).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
  });

  it('renders custom column content', () => {
    const columnsWithRender = [
      { key: 'id', label: 'ID' },
      { key: 'name', label: 'Name', render: (row: TestItem) => <span data-testid={`name-${row.id}`}>{row.name}</span> },
    ];
    render(<DataTable columns={columnsWithRender} data={data} />);
    expect(screen.getByTestId('name-1')).toHaveTextContent('Item 1');
    expect(screen.getByTestId('name-2')).toHaveTextContent('Item 2');
  });

  it('shows empty state when no data', () => {
    const emptyState = <div data-testid="empty">No items found</div>;
    render(<DataTable columns={columns} data={[]} emptyState={emptyState} />);
    expect(screen.getByTestId('empty')).toBeInTheDocument();
  });

  it('shows skeleton loading state', () => {
    render(<DataTable columns={columns} data={[]} loading />);
    const skeletons = document.querySelectorAll('.skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('handles row click', async () => {
    const handleClick = vi.fn();
    render(<DataTable columns={columns} data={data} onRowClick={handleClick} />);
    await screen.getByText('Item 1').click();
    expect(handleClick).toHaveBeenCalledWith(data[0]);
  });

  it('uses rowKey for row keys', () => {
    const columnsWithKey = [
      { key: 'name', label: 'Name' },
    ];
    render(<DataTable columns={columnsWithKey} data={data} rowKey={(row) => row.id} />);
    const rows = document.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
  });

  it('does not show cursor pointer when no onRowClick', () => {
    render(<DataTable columns={columns} data={data} />);
    expect(screen.getByText('Item 1').closest('tr')).not.toHaveClass('cursor-pointer');
  });

  it('shows cursor pointer when onRowClick is provided', () => {
    render(<DataTable columns={columns} data={data} onRowClick={() => {}} />);
    expect(screen.getByText('Item 1').closest('tr')).toHaveClass('cursor-pointer');
  });
});