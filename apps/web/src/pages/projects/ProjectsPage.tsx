import { useState } from 'react';
import {
  useProjects,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
  type Project,
} from '../../api/hooks/projects';
import { useAuthStore } from '../../store/auth.store';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Folder,
  Plus,
  Trash2,
  Pencil,
  Loader2,
} from 'lucide-react';
import { toast } from '../../lib/toast';

const ENV_COLORS: Record<string, string> = {
  production: 'bg-green-500/10 text-green-500',
  staging: 'bg-yellow-500/10 text-yellow-500',
  development: 'bg-blue-500/10 text-blue-500',
};

function ProjectModal({
  initial,
  onClose,
  onSubmit,
  isPending,
}: {
  initial?: Project;
  onClose: () => void;
  onSubmit: (data: { name: string; slug: string; environment: 'production' | 'staging' | 'development' }) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    slug: initial?.name ? initial.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') : '',
    environment: initial?.environment ?? 'production' as 'production' | 'staging' | 'development',
  });

  const handleSubmit = () => {
    onSubmit({ name: form.name, slug: form.slug, environment: form.environment });
  };

  const handleNameChange = (value: string) => {
    setForm({
      ...form,
      name: value,
      slug: value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
    });
  };

  return (
    <Dialog open={true} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit Project' : 'Create Project'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="proj-name">Name</Label>
            <Input
              id="proj-name"
              value={form.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="My Project"
            />
          </div>
          <div>
            <Label htmlFor="proj-slug">Slug</Label>
            <Input
              id="proj-slug"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
              placeholder="my-project"
            />
          </div>
          <div>
            <Label>Environment</Label>
            <select
              value={form.environment}
              onChange={(e) => setForm({ ...form, environment: e.target.value as 'production' | 'staging' | 'development' })}
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              <option value="production">Production</option>
              <option value="staging">Staging</option>
              <option value="development">Development</option>
            </select>
          </div>
        </div>
        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isPending || !form.name.trim() || !form.slug.trim()}>
            {isPending ? 'Saving...' : initial ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ProjectsPage() {
  const activeOrgId = useAuthStore((s) => s.activeOrgId);
  const orgId = activeOrgId || 'default';

  const { data: projects, isLoading } = useProjects();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();

  const [showModal, setShowModal] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleCreate = (data: { name: string; slug: string; environment: 'production' | 'staging' | 'development' }) => {
    createProject.mutate(
      { ...data, orgId },
      {
        onSuccess: () => { toast.success('Project created'); setShowModal(false); },
        onError: (e: Error) => toast.error(e.message || 'Failed'),
      }
    );
  };

  const handleUpdate = (data: { name: string; slug: string; environment: 'production' | 'staging' | 'development' }) => {
    if (!editProject) return;
    updateProject.mutate(
      { id: editProject.id, name: data.name, environment: data.environment },
      {
        onSuccess: () => { toast.success('Project updated'); setEditProject(null); },
        onError: (e: Error) => toast.error(e.message || 'Failed'),
      }
    );
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteProject.mutate(deleteId, {
      onSuccess: () => { toast.success('Project deleted'); setDeleteId(null); },
      onError: (e: Error) => toast.error(e.message || 'Failed'),
    });
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Organize your sites and services into projects"
      />

      <div className="mb-6 flex items-center justify-end">
        <Button onClick={() => setShowModal(true)}>
          <Plus className="h-4 w-4 mr-2" /> New Project
        </Button>
      </div>

      {showModal && (
        <ProjectModal
          onClose={() => setShowModal(false)}
          onSubmit={handleCreate}
          isPending={createProject.isPending}
        />
      )}
      {editProject && (
        <ProjectModal
          initial={editProject}
          onClose={() => setEditProject(null)}
          onSubmit={handleUpdate}
          isPending={updateProject.isPending}
        />
      )}

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Project"
        message="This will permanently delete this project. Sites within it will not be deleted but will lose their project association."
        confirmText="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />

      {!projects || projects.length === 0 ? (
        <EmptyState
          icon={Folder}
          title="No projects"
          description="Create your first project to organize your sites."
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Environment</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((project) => (
                <TableRow key={project.id}>
                  <TableCell className="font-medium">{project.name}</TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">{project.slug}</TableCell>
                  <TableCell>
                    <Badge className={ENV_COLORS[project.environment]}>
                      {project.environment}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(project.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => setEditProject(project)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setDeleteId(project.id)}
                        className="hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}