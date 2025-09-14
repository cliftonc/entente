import { Hono } from 'hono'
import { serviceDependencies, services } from '../../db/schema'
import { eq, and } from 'drizzle-orm'

export const dependenciesRouter = new Hono()

// Get dependencies for a consumer
dependenciesRouter.get('/consumer/:name', async (c) => {
  const consumerName = c.req.param('name')
  const environment = c.req.query('environment')

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
    eq(serviceDependencies.consumerId, consumer.id)
  ]

  if (environment) {
    whereConditions.push(eq(serviceDependencies.environment, environment))
  }

  // Get dependencies with service details
  const dependencies = await db.query.serviceDependencies.findMany({
    where: and(...whereConditions),
    with: {
      consumer: true,
      provider: true,
    },
    orderBy: [serviceDependencies.environment, serviceDependencies.registeredAt],
  })

  return c.json(dependencies)
})

// Get consumers that depend on a provider
dependenciesRouter.get('/provider/:name', async (c) => {
  const providerName = c.req.param('name')
  const environment = c.req.query('environment')

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
    eq(serviceDependencies.providerId, provider.id)
  ]

  if (environment) {
    whereConditions.push(eq(serviceDependencies.environment, environment))
  }

  // Get dependencies with service details
  const dependencies = await db.query.serviceDependencies.findMany({
    where: and(...whereConditions),
    with: {
      consumer: true,
      provider: true,
    },
    orderBy: [serviceDependencies.environment, serviceDependencies.registeredAt],
  })

  return c.json(dependencies)
})

// Get all dependencies (for admin/overview)
dependenciesRouter.get('/', async (c) => {
  const environment = c.req.query('environment')
  const status = c.req.query('status') as 'pending_verification' | 'verified' | 'failed' | undefined

  const db = c.get('db')
  const { tenantId } = c.get('session')

  // Build where conditions
  const whereConditions = [eq(serviceDependencies.tenantId, tenantId)]

  if (environment) {
    whereConditions.push(eq(serviceDependencies.environment, environment))
  }

  if (status) {
    whereConditions.push(eq(serviceDependencies.status, status))
  }

  // Get all dependencies with details
  const dependencies = await db.query.serviceDependencies.findMany({
    where: and(...whereConditions),
    with: {
      consumer: true,
      provider: true,
    },
    orderBy: [serviceDependencies.environment, serviceDependencies.registeredAt],
  })

  return c.json(dependencies)
})

// Update dependency status (used by verification process)
dependenciesRouter.patch('/:id/status', async (c) => {
  const dependencyId = c.req.param('id')
  const { status, verifiedAt } = await c.req.json()

  if (!['pending_verification', 'verified', 'failed'].includes(status)) {
    return c.json({ error: 'Invalid status. Must be pending_verification, verified, or failed' }, 400)
  }

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

  // Update status
  const [updated] = await db.update(serviceDependencies)
    .set({
      status,
      verifiedAt: status === 'verified' ? (verifiedAt ? new Date(verifiedAt) : new Date()) : null,
    })
    .where(and(
      eq(serviceDependencies.tenantId, tenantId),
      eq(serviceDependencies.id, dependencyId)
    ))
    .returning()

  console.log(`🔄 Updated dependency status: ${dependencyId} -> ${status}`)

  return c.json(updated)
})