import { Hono } from 'hono'
import type { Fixture, FixtureProposal, FixtureUpdate } from '@entente/types'
import { validateFixtureData } from '@entente/fixtures'

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

  const [newFixture] = await db.insert(fixtures).values({
    tenantId,
    service: proposal.service,
    serviceVersion: proposal.serviceVersion,
    operation: proposal.operation,
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
    approvedBy: newFixture.approvedBy || undefined,
    approvedAt: newFixture.approvedAt || undefined,
    notes: newFixture.notes || undefined,
  }

  console.log(`📋 Proposed fixture for ${proposal.service}.${proposal.operation} from ${proposal.source}`)

  return c.json(fixture, 201)
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
    approvedBy: f.approvedBy || undefined,
    approvedAt: f.approvedAt || undefined,
    notes: f.notes || undefined,
  }))

  return c.json(fixturesList)
})

// Get pending fixtures
fixturesRouter.get('/pending', async (c) => {
  const service = c.req.query('service')

  const db = c.get('db')
  const { tenantId } = c.get('session')

  const whereConditions = [
    eq(fixtures.tenantId, tenantId),
    eq(fixtures.status, 'draft')
  ]

  if (service) whereConditions.push(eq(fixtures.service, service))

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
    approvedBy: updatedFixture.approvedBy || undefined,
    approvedAt: updatedFixture.approvedAt || undefined,
    notes: updatedFixture.notes || undefined,
  }

  console.log(`✅ Approved fixture ${fixtureId} by ${approvedBy}`)

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
    approvedBy: updatedFixture.approvedBy || undefined,
    approvedAt: updatedFixture.approvedAt || undefined,
    notes: updatedFixture.notes || undefined,
  }

  console.log(`📝 Updated fixture ${fixtureId}`)

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

  console.log(`🗑️  Deleted fixture ${fixtureId}`)

  return c.json({ status: 'deleted' })
})