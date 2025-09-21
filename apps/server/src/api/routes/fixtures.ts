import { generateFixtureHash, normalizeFixtures, validateFixtureData } from '@entente/fixtures'
import type {
  BatchFixtureResult,
  BatchFixtureUpload,
  Fixture,
  FixtureCreation,
  FixtureData,
  FixtureProposal,
  FixtureUpdate,
  NormalizedFixtures,
} from '@entente/types'
import { Hono } from 'hono'

import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { fixtureServiceVersions, fixtures, services } from '../../db/schema'
import { NotificationService } from '../services/notification'
import { addServiceVersionToFixture } from '../utils/fixture-service-versions'
import { ensureServiceVersion } from '../utils/service-versions'

export const fixturesRouter = new Hono()

// Propose a new fixture
fixturesRouter.post('/', async c => {
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

  // Get the provider service to obtain its specType
  const service = await db.query.services.findFirst({
    where: and(
      eq(services.tenantId, tenantId),
      eq(services.name, proposal.service)
    ),
  })

  if (!service) {
    return c.json({ error: `Provider service '${proposal.service}' not found` }, 404)
  }

  if (!service.specType) {
    return c.json({ error: `Provider service '${proposal.service}' has no specType` }, 400)
  }

  // Generate hash for deduplication
  const hash = await generateFixtureHash(proposal.operation, proposal.data)

  // Check if fixture with same hash already exists for this tenant
  const existingFixture = await db.query.fixtures.findFirst({
    where: and(eq(fixtures.tenantId, tenantId), eq(fixtures.hash, hash)),
  })

  if (existingFixture) {
    // Add the service version to the fixture using the join table
    await addServiceVersionToFixture(
      db,
      existingFixture.id,
      tenantId,
      proposal.service,
      proposal.serviceVersion
    )

    // Get existing service versions array, handling null case for pre-migration fixtures
    const existingVersions = (existingFixture.serviceVersions as string[]) || []

    // Check if the current version is already in the array (for backward compatibility)
    if (!existingVersions.includes(proposal.serviceVersion)) {
      // Add the new version to the array for backward compatibility
      const updatedVersions = [...existingVersions, proposal.serviceVersion]

      // Update the fixture with the new version added (keeping backward compatibility)
      await db
        .update(fixtures)
        .set({
          serviceVersions: updatedVersions,
          serviceVersion: proposal.serviceVersion, // Update latest version for backward compatibility
        })
        .where(eq(fixtures.id, existingFixture.id))
    }

    const fixture: Fixture = {
      id: existingFixture.id,
      service: existingFixture.service,
      serviceVersion: proposal.serviceVersion, // Use the current proposal version
      serviceVersions: existingVersions.includes(proposal.serviceVersion)
        ? existingVersions
        : [...existingVersions, proposal.serviceVersion],
      specType: existingFixture.specType,
      operation: existingFixture.operation,
      status: existingFixture.status as 'draft' | 'approved' | 'rejected',
      source: existingFixture.source as 'consumer' | 'provider' | 'manual',
      priority: existingFixture.priority,
      data: existingFixture.data as FixtureData,
      createdFrom: existingFixture.createdFrom as FixtureCreation,
      createdAt: existingFixture.createdAt,
      approvedBy: existingFixture.approvedBy || undefined,
      approvedAt: existingFixture.approvedAt || undefined,
      notes: existingFixture.notes || undefined,
    }

    return c.json(fixture, 200) // Return existing fixture with 200 status
  }

  // Create new fixture if no duplicate found
  try {
    const [newFixture] = await db
      .insert(fixtures)
      .values({
        tenantId,
        service: proposal.service,
        serviceVersion: proposal.serviceVersion,
        serviceVersions: [proposal.serviceVersion], // Initialize with current version for backward compatibility
        specType: service.specType,
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
      })
      .returning()

    // Add the service version relationship using the join table
    await addServiceVersionToFixture(
      db,
      newFixture.id,
      tenantId,
      proposal.service,
      proposal.serviceVersion
    )

    const fixture: Fixture = {
      id: newFixture.id,
      service: newFixture.service,
      serviceVersion: newFixture.serviceVersion,
      serviceVersions: newFixture.serviceVersions as string[],
      specType: newFixture.specType,
      operation: newFixture.operation,
      status: newFixture.status as 'draft' | 'approved' | 'rejected',
      source: newFixture.source as 'consumer' | 'provider' | 'manual',
      priority: newFixture.priority,
      data: newFixture.data as FixtureData,
      createdFrom: newFixture.createdFrom as FixtureCreation,
      createdAt: newFixture.createdAt,
      approvedBy: newFixture.approvedBy || undefined,
      approvedAt: newFixture.approvedAt || undefined,
      notes: newFixture.notes || undefined,
    }

    // Broadcast WebSocket event for fixture creation
    try {
      await NotificationService.broadcastFixtureEvent(
        tenantId,
        'create',
        {
          id: newFixture.id,
          service: newFixture.service,
          operation: newFixture.operation,
          status: newFixture.status,
          version: newFixture.serviceVersion,
        },
        { env: c.env || c.get('env') }
      )
    } catch (err) {
      console.error('Notification broadcast failed (fixture create):', err)
    }

    return c.json(fixture, 201)
  } catch (error: unknown) {
    // Handle unique constraint violation (race condition)
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === '23505' &&
      'constraint' in error &&
      typeof error.constraint === 'string' &&
      error.constraint.includes('tenant_hash_unique')
    ) {
      const existingFixture = await db.query.fixtures.findFirst({
        where: and(eq(fixtures.tenantId, tenantId), eq(fixtures.hash, hash)),
      })

      if (existingFixture) {
        // Add the service version to the fixture using the join table
        await addServiceVersionToFixture(
          db,
          existingFixture.id,
          tenantId,
          proposal.service,
          proposal.serviceVersion
        )

        // Get existing service versions array, handling null case for pre-migration fixtures
        const existingVersions = (existingFixture.serviceVersions as string[]) || []

        // Check if the current version is already in the array (for backward compatibility)
        if (!existingVersions.includes(proposal.serviceVersion)) {
          // Add the new version to the array for backward compatibility
          const updatedVersions = [...existingVersions, proposal.serviceVersion]

          // Update the fixture with the new version added (keeping backward compatibility)
          await db
            .update(fixtures)
            .set({
              serviceVersions: updatedVersions,
              serviceVersion: proposal.serviceVersion, // Update latest version for backward compatibility
            })
            .where(eq(fixtures.id, existingFixture.id))
        }

        const fixture: Fixture = {
          id: existingFixture.id,
          service: existingFixture.service,
          serviceVersion: proposal.serviceVersion, // Use the current proposal version
          serviceVersions: existingVersions.includes(proposal.serviceVersion)
            ? existingVersions
            : [...existingVersions, proposal.serviceVersion],
          specType: existingFixture.specType,
          operation: existingFixture.operation,
          status: existingFixture.status as 'draft' | 'approved' | 'rejected',
          source: existingFixture.source as 'consumer' | 'provider' | 'manual',
          priority: existingFixture.priority,
          data: existingFixture.data as FixtureData,
          createdFrom: existingFixture.createdFrom as FixtureCreation,
          createdAt: existingFixture.createdAt,
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
fixturesRouter.get('/', async c => {
  const service = c.req.query('service')
  const provider = c.req.query('provider')
  const consumer = c.req.query('consumer')
  const status = c.req.query('status')

  const db = c.get('db')
  const { tenantId } = c.get('session')

  const whereConditions = [eq(fixtures.tenantId, tenantId)]

  // Filter by status if provided
  if (status) {
    whereConditions.push(eq(fixtures.status, status as 'draft' | 'approved' | 'rejected'))
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
    serviceVersions: f.serviceVersions as string[],
    specType: f.specType,
    operation: f.operation,
    status: f.status as 'draft' | 'approved' | 'rejected',
    source: f.source as 'consumer' | 'provider' | 'manual',
    priority: f.priority,
    data: f.data as FixtureData,
    createdFrom: f.createdFrom as FixtureCreation,
    createdAt: f.createdAt,
    approvedBy: f.approvedBy || undefined,
    approvedAt: f.approvedAt || undefined,
    notes: f.notes || undefined,
  }))

  return c.json(fixturesList)
})

// Get pending fixtures (legacy endpoint - now wraps the main endpoint)
fixturesRouter.get('/pending', async c => {
  const service = c.req.query('service')
  const provider = c.req.query('provider')
  const consumer = c.req.query('consumer')

  const db = c.get('db')
  const { tenantId } = c.get('session')

  const whereConditions = [eq(fixtures.tenantId, tenantId), eq(fixtures.status, 'draft')]

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
    serviceVersions: f.serviceVersions as string[],
    specType: f.specType,
    operation: f.operation,
    status: f.status as 'draft' | 'approved' | 'rejected',
    source: f.source as 'consumer' | 'provider' | 'manual',
    priority: f.priority,
    data: f.data as FixtureData,
    createdFrom: f.createdFrom as FixtureCreation,
    createdAt: f.createdAt,
    approvedBy: f.approvedBy || undefined,
    approvedAt: f.approvedAt || undefined,
    notes: f.notes || undefined,
  }))

  return c.json(fixturesList)
})

