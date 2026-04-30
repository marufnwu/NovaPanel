import { PageHeader } from '../../components/ui/PageHeader';

export function LogsPage() {
  return (
    <div>
      <PageHeader title="Logs" description="View system and application logs" />
      <div className="p-6">
        <p className="text-gray-500 dark:text-gray-400">
          Log viewer coming soon.
        </p>
      </div>
    </div>
  );
}
