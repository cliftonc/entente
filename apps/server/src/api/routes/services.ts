import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { services } from '../../db/schema'

export const servicesRouter = new Hono()

// Register a new service (consumer or provider)
servicesRouter.post('/', async c => {
  const registration = await c.req.json()

  if (!registration.name || !registration.type || !registration.packageJson) {
    return c.json({ error: 'Missing required fields: name, type, packageJson' }, 400)
  }

  if (!['consumer', 'provider'].includes(registration.type)) {
    return c.json({ error: 'Type must be either consumer or provider' }, 400)
  }

  const db = c.get('db')
  const { tenantId } = c.get('session')

  // Check if service already exists with this name and type
  const existing = await db.query.services.findFirst({
    where: and(
      eq(services.tenantId, tenantId),
      eq(services.name, registration.name),
      eq(services.type, registration.type)
    ),
  })

  let service: any
  let isNew = false

  if (existing) {
    // Update existing service
    const [updated] = await db
      .update(services)
      .set({
        description: registration.description,
        packageJson: registration.packageJson,
        gitRepositoryUrl: registration.gitRepositoryUrl,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(services.tenantId, tenantId),
          eq(services.name, registration.name),
          eq(services.type, registration.type)
        )
      )
      .returning()

    service = updated
    console.log(`📦 Updated existing ${registration.type}: ${registration.name}`)
  } else {
    // Create new service
    const [created] = await db
      .insert(services)
      .values({
        tenantId,
        name: registration.name,
        type: registration.type,
        description: registration.description,
        packageJson: registration.packageJson,
      })
      .returning()

    service = created
    isNew = true
    console.log(`📦 Registered new ${registration.type}: ${registration.name}`)
  }

  return c.json(
    {
      id: service.id,
      name: service.name,
      type: service.type,
      description: service.description,
      createdAt: service.createdAt,
      updatedAt: service.updatedAt,
      isNew,
    },
    isNew ? 201 : 200
  )
})

// Get all services for tenant with optional type filter
servicesRouter.get('/', async c => {
  const type = c.req.query('type') // Optional filter: 'consumer' | 'provider'
  const db = c.get('db')
  const { tenantId } = c.get('session')

  const whereConditions = [eq(services.tenantId, tenantId)]

  if (type && ['consumer', 'provider'].includes(type)) {
    whereConditions.push(eq(services.type, type))
  }

  const serviceList = await db.query.services.findMany({
    where: and(...whereConditions),
    orderBy: [services.name, services.type],
  })

  return c.json(serviceList)
})

// Get specific service by name and type
servicesRouter.get('/:name/:type', async c => {
  const name = c.req.param('name')
  const type = c.req.param('type')

  if (!['consumer', 'provider'].includes(type)) {
    return c.json({ error: 'Type must be either consumer or provider' }, 400)
  }

  const db = c.get('db')
  const { tenantId } = c.get('session')

  const service = await db.query.services.findFirst({
    where: and(eq(services.tenantId, tenantId), eq(services.name, name), eq(services.type, type)),
  })

  if (!service) {
    return c.json({ error: 'Service not found' }, 404)
  }

  return c.json(service)
})

// Update service (e.g., new package.json)
servicesRouter.put('/:name/:type', async c => {
  const name = c.req.param('name')
  const type = c.req.param('type')
  const updates = await c.req.json()

  if (!['consumer', 'provider'].includes(type)) {
    return c.json({ error: 'Type must be either consumer or provider' }, 400)
  }

  const db = c.get('db')
  const { tenantId } = c.get('session')

  // Check if service exists
  const existing = await db.query.services.findFirst({
    where: and(eq(services.tenantId, tenantId), eq(services.name, name), eq(services.type, type)),
  })

  if (!existing) {
    return c.json({ error: 'Service not found' }, 404)
  }

  // Update service
  const [updated] = await db
    .update(services)
    .set({
      description: updates.description ?? existing.description,
      packageJson: updates.packageJson ?? existing.packageJson,
      updatedAt: new Date(),
    })
    .where(and(eq(services.tenantId, tenantId), eq(services.name, name), eq(services.type, type)))
    .returning()

  console.log(`📦 Updated ${type}: ${name}`)

  return c.json(updated)
})

// Delete service
servicesRouter.delete('/:name/:type', async c => {
  const name = c.req.param('name')
  const type = c.req.param('type')

  if (!['consumer', 'provider'].includes(type)) {
    return c.json({ error: 'Type must be either consumer or provider' }, 400)
  }

  const db = c.get('db')
  const { tenantId } = c.get('session')

  const deleted = await db
    .delete(services)
    .where(and(eq(services.tenantId, tenantId), eq(services.name, name), eq(services.type, type)))
    .returning()

  if (deleted.length === 0) {
    return c.json({ error: 'Service not found' }, 404)
  }

  console.log(`🗑️ Deleted ${type}: ${name}`)
  return c.json({ message: 'Service deleted successfully' })
})