// Get fixtures by service
fixturesRouter.get('/service/:service', async c => {
  const service = c.req.param('service')
  const version = c.req.query('version')
  const status = c.req.query('status') || 'approved'

  const db = c.get('db')
  const { tenantId } = c.get('session')

  const whereConditions = [
    eq(fixtures.tenantId, tenantId),
    eq(fixtures.service, service),
    eq(fixtures.status, status as 'draft' | 'approved' | 'rejected'),
  ]

  if (version) {
    // Use the join table to find fixtures for this version
    // First find the service version ID, then join with fixture_service_versions
    whereConditions.push(
      sql`EXISTS (
        SELECT 1 FROM fixture_service_versions fsv
        JOIN service_versions sv ON fsv.service_version_id = sv.id
        JOIN services s ON sv.service_id = s.id
        WHERE fsv.fixture_id = ${fixtures.id}
        AND s.name = ${service}
        AND sv.version = ${version}
        AND sv.tenant_id = ${tenantId}
      )`
    )
  }

  const dbFixtures = await db.query.fixtures.findMany({
    where: and(...whereConditions),
    orderBy: [asc(fixtures.operation), desc(fixtures.priority)],
  })

  const fixturesList: Fixture[] = dbFixtures.map(f => ({
    id: f.id,
    service: f.service,
    serviceVersion: f.serviceVersion,
    serviceVersions: f.serviceVersions as string[],
    specType: f.specType,
    operation: f.operation,
    status: f.status as 'draft' | 'approved' | 'rejected',
    source: f.source as 'consumer' | 'provider' | 'manual',
    priority: f.priority,
    data: f.data as FixtureData,
    createdFrom: f.createdFrom as FixtureCreation,
    createdAt: f.createdAt,
    approvedBy: f.approvedBy || undefined,
    approvedAt: f.approvedAt || undefined,
    notes: f.notes || undefined,
  }))

  return c.json(fixturesList)
})

