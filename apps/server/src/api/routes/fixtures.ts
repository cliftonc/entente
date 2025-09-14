import { Hono } from 'hono'
import type { Fixture, FixtureProposal, FixtureUpdate } from '@entente/types'
import { validateFixtureData, generateFixtureHash } from '@entente/fixtures'

import { fixtures } from '../../db/schema'
import { eq, and, desc, asc } from 'drizzle-orm'

export const fixturesRouter = new Hono()

// Propose a new fixture
fixturesRouter.post('/', async (c) => {
  const proposal: FixtureProposal = await c.req.json()

  // Validate fixture data
  if (!validateFixtureData(proposal.data)) {
    return c.json({ error: 'Invalid fixture data' }, 400)
  }

  if (!proposal.service || !proposal.operation) {
    return c.json({ error: 'Missing required fields' }, 400)
  }

  const db = c.get('db')
  const { tenantId } = c.get('session')

  // Generate hash for deduplication
  const hash = await generateFixtureHash(proposal.operation, proposal.data)

  // Check if fixture with same hash already exists for this tenant
  const existingFixture = await db.query.fixtures.findFirst({
    where: and(
      eq(fixtures.tenantId, tenantId),
      eq(fixtures.hash, hash)
    ),
  })

  if (existingFixture) {

    const fixture: Fixture = {
      id: existingFixture.id,
      service: existingFixture.service,
      serviceVersion: existingFixture.serviceVersion,
      operation: existingFixture.operation,
      status: existingFixture.status as any,
      source: existingFixture.source as any,
      priority: existingFixture.priority,
      data: existingFixture.data as any,
      createdFrom: existingFixture.createdFrom as any,
      createdAt: existingFixture.createdAt,
      approvedBy: existingFixture.approvedBy || undefined,
      approvedAt: existingFixture.approvedAt || undefined,
      notes: existingFixture.notes || undefined,
    }

    return c.json(fixture, 200) // Return existing fixture with 200 status
  }

  // Create new fixture if no duplicate found
  try {
    const [newFixture] = await db.insert(fixtures).values({
      tenantId,
      service: proposal.service,
      serviceVersion: proposal.serviceVersion,
      operation: proposal.operation,
      hash,
      status: 'draft',
      source: proposal.source,
      priority: proposal.priority || 1,
      data: proposal.data,
      createdFrom: {
        ...proposal.createdFrom,
        timestamp: new Date(),
      },
      notes: proposal.notes,
    }).returning()

    const fixture: Fixture = {
      id: newFixture.id,
      service: newFixture.service,
      serviceVersion: newFixture.serviceVersion,
      operation: newFixture.operation,
      status: newFixture.status as any,
      source: newFixture.source as any,
      priority: newFixture.priority,
      data: newFixture.data as any,
      createdFrom: newFixture.createdFrom as any,
      createdAt: newFixture.createdAt,
      approvedBy: newFixture.approvedBy || undefined,
      approvedAt: newFixture.approvedAt || undefined,
      notes: newFixture.notes || undefined,
    }


    return c.json(fixture, 201)
  } catch (error: any) {
    // Handle unique constraint violation (race condition)
    if (error.code === '23505' && error.constraint?.includes('tenant_hash_unique')) {

      const existingFixture = await db.query.fixtures.findFirst({
        where: and(
          eq(fixtures.tenantId, tenantId),
          eq(fixtures.hash, hash)
        ),
      })

      if (existingFixture) {
        const fixture: Fixture = {
          id: existingFixture.id,
          service: existingFixture.service,
          serviceVersion: existingFixture.serviceVersion,
          operation: existingFixture.operation,
          status: existingFixture.status as any,
          source: existingFixture.source as any,
          priority: existingFixture.priority,
          data: existingFixture.data as any,
          createdFrom: existingFixture.createdFrom as any,
          approvedBy: existingFixture.approvedBy || undefined,
          approvedAt: existingFixture.approvedAt || undefined,
          notes: existingFixture.notes || undefined,
        }

        return c.json(fixture, 200)
      }
    }

    // Re-throw if it's not a duplicate key error
    throw error
  }
})

