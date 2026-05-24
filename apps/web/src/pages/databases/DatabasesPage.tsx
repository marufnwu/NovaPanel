import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { api } from '../../api/client';
import { useDatabases, useCreateDatabase, useDeleteDatabase, type Database } from '../../api/hooks/databases';
import { Icon } from '../../components/icons';
import { toast } from '../../lib/toast';
import { ErrorState } from '../../components/ui/ErrorState';

export function DatabasesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: databases, isLoading, isError, error, refetch } = useDatabases();
  const createDatabase = useCreateDatabase();
  const deleteDatabase = useDeleteDatabase();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newDbName, setNewDbName] = useState('');
  const [newDbEngine, setNewDbEngine] = useState<'mariadb' | 'postgresql'>('mariadb');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!newDbName) return;
    createDatabase.mutateAsync(
      { name: newDbName, type: newDbEngine },
      {
        onSuccess: () => {
          toast.success('Database created');
          setShowCreateModal(false);
          setNewDbName('');
          queryClient.invalidateQueries({ queryKey: ['databases'] });
        },
        onError: (err: any) => toast.error(`Failed to create database: ${err.message}`),
      }
    );
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    deleteDatabase.mutateAsync(deleteId, {
      onSuccess: () => {
        toast.success('Database deleted');
        setDeleteId(null);
        queryClient.invalidateQueries({ queryKey: ['databases'] });
      },
      onError: (err: any) => toast.error(`Failed to delete database: ${err.message}`),
    });
  };

  if (isLoading) {
    return <PageSkeleton />;
  }
  if (isError) return <ErrorState message={error?.message} onRetry={refetch} />;

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (db: Database) => <span className="font-medium">{db.name}</span>,
    },
    {
      key: 'engine',
      label: 'Engine',
      render: (db: Database) => (
        <span className="text-small px-2 py-0.5 bg-background-secondary rounded">
          {db.engine === 'mariadb' ? 'MariaDB' : 'PostgreSQL'}
        </span>
      ),
    },
    {
      key: 'charset',
      label: 'Charset',
    },
    {
      key: 'createdAt',
      label: 'Created',
      render: (db: Database) => new Date(db.createdAt).toLocaleDateString(),
    },
    {
      key: 'actions',
      label: '',
      render: (db: Database) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              navigate({ to: '/databases/$databaseId', params: { databaseId: db.id } });
            }}
            icon={<Icon name="icon-arrow-right" size={15} />}
          >
            View
          </Button>
          <Button
            variant="ghost"
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              setDeleteId(db.id);
            }}
            icon={<Icon name="icon-trash" size={15} />}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-page-title font-medium">Databases</h1>
        <Button icon={<Icon name="icon-plus" size={16} />} onClick={() => setShowCreateModal(true)}>
          Create Database
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={databases || []}
        rowKey={(db) => db.id}
        onRowClick={(db) => navigate({ to: '/databases/$databaseId', params: { databaseId: db.id } })}
        emptyState={
          <EmptyState
            icon="icon-database"
            title="No databases yet"
            description="Create your first database to get started"
            action={{ label: 'Create Database', onClick: () => setShowCreateModal(true) }}
          />
        }
      />

      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Database"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleCreate} loading={createDatabase.isPending}>
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Database Name"
            value={newDbName}
            onChange={(e) => setNewDbName(e.target.value)}
            placeholder="my_database"
          />
          <div>
            <label className="text-meta font-medium mb-1 block">Engine</label>
            <div className="flex gap-2">
              <Button
                variant={newDbEngine === 'mariadb' ? 'primary' : 'default'}
                onClick={() => setNewDbEngine('mariadb')}
              >
                MariaDB
              </Button>
              <Button
                variant={newDbEngine === 'postgresql' ? 'primary' : 'default'}
                onClick={() => setNewDbEngine('postgresql')}
              >
                PostgreSQL
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => handleDelete()}
        title="Delete Database"
        description="This action cannot be undone. All data will be permanently deleted."
        confirmText="Delete"
        impact="high"
        loading={deleteDatabase.isPending}
      />
    </div>
  );
}