// Get fixture by ID
fixturesRouter.get('/by-id/:id', async c => {
  const fixtureId = c.req.param('id')

  const db = c.get('db')
  const { tenantId } = c.get('session')

  const dbFixture = await db.query.fixtures.findFirst({
    where: and(eq(fixtures.tenantId, tenantId), eq(fixtures.id, fixtureId)),
  })

  if (!dbFixture) {
    return c.json({ error: 'Fixture not found' }, 404)
  }

  const fixture: Fixture = {
    id: dbFixture.id,
    service: dbFixture.service,
    serviceVersion: dbFixture.serviceVersion,
    serviceVersions: dbFixture.serviceVersions as string[],
    specType: dbFixture.specType,
    operation: dbFixture.operation,
    status: dbFixture.status as 'draft' | 'approved' | 'rejected',
    source: dbFixture.source as 'consumer' | 'provider' | 'manual',
    priority: dbFixture.priority,
    data: dbFixture.data as FixtureData,
    createdFrom: dbFixture.createdFrom as FixtureCreation,
    createdAt: dbFixture.createdAt,
    approvedBy: dbFixture.approvedBy || undefined,
    approvedAt: dbFixture.approvedAt || undefined,
    notes: dbFixture.notes || undefined,
  }

  return c.json(fixture)
})