// Get fixtures with optional filters
fixturesRouter.get('/', async (c) => {
  const service = c.req.query('service')
  const provider = c.req.query('provider')
  const consumer = c.req.query('consumer')
  const status = c.req.query('status')

  const db = c.get('db')
  const { tenantId } = c.get('session')

  const whereConditions = [
    eq(fixtures.tenantId, tenantId)
  ]

  // Filter by status if provided
  if (status) {
    whereConditions.push(eq(fixtures.status, status as any))
  }

  // The service field can be either a provider or consumer name
  if (service) whereConditions.push(eq(fixtures.service, service))
  if (provider) whereConditions.push(eq(fixtures.service, provider))
  if (consumer) whereConditions.push(eq(fixtures.service, consumer))

  const dbFixtures = await db.query.fixtures.findMany({
    where: and(...whereConditions),
    orderBy: desc(fixtures.createdAt),
  })

  const fixturesList: Fixture[] = dbFixtures.map(f => ({
    id: f.id,
    service: f.service,
    serviceVersion: f.serviceVersion,
    operation: f.operation,
    status: f.status as any,
    source: f.source as any,
    priority: f.priority,
    data: f.data as any,
    createdFrom: f.createdFrom as any,
    createdAt: f.createdAt,
    approvedBy: f.approvedBy || undefined,
    approvedAt: f.approvedAt || undefined,
    notes: f.notes || undefined,
  }))

  return c.json(fixturesList)
})

// Get pending fixtures (legacy endpoint - now wraps the main endpoint)
fixturesRouter.get('/pending', async (c) => {
  const service = c.req.query('service')
  const provider = c.req.query('provider')
  const consumer = c.req.query('consumer')

  const db = c.get('db')
  const { tenantId } = c.get('session')

  const whereConditions = [
    eq(fixtures.tenantId, tenantId),
    eq(fixtures.status, 'draft')
  ]

  // The service field can be either a provider or consumer name
  if (service) whereConditions.push(eq(fixtures.service, service))
  if (provider) whereConditions.push(eq(fixtures.service, provider))
  if (consumer) whereConditions.push(eq(fixtures.service, consumer))

  const dbFixtures = await db.query.fixtures.findMany({
    where: and(...whereConditions),
    orderBy: desc(fixtures.createdAt),
  })

  const fixturesList: Fixture[] = dbFixtures.map(f => ({
    id: f.id,
    service: f.service,
    serviceVersion: f.serviceVersion,
    operation: f.operation,
    status: f.status as any,
    source: f.source as any,
    priority: f.priority,
    data: f.data as any,
    createdFrom: f.createdFrom as any,
    createdAt: f.createdAt,
    approvedBy: f.approvedBy || undefined,
    approvedAt: f.approvedAt || undefined,
    notes: f.notes || undefined,
  }))

  return c.json(fixturesList)
})

// Get fixtures by service
fixturesRouter.get('/service/:service', async (c) => {
  const service = c.req.param('service')
  const version = c.req.query('version')
  const status = c.req.query('status') || 'approved'

  const db = c.get('db')
  const { tenantId } = c.get('session')

  const whereConditions = [
    eq(fixtures.tenantId, tenantId),
    eq(fixtures.service, service),
    eq(fixtures.status, status as any)
  ]

  if (version) whereConditions.push(eq(fixtures.serviceVersion, version))

  const dbFixtures = await db.query.fixtures.findMany({
    where: and(...whereConditions),
    orderBy: [asc(fixtures.operation), desc(fixtures.priority)],
  })

  const fixturesList: Fixture[] = dbFixtures.map(f => ({
    id: f.id,
    service: f.service,
    serviceVersion: f.serviceVersion,
    operation: f.operation,
    status: f.status as any,
    source: f.source as any,
    priority: f.priority,
    data: f.data as any,
    createdFrom: f.createdFrom as any,
    createdAt: f.createdAt,
    approvedBy: f.approvedBy || undefined,
    approvedAt: f.approvedAt || undefined,
    notes: f.notes || undefined,
  }))

  return c.json(fixturesList)
})

