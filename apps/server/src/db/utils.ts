import { and, desc, eq } from 'drizzle-orm'
import { db } from './client'
import * as schema from './schema'

const DEFAULT_TENANT_ID = 'default-tenant'

export async function ensureDefaultTenant() {
  const existing = await db.query.tenants.findFirst({
    where: eq(schema.tenants.slug, 'default'),
  })

  if (!existing) {
    const [tenant] = await db
      .insert(schema.tenants)
      .values({
        name: 'Default Tenant',
        slug: 'default',
      })
      .returning()
    return tenant.id
  }

  return existing.id
}

export async function getDefaultTenantId(): Promise<string> {
  return await ensureDefaultTenant()
}
