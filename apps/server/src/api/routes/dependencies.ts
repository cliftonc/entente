import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { serviceDependencies, services } from '../../db/schema'

export const dependenciesRouter = new Hono()

// Get dependencies for a consumer
dependenciesRouter.get('/consumer/:name', async c => {
  const consumerName = c.req.param('name')

  const db = c.get('db')
  const { tenantId } = c.get('session')

  // Find consumer service first
  const consumer = await db.query.services.findFirst({
    where: and(
      eq(services.tenantId, tenantId),
      eq(services.name, consumerName),
      eq(services.type, 'consumer')
    ),
  })

  if (!consumer) {
    return c.json({ error: 'Consumer not found' }, 404)
  }

  // Build where conditions
  const whereConditions = [
    eq(serviceDependencies.tenantId, tenantId),
    eq(serviceDependencies.consumerId, consumer.id),
  ]

  // Get dependencies with service details
  const dependencies = await db.query.serviceDependencies.findMany({
    where: and(...whereConditions),
    with: {
      consumer: true,
      provider: true,
    },
    orderBy: [serviceDependencies.registeredAt],
  })

  return c.json(dependencies)
})

// Get consumers that depend on a provider
dependenciesRouter.get('/provider/:name', async c => {
  const providerName = c.req.param('name')

  const db = c.get('db')
  const { tenantId } = c.get('session')

  // Find provider service first
  const provider = await db.query.services.findFirst({
    where: and(
      eq(services.tenantId, tenantId),
      eq(services.name, providerName),
      eq(services.type, 'provider')
    ),
  })

  if (!provider) {
    return c.json({ error: 'Provider not found' }, 404)
  }

  // Build where conditions
  const whereConditions = [
    eq(serviceDependencies.tenantId, tenantId),
    eq(serviceDependencies.providerId, provider.id),
  ]

  // Get dependencies with service details
  const dependencies = await db.query.serviceDependencies.findMany({
    where: and(...whereConditions),
    with: {
      consumer: true,
      provider: true,
    },
    orderBy: [serviceDependencies.registeredAt],
  })

  return c.json(dependencies)
})

// Get all dependencies (for admin/overview)
dependenciesRouter.get('/', async c => {
  const db = c.get('db')
  const { tenantId } = c.get('session')

  // Build where conditions
  const whereConditions = [eq(serviceDependencies.tenantId, tenantId)]

  // Get all dependencies with details
  const dependencies = await db.query.serviceDependencies.findMany({
    where: and(...whereConditions),
    with: {
      consumer: true,
      provider: true,
    },
    orderBy: [serviceDependencies.registeredAt],
  })

  return c.json(dependencies)
})

// Delete dependency (used for cleanup)
dependenciesRouter.delete('/:id', async c => {
  const dependencyId = c.req.param('id')

  const db = c.get('db')
  const { tenantId } = c.get('session')

  // Check if dependency exists and belongs to tenant
  const existing = await db.query.serviceDependencies.findFirst({
    where: and(
      eq(serviceDependencies.tenantId, tenantId),
      eq(serviceDependencies.id, dependencyId)
    ),
  })

  if (!existing) {
    return c.json({ error: 'Dependency not found' }, 404)
  }

  // Delete dependency
  await db
    .delete(serviceDependencies)
    .where(
      and(eq(serviceDependencies.tenantId, tenantId), eq(serviceDependencies.id, dependencyId))
    )

  console.log(`🗑️ Deleted dependency: ${dependencyId}`)

  return c.json({ success: true })
})