// Get fixture by ID
fixturesRouter.get('/by-id/:id', async (c) => {
  const fixtureId = c.req.param('id')

  const db = c.get('db')
  const { tenantId } = c.get('session')

  const dbFixture = await db.query.fixtures.findFirst({
    where: and(
      eq(fixtures.tenantId, tenantId),
      eq(fixtures.id, fixtureId)
    ),
  })

  if (!dbFixture) {
    return c.json({ error: 'Fixture not found' }, 404)
  }

  const fixture: Fixture = {
    id: dbFixture.id,
    service: dbFixture.service,
    serviceVersion: dbFixture.serviceVersion,
    operation: dbFixture.operation,
    status: dbFixture.status as any,
    source: dbFixture.source as any,
    priority: dbFixture.priority,
    data: dbFixture.data as any,
    createdFrom: dbFixture.createdFrom as any,
    createdAt: dbFixture.createdAt,
    approvedBy: dbFixture.approvedBy || undefined,
    approvedAt: dbFixture.approvedAt || undefined,
    notes: dbFixture.notes || undefined,
  }

  return c.json(fixture)
})

// Get fixtures for an operation
fixturesRouter.get('/:operation', async (c) => {
  const operation = c.req.param('operation')
  const service = c.req.query('service')
  const version = c.req.query('version')
  const status = c.req.query('status') || 'approved'

  if (!service || !version) {
    return c.json({ error: 'Service and version parameters are required' }, 400)
  }

  const db = c.get('db')
  const { tenantId } = c.get('session')

  const dbFixtures = await db.query.fixtures.findMany({
    where: and(
      eq(fixtures.tenantId, tenantId),
      eq(fixtures.operation, operation),
      eq(fixtures.service, service),
      eq(fixtures.serviceVersion, version),
      eq(fixtures.status, status as any)
    ),
    orderBy: [desc(fixtures.priority), desc(fixtures.createdAt)],
  })

  const fixturesList: Fixture[] = dbFixtures.map(f => ({
    id: f.id,
    service: f.service,
    serviceVersion: f.serviceVersion,
    operation: f.operation,
    status: f.status as any,
    source: f.source as any,
    priority: f.priority,
    data: f.data as any,
    createdFrom: f.createdFrom as any,
    createdAt: f.createdAt,
    approvedBy: f.approvedBy || undefined,
    approvedAt: f.approvedAt || undefined,
    notes: f.notes || undefined,
  }))

  return c.json(fixturesList)
})

// Approve a fixture
fixturesRouter.post('/:id/approve', async (c) => {
  const fixtureId = c.req.param('id')
  const { approvedBy, notes } = await c.req.json()

  if (!approvedBy) {
    return c.json({ error: 'approvedBy is required' }, 400)
  }

  const db = c.get('db')
  const { tenantId } = c.get('session')

  const [updatedFixture] = await db.update(fixtures)
    .set({
      status: 'approved',
      approvedBy,
      approvedAt: new Date(),
      notes: notes,
    })
    .where(and(
      eq(fixtures.tenantId, tenantId),
      eq(fixtures.id, fixtureId)
    ))
    .returning()

  if (!updatedFixture) {
    return c.json({ error: 'Fixture not found' }, 404)
  }

  const fixture: Fixture = {
    id: updatedFixture.id,
    service: updatedFixture.service,
    serviceVersion: updatedFixture.serviceVersion,
    operation: updatedFixture.operation,
    status: updatedFixture.status as any,
    source: updatedFixture.source as any,
    priority: updatedFixture.priority,
    data: updatedFixture.data as any,
    createdFrom: updatedFixture.createdFrom as any,
    createdAt: updatedFixture.createdAt,
    approvedBy: updatedFixture.approvedBy || undefined,
    approvedAt: updatedFixture.approvedAt || undefined,
    notes: updatedFixture.notes || undefined,
  }


  return c.json(fixture)
})

// Update a fixture
fixturesRouter.put('/:id', async (c) => {
  const fixtureId = c.req.param('id')
  const updates: FixtureUpdate = await c.req.json()

  // Validate fixture data if provided
  if (updates.data && !validateFixtureData(updates.data)) {
    return c.json({ error: 'Invalid fixture data' }, 400)
  }

  const db = c.get('db')
  const { tenantId } = c.get('session')

  const updateData: any = {}
  if (updates.status) updateData.status = updates.status
  if (updates.priority !== undefined) updateData.priority = updates.priority
  if (updates.data) updateData.data = updates.data
  if (updates.notes !== undefined) updateData.notes = updates.notes

  const [updatedFixture] = await db.update(fixtures)
    .set(updateData)
    .where(and(
      eq(fixtures.tenantId, tenantId),
      eq(fixtures.id, fixtureId)
    ))
    .returning()

  if (!updatedFixture) {
    return c.json({ error: 'Fixture not found' }, 404)
  }

  const fixture: Fixture = {
    id: updatedFixture.id,
    service: updatedFixture.service,
    serviceVersion: updatedFixture.serviceVersion,
    operation: updatedFixture.operation,
    status: updatedFixture.status as any,
    source: updatedFixture.source as any,
    priority: updatedFixture.priority,
    data: updatedFixture.data as any,
    createdFrom: updatedFixture.createdFrom as any,
    createdAt: updatedFixture.createdAt,
    approvedBy: updatedFixture.approvedBy || undefined,
    approvedAt: updatedFixture.approvedAt || undefined,
    notes: updatedFixture.notes || undefined,
  }


  return c.json(fixture)
})