// Get fixtures for an operation
fixturesRouter.get('/:operation', async c => {
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
      sql`EXISTS (
        SELECT 1 FROM fixture_service_versions fsv
        JOIN service_versions sv ON fsv.service_version_id = sv.id
        JOIN services s ON sv.service_id = s.id
        WHERE fsv.fixture_id = ${fixtures.id}
        AND s.name = ${service}
        AND sv.version = ${version}
        AND sv.tenant_id = ${tenantId}
      )`,
      eq(fixtures.status, status as 'draft' | 'approved' | 'rejected')
    ),
    orderBy: [desc(fixtures.priority), desc(fixtures.createdAt)],
  })

  const fixturesList: Fixture[] = dbFixtures.map(f => ({
    id: f.id,
    service: f.service,
    serviceVersion: f.serviceVersion,
    serviceVersions: f.serviceVersions as string[],
    specType: f.specType,
    operation: f.operation,
    status: f.status as 'draft' | 'approved' | 'rejected',
    source: f.source as 'consumer' | 'provider' | 'manual',
    priority: f.priority,
    data: f.data as FixtureData,
    createdFrom: f.createdFrom as FixtureCreation,
    createdAt: f.createdAt,
    approvedBy: f.approvedBy || undefined,
    approvedAt: f.approvedAt || undefined,
    notes: f.notes || undefined,
  }))

  return c.json(fixturesList)
})

// Approve a fixture
fixturesRouter.post('/:id/approve', async c => {
  const fixtureId = c.req.param('id')
  const { approvedBy, notes } = await c.req.json()

  if (!approvedBy) {
    return c.json({ error: 'approvedBy is required' }, 400)
  }

  const db = c.get('db')
  const { tenantId } = c.get('session')

  const [updatedFixture] = await db
    .update(fixtures)
    .set({
      status: 'approved',
      approvedBy,
      approvedAt: new Date(),
      notes: notes,
    })
    .where(and(eq(fixtures.tenantId, tenantId), eq(fixtures.id, fixtureId)))
    .returning()

  if (!updatedFixture) {
    return c.json({ error: 'Fixture not found' }, 404)
  }

  const fixture: Fixture = {
    id: updatedFixture.id,
    service: updatedFixture.service,
    serviceVersion: updatedFixture.serviceVersion,
    serviceVersions: (updatedFixture.serviceVersions as string[]) || [
      updatedFixture.serviceVersion,
    ],
    specType: updatedFixture.specType,
    operation: updatedFixture.operation,
    status: updatedFixture.status as 'draft' | 'approved' | 'rejected',
    source: updatedFixture.source as 'consumer' | 'provider' | 'manual',
    priority: updatedFixture.priority,
    data: updatedFixture.data as FixtureData,
    createdFrom: updatedFixture.createdFrom as FixtureCreation,
    createdAt: updatedFixture.createdAt,
    approvedBy: updatedFixture.approvedBy || undefined,
    approvedAt: updatedFixture.approvedAt || undefined,
    notes: updatedFixture.notes || undefined,
  }

  return c.json(fixture)
})

// Update a fixture
fixturesRouter.put('/:id', async c => {
  const fixtureId = c.req.param('id')
  const updates: FixtureUpdate = await c.req.json()

  // Validate fixture data if provided
  if (updates.data && !validateFixtureData(updates.data)) {
    return c.json({ error: 'Invalid fixture data' }, 400)
  }

  const db = c.get('db')
  const { tenantId } = c.get('session')

  const updateData: Partial<{
    status: 'draft' | 'approved' | 'rejected'
    priority: number
    data: FixtureData
    notes: string
  }> = {}
  if (updates.status) updateData.status = updates.status
  if (updates.priority !== undefined) updateData.priority = updates.priority
  if (updates.data) updateData.data = updates.data
  if (updates.notes !== undefined) updateData.notes = updates.notes

  const [updatedFixture] = await db
    .update(fixtures)
    .set(updateData)
    .where(and(eq(fixtures.tenantId, tenantId), eq(fixtures.id, fixtureId)))
    .returning()

  if (!updatedFixture) {
    return c.json({ error: 'Fixture not found' }, 404)
  }

  const fixture: Fixture = {
    id: updatedFixture.id,
    service: updatedFixture.service,
    serviceVersion: updatedFixture.serviceVersion,
    serviceVersions: (updatedFixture.serviceVersions as string[]) || [
      updatedFixture.serviceVersion,
    ],
    specType: updatedFixture.specType,
    operation: updatedFixture.operation,
    status: updatedFixture.status as 'draft' | 'approved' | 'rejected',
    source: updatedFixture.source as 'consumer' | 'provider' | 'manual',
    priority: updatedFixture.priority,
    data: updatedFixture.data as FixtureData,
    createdFrom: updatedFixture.createdFrom as FixtureCreation,
    createdAt: updatedFixture.createdAt,
    approvedBy: updatedFixture.approvedBy || undefined,
    approvedAt: updatedFixture.approvedAt || undefined,
    notes: updatedFixture.notes || undefined,
  }

  return c.json(fixture)
})

