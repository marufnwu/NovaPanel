import { db } from '../../db/index.js';
import { projects } from '../../db/schema/organizations.js';
import { eq } from 'drizzle-orm';
import { AppError } from '../../errors.js';
import { nanoid } from 'nanoid';

export class ProjectsService {
  async listByOrg(orgId: string) {
    return db.select().from(projects).where(eq(projects.orgId, orgId));
  }

  async get(id: string) {
    const [project] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
    return project || null;
  }

  async create(data: { name: string; slug: string; orgId: string; environment?: 'production' | 'staging' | 'development' }, _userId?: string) {
    const id = nanoid();
    const env = data.environment || 'production';
    const [project] = await db.insert(projects).values({
      id,
      orgId: data.orgId,
      name: data.name,
      slug: data.slug,
      environment: env,
      settings: '{}',
    }).returning();
    return project;
  }

  async update(id: string, data: { name?: string; environment?: 'production' | 'staging' | 'development' }) {
    const [updated] = await db.update(projects).set(data).where(eq(projects.id, id)).returning();
    if (!updated) throw new AppError(404, 'NOT_FOUND', 'Project not found');
    return updated;
  }

  async delete(id: string) {
    await db.delete(projects).where(eq(projects.id, id));
    return { success: true };
  }
}

export const projectsService = new ProjectsService();