// Reject a fixture
fixturesRouter.post('/:id/reject', async (c) => {
  const fixtureId = c.req.param('id')
  const { rejectedBy, notes } = await c.req.json()

  if (!rejectedBy) {
    return c.json({ error: 'rejectedBy is required' }, 400)
  }

  const db = c.get('db')
  const { tenantId } = c.get('session')

  const [updatedFixture] = await db.update(fixtures)
    .set({
      status: 'rejected',
      approvedBy: rejectedBy,
      approvedAt: new Date(),
      notes: notes,
    })
    .where(and(
      eq(fixtures.tenantId, tenantId),
      eq(fixtures.id, fixtureId),
      eq(fixtures.status, 'draft')
    ))
    .returning()

  if (!updatedFixture) {
    return c.json({ error: 'Fixture not found or not in draft status' }, 404)
  }

  const fixture: Fixture = {
    id: updatedFixture.id,
    service: updatedFixture.service,
    serviceVersion: updatedFixture.serviceVersion,
    operation: updatedFixture.operation,
    status: updatedFixture.status as any,
    source: updatedFixture.source as any,
    priority: updatedFixture.priority,
    data: updatedFixture.data as any,
    createdFrom: updatedFixture.createdFrom as any,
    createdAt: updatedFixture.createdAt,
    approvedBy: updatedFixture.approvedBy || undefined,
    approvedAt: updatedFixture.approvedAt || undefined,
    notes: updatedFixture.notes || undefined,
  }

  return c.json(fixture)
})

// Revoke a fixture (change from approved to rejected)
fixturesRouter.post('/:id/revoke', async (c) => {
  const fixtureId = c.req.param('id')
  const { revokedBy, notes } = await c.req.json()

  if (!revokedBy) {
    return c.json({ error: 'revokedBy is required' }, 400)
  }

  const db = c.get('db')
  const { tenantId } = c.get('session')

  const [updatedFixture] = await db.update(fixtures)
    .set({
      status: 'rejected',
      approvedBy: revokedBy,
      approvedAt: new Date(),
      notes: notes,
    })
    .where(and(
      eq(fixtures.tenantId, tenantId),
      eq(fixtures.id, fixtureId),
      eq(fixtures.status, 'approved')
    ))
    .returning()

  if (!updatedFixture) {
    return c.json({ error: 'Fixture not found or not in approved status' }, 404)
  }

  const fixture: Fixture = {
    id: updatedFixture.id,
    service: updatedFixture.service,
    serviceVersion: updatedFixture.serviceVersion,
    operation: updatedFixture.operation,
    status: updatedFixture.status as any,
    source: updatedFixture.source as any,
    priority: updatedFixture.priority,
    data: updatedFixture.data as any,
    createdFrom: updatedFixture.createdFrom as any,
    createdAt: updatedFixture.createdAt,
    approvedBy: updatedFixture.approvedBy || undefined,
    approvedAt: updatedFixture.approvedAt || undefined,
    notes: updatedFixture.notes || undefined,
  }

  return c.json(fixture)
})

// Delete a fixture
fixturesRouter.delete('/:id', async (c) => {
  const fixtureId = c.req.param('id')

  const db = c.get('db')
  const { tenantId } = c.get('session')

  const deletedFixtures = await db.delete(fixtures)
    .where(and(
      eq(fixtures.tenantId, tenantId),
      eq(fixtures.id, fixtureId)
    ))
    .returning()

  if (deletedFixtures.length === 0) {
    return c.json({ error: 'Fixture not found' }, 404)
  }


  return c.json({ status: 'deleted' })
})