// Reject a fixture
fixturesRouter.post('/:id/reject', async c => {
  const fixtureId = c.req.param('id')
  const { rejectedBy, notes } = await c.req.json()

  if (!rejectedBy) {
    return c.json({ error: 'rejectedBy is required' }, 400)
  }

  const db = c.get('db')
  const { tenantId } = c.get('session')

  const [updatedFixture] = await db
    .update(fixtures)
    .set({
      status: 'rejected',
      approvedBy: rejectedBy,
      approvedAt: new Date(),
      notes: notes,
    })
    .where(
      and(eq(fixtures.tenantId, tenantId), eq(fixtures.id, fixtureId), eq(fixtures.status, 'draft'))
    )
    .returning()

  if (!updatedFixture) {
    return c.json({ error: 'Fixture not found or not in draft status' }, 404)
  }

  const fixture: Fixture = {
    id: updatedFixture.id,
    service: updatedFixture.service,
    serviceVersion: updatedFixture.serviceVersion,
    serviceVersions: (updatedFixture.serviceVersions as string[]) || [
      updatedFixture.serviceVersion,
    ],
    specType: updatedFixture.specType,
    operation: updatedFixture.operation,
    status: updatedFixture.status as 'draft' | 'approved' | 'rejected',
    source: updatedFixture.source as 'consumer' | 'provider' | 'manual',
    priority: updatedFixture.priority,
    data: updatedFixture.data as FixtureData,
    createdFrom: updatedFixture.createdFrom as FixtureCreation,
    createdAt: updatedFixture.createdAt,
    approvedBy: updatedFixture.approvedBy || undefined,
    approvedAt: updatedFixture.approvedAt || undefined,
    notes: updatedFixture.notes || undefined,
  }

  return c.json(fixture)
})

// Revoke a fixture (change from approved to rejected)
fixturesRouter.post('/:id/revoke', async c => {
  const fixtureId = c.req.param('id')
  const { revokedBy, notes } = await c.req.json()

  if (!revokedBy) {
    return c.json({ error: 'revokedBy is required' }, 400)
  }

  const db = c.get('db')
  const { tenantId } = c.get('session')

  const [updatedFixture] = await db
    .update(fixtures)
    .set({
      status: 'rejected',
      approvedBy: revokedBy,
      approvedAt: new Date(),
      notes: notes,
    })
    .where(
      and(
        eq(fixtures.tenantId, tenantId),
        eq(fixtures.id, fixtureId),
        eq(fixtures.status, 'approved')
      )
    )
    .returning()

  if (!updatedFixture) {
    return c.json({ error: 'Fixture not found or not in approved status' }, 404)
  }

  const fixture: Fixture = {
    id: updatedFixture.id,
    service: updatedFixture.service,
    serviceVersion: updatedFixture.serviceVersion,
    serviceVersions: (updatedFixture.serviceVersions as string[]) || [
      updatedFixture.serviceVersion,
    ],
    specType: updatedFixture.specType,
    operation: updatedFixture.operation,
    status: updatedFixture.status as 'draft' | 'approved' | 'rejected',
    source: updatedFixture.source as 'consumer' | 'provider' | 'manual',
    priority: updatedFixture.priority,
    data: updatedFixture.data as FixtureData,
    createdFrom: updatedFixture.createdFrom as FixtureCreation,
    createdAt: updatedFixture.createdAt,
    approvedBy: updatedFixture.approvedBy || undefined,
    approvedAt: updatedFixture.approvedAt || undefined,
    notes: updatedFixture.notes || undefined,
  }

  return c.json(fixture)
})

