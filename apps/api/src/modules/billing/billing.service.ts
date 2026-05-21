import { db } from '../../db/index.js';
import { usageRecords, invoices, plans, type UsageRecord, type NewUsageRecord, type Invoice, type NewInvoice, type Plan, type NewPlan } from '../../db/schema/billing.js';
import { eq, desc, and, gte, lte } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export class BillingService {
  async listUsageRecords(orgId: string, from?: Date, to?: Date): Promise<UsageRecord[]> {
    let query = db.select().from(usageRecords).where(eq(usageRecords.orgId, orgId)).orderBy(desc(usageRecords.timestamp));
    return query;
  }

  async recordUsage(orgId: string, resourceType: 'cpu' | 'memory' | 'storage' | 'bandwidth' | 'requests', quantity: number, unit: string, resourceId?: string): Promise<UsageRecord> {
    const record: NewUsageRecord = {
      id: nanoid(),
      orgId,
      resourceType,
      resourceId,
      quantity,
      unit,
      timestamp: new Date(),
    };
    await db.insert(usageRecords).values(record);
    const [created] = await db.select().from(usageRecords).where(eq(usageRecords.id, record.id)).limit(1);
    return created;
  }

  async getCurrentUsage(orgId: string): Promise<Record<string, { quantity: number; unit: string }>> {
    const records = await db.select().from(usageRecords).where(eq(usageRecords.orgId, orgId));
    const aggregated: Record<string, { quantity: number; unit: string }> = {};
    for (const r of records) {
      const key = r.resourceType;
      if (!aggregated[key]) {
        aggregated[key] = { quantity: 0, unit: r.unit };
      }
      aggregated[key].quantity += r.quantity;
    }
    return aggregated;
  }

  async listInvoices(orgId: string): Promise<Invoice[]> {
    return db.select().from(invoices).where(eq(invoices.orgId, orgId)).orderBy(desc(invoices.createdAt));
  }

  async createInvoice(orgId: string, amount: number, currency = 'USD', lineItems?: unknown[]): Promise<Invoice> {
    const invoice: NewInvoice = {
      id: nanoid(),
      orgId,
      status: 'draft',
      amount,
      currency,
      lineItems: lineItems ?? [],
      createdAt: new Date(),
    };
    await db.insert(invoices).values(invoice);
    const [created] = await db.select().from(invoices).where(eq(invoices.id, invoice.id)).limit(1);
    return created;
  }

  async updateInvoiceStatus(id: string, status: Invoice['status']): Promise<Invoice> {
    const updateData: Partial<NewInvoice> = { status };
    if (status === 'paid') {
      updateData.paidAt = new Date();
    }
    await db.update(invoices).set(updateData).where(eq(invoices.id, id));
    const [updated] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
    if (!updated) throw new Error('Invoice not found');
    return updated;
  }

  async listPlans(): Promise<Plan[]> {
    return db.select().from(plans).where(eq(plans.isActive, true)).orderBy(plans.price);
  }

  async getPlan(slug: string): Promise<Plan | null> {
    const [plan] = await db.select().from(plans).where(eq(plans.slug, slug)).limit(1);
    return plan ?? null;
  }

  async createPlan(data: Omit<NewPlan, 'id' | 'createdAt'>): Promise<Plan> {
    const plan: NewPlan = {
      id: nanoid(),
      ...data,
      createdAt: new Date(),
    };
    await db.insert(plans).values(plan);
    const [created] = await db.select().from(plans).where(eq(plans.id, plan.id)).limit(1);
    return created;
  }

  async updatePlan(id: string, data: Partial<Pick<Plan, 'name' | 'price' | 'quotas' | 'features' | 'isActive'>>): Promise<Plan> {
    await db.update(plans).set({ ...data, updatedAt: new Date() }).where(eq(plans.id, id));
    const [updated] = await db.select().from(plans).where(eq(plans.id, id)).limit(1);
    if (!updated) throw new Error('Plan not found');
    return updated;
  }

  async deletePlan(id: string): Promise<void> {
    await db.update(plans).set({ isActive: false, updatedAt: new Date() }).where(eq(plans.id, id));
  }
}

export const billingService = new BillingService();