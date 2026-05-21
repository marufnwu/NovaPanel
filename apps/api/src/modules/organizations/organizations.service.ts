import { db } from '../../db/index.js';
import { organizations, organizationMembers, users } from '../../db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import { AppError } from '../../errors.js';
import { nanoid } from 'nanoid';

export class OrganizationsService {
  async listByUser(userId: string) {
    const memberships = await db
      .select({ org: organizations, role: organizationMembers.role, joinedAt: organizationMembers.joinedAt })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizations.id, organizationMembers.orgId))
      .where(eq(organizationMembers.userId, userId));

    return memberships.map(m => ({
      ...m.org,
      role: m.role,
      joinedAt: m.joinedAt,
    }));
  }

  async get(id: string, userId?: string) {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
    if (!org) return null;

    if (userId) {
      const [member] = await db
        .select()
        .from(organizationMembers)
        .where(and(eq(organizationMembers.orgId, id), eq(organizationMembers.userId, userId)))
        .limit(1);
      if (!member) throw new AppError(403, 'FORBIDDEN', 'Not a member of this organization');
      return { ...org, role: member.role };
    }

    return org;
  }

  async create(data: { name: string; slug: string }, userId: string) {
    const orgId = nanoid();
    const [org] = await db.insert(organizations).values({
      id: orgId,
      name: data.name,
      slug: data.slug,
      plan: 'free',
      status: 'active',
      settings: '{}',
      quotas: '{}',
    }).returning();

    await db.insert(organizationMembers).values({
      id: nanoid(),
      orgId,
      userId,
      role: 'owner',
      permissions: '[]',
    });

    const defaultProjectId = nanoid();
    const { projects } = await import('../../db/schema/organizations.js');
    await db.insert(projects).values({
      id: defaultProjectId,
      orgId,
      name: 'Default Project',
      slug: 'default',
      environment: 'production',
      settings: '{}',
    });

    return org;
  }

  async update(id: string, data: { name?: string; plan?: 'free' | 'starter' | 'pro' | 'enterprise'; status?: 'active' | 'suspended' | 'cancelled' }) {
    const [updated] = await db.update(organizations).set(data).where(eq(organizations.id, id)).returning();
    return updated;
  }

  async delete(id: string) {
    await db.delete(organizations).where(eq(organizations.id, id));
    return { success: true };
  }

  async listMembers(orgId: string) {
    const members = await db
      .select({
        id: organizationMembers.id,
        role: organizationMembers.role,
        permissions: organizationMembers.permissions,
        joinedAt: organizationMembers.joinedAt,
        userId: organizationMembers.userId,
        username: users.username,
        email: users.email,
        displayName: users.displayName,
      })
      .from(organizationMembers)
      .innerJoin(users, eq(users.id, organizationMembers.userId))
      .where(eq(organizationMembers.orgId, orgId));

    return members;
  }

  async inviteMember(orgId: string, email: string, role: string, invitedBy: string) {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User with this email not found');

    const [existing] = await db
      .select()
      .from(organizationMembers)
      .where(and(eq(organizationMembers.orgId, orgId), eq(organizationMembers.userId, user.id)))
      .limit(1);
    if (existing) throw new AppError(400, 'ALREADY_MEMBER', 'User is already a member');

    await db.insert(organizationMembers).values({
      id: nanoid(),
      orgId,
      userId: user.id,
      role: role as any,
      permissions: '[]',
      invitedBy,
    });

    return { success: true };
  }

  async removeMember(orgId: string, userId: string) {
    await db
      .delete(organizationMembers)
      .where(and(eq(organizationMembers.orgId, orgId), eq(organizationMembers.userId, userId)));
    return { success: true };
  }

  async updateMemberRole(orgId: string, userId: string, role: string) {
    await db
      .update(organizationMembers)
      .set({ role: role as any })
      .where(and(eq(organizationMembers.orgId, orgId), eq(organizationMembers.userId, userId)));
    return { success: true };
  }
}

export const organizationsService = new OrganizationsService();