// Delete a fixture
fixturesRouter.delete('/:id', async c => {
  const fixtureId = c.req.param('id')

  const db = c.get('db')
  const { tenantId } = c.get('session')

  const deletedFixtures = await db
    .delete(fixtures)
    .where(and(eq(fixtures.tenantId, tenantId), eq(fixtures.id, fixtureId)))
    .returning()

  if (deletedFixtures.length === 0) {
    return c.json({ error: 'Fixture not found' }, 404)
  }

  return c.json({ status: 'deleted' })
})

// Get normalized fixtures for provider testing
fixturesRouter.get('/normalized/:service/:version', async c => {
  const service = c.req.param('service')
  const version = c.req.param('version')

  const db = c.get('db')
  const { tenantId } = c.get('session')

  // Get all approved fixtures for this service and version
  const dbFixtures = await db.query.fixtures.findMany({
    where: and(
      eq(fixtures.tenantId, tenantId),
      eq(fixtures.service, service),
      sql`EXISTS (
        SELECT 1 FROM fixture_service_versions fsv
        JOIN service_versions sv ON fsv.service_version_id = sv.id
        JOIN services s ON sv.service_id = s.id
        WHERE fsv.fixture_id = ${fixtures.id}
        AND s.name = ${service}
        AND sv.version = ${version}
        AND sv.tenant_id = ${tenantId}
      )`,
      eq(fixtures.status, 'approved')
    ),
    orderBy: [desc(fixtures.priority), desc(fixtures.createdAt)],
  })

  const fixturesList: Fixture[] = dbFixtures.map(f => ({
    id: f.id,
    service: f.service,
    serviceVersion: f.serviceVersion,
    serviceVersions: f.serviceVersions as string[],
    specType: f.specType,
    operation: f.operation,
    status: f.status as 'draft' | 'approved' | 'rejected',
    source: f.source as 'consumer' | 'provider' | 'manual',
    priority: f.priority,
    data: f.data as FixtureData,
    createdFrom: f.createdFrom as FixtureCreation,
    createdAt: f.createdAt,
    approvedBy: f.approvedBy || undefined,
    approvedAt: f.approvedAt || undefined,
    notes: f.notes || undefined,
  }))

  // Normalize fixtures into entities
  const normalizedFixtures = normalizeFixtures(fixturesList, service, version)

  return c.json(normalizedFixtures)
})

// Batch upload fixtures
fixturesRouter.post('/batch', async c => {
  const { fixtures: fixtureProposals }: BatchFixtureUpload = await c.req.json()

  if (!Array.isArray(fixtureProposals) || fixtureProposals.length === 0) {
    return c.json({ error: 'Fixtures array is required and must not be empty' }, 400)
  }

  const db = c.get('db')
  const { tenantId } = c.get('session')

  const results: BatchFixtureResult['results'] = []
  let created = 0
  let duplicates = 0
  let errors = 0

  for (const proposal of fixtureProposals) {
    try {
      // Validate fixture data
      if (!validateFixtureData(proposal.data)) {
        results.push({
          status: 'error',
          error: 'Invalid fixture data',
        })
        errors++
        continue
      }

      if (!proposal.service || !proposal.operation) {
        results.push({
          status: 'error',
          error: 'Missing required fields',
        })
        errors++
        continue
      }

      // Get the provider service to obtain its specType
      const service = await db.query.services.findFirst({
        where: and(
          eq(services.tenantId, tenantId),
          eq(services.name, proposal.service)
        ),
      })

      if (!service) {
        results.push({
          status: 'error',
          error: `Provider service '${proposal.service}' not found`,
        })
        errors++
        continue
      }

      if (!service.specType) {
        results.push({
          status: 'error',
          error: `Provider service '${proposal.service}' has no specType`,
        })
        errors++
        continue
      }

      // Generate hash for deduplication
      const hash = await generateFixtureHash(proposal.operation, proposal.data)

      // Check if fixture already exists
      const existing = await db.query.fixtures.findFirst({
        where: and(
          eq(fixtures.tenantId, tenantId),
          eq(fixtures.hash, hash),
          eq(fixtures.service, proposal.service),
          eq(fixtures.serviceVersion, proposal.serviceVersion),
          eq(fixtures.operation, proposal.operation)
        ),
      })

      if (existing) {
        results.push({
          fixtureId: existing.id,
          status: 'duplicate',
        })
        duplicates++
        continue
      }

      // Create fixture
      const [newFixture] = await db
        .insert(fixtures)
        .values({
          tenantId,
          service: proposal.service,
          serviceVersion: proposal.serviceVersion,
          serviceVersions: [proposal.serviceVersion], // Initialize with current version
          specType: service.specType,
          operation: proposal.operation,
          source: proposal.source,
          status: 'draft',
          priority: proposal.priority || 1,
          data: proposal.data,
          createdFrom: proposal.createdFrom,
          hash,
          notes:
            proposal.notes ||
            `Batch uploaded fixture for ${proposal.service}@${proposal.serviceVersion}`,
        })
        .returning()

      // Add service version association
      await addServiceVersionToFixture(
        db,
        newFixture.id,
        tenantId,
        proposal.service,
        proposal.serviceVersion
      )

      results.push({
        fixtureId: newFixture.id,
        status: 'created',
      })
      created++

      console.log(
        `📋 Batch created fixture ${newFixture.id} for ${proposal.service}@${proposal.serviceVersion}:${proposal.operation}`
      )
    } catch (error) {
      console.error('Error creating fixture:', error)
      results.push({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      errors++
    }
  }

  const result: BatchFixtureResult = {
    total: fixtureProposals.length,
    created,
    duplicates,
    errors,
    results,
  }

  console.log(
    `✅ Batch fixture upload completed: ${created} created, ${duplicates} duplicates, ${errors} errors`
  )

  return c.json(result)
})

// Service fixtures summary (counts per service by status)
fixturesRouter.get('/services/summary', async c => {
  const db = c.get('db')
  const { tenantId } = c.get('session')

  try {
    // Use raw SQL for filtered counts per status
    const result = await db.execute(sql`SELECT service,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE status = 'draft') AS draft,
      COUNT(*) FILTER (WHERE status = 'approved') AS approved,
      COUNT(*) FILTER (WHERE status = 'rejected') AS rejected
      FROM fixtures
      WHERE tenant_id = ${tenantId}
      GROUP BY service
      ORDER BY draft DESC, total DESC`)

    // drizzle-orm execute returns rows property
    // Normalize row access across drivers
    // @ts-ignore
    const rows = result.rows || result

    const summary = rows.map((r: any) => ({
      service: r.service,
      total: Number(r.total),
      draft: Number(r.draft),
      approved: Number(r.approved),
      rejected: Number(r.rejected),
    }))

    return c.json(summary)
  } catch (error) {
    console.error('Service fixtures summary error:', error)
    return c.json({ error: 'Failed to fetch fixtures summary' }, 500)
  }
})

// Repair existing fixtures - add missing service version relationships
fixturesRouter.post('/repair-service-versions', async c => {
  const db = c.get('db')
  const { tenantId } = c.get('session')

  // Get all fixtures that don't have service version relationships
  const fixturesWithoutRelations = await db.query.fixtures.findMany({
    where: eq(fixtures.tenantId, tenantId),
  })

  let repaired = 0
  let errors = 0

  for (const fixture of fixturesWithoutRelations) {
    try {
      // Check if relationship already exists
      const existingRelation = await db.query.fixtureServiceVersions.findFirst({
        where: eq(fixtureServiceVersions.fixtureId, fixture.id),
      })

      if (!existingRelation) {
        // Add the service version relationship
        await addServiceVersionToFixture(
          db,
          fixture.id,
          tenantId,
          fixture.service,
          fixture.serviceVersion
        )
        repaired++
        console.log(
          `✅ Repaired fixture ${fixture.id} for ${fixture.service}@${fixture.serviceVersion}`
        )
      }
    } catch (error) {
      console.error(`❌ Failed to repair fixture ${fixture.id}:`, error)
      errors++
    }
  }

  console.log(`🔧 Repair completed: ${repaired} fixtures repaired, ${errors} errors`)

  return c.json({
    message: `Repaired ${repaired} fixtures with ${errors} errors`,
    repaired,
    errors,
    total: fixturesWithoutRelations.length,
  })
})
