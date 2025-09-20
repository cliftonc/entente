import type { Contract } from '@entente/types'
import { and, count, desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { contracts, interactions, services, specs } from '../../db/schema'
import type { DbConnection } from '../../db/types'
import { NotificationService } from '../services/notification'

export const contractsRouter = new Hono()

// Get all contracts with optional filtering
contractsRouter.get('/', async c => {
  const provider = c.req.query('provider')
  const consumer = c.req.query('consumer')
  const environment = c.req.query('environment')
  const status = c.req.query('status')
  const limit = Number.parseInt(c.req.query('limit') || '10')
  const offset = Number.parseInt(c.req.query('offset') || '0')

  const { tenantId } = c.get('session')
  const db = c.get('db')

  const whereConditions = [eq(contracts.tenantId, tenantId)]

  if (provider) whereConditions.push(eq(contracts.providerName, provider))
  if (consumer) whereConditions.push(eq(contracts.consumerName, consumer))
  if (environment) whereConditions.push(eq(contracts.environment, environment))
  if (status) whereConditions.push(eq(contracts.status, status))

  // Get total count for pagination
  const [totalCountResult] = await db
    .select({ count: count() })
    .from(contracts)
    .where(and(...whereConditions))

  const totalCount = totalCountResult.count

  // Use LEFT JOIN to get contracts with their interaction counts in a single query
  const dbContracts = await db
    .select({
      id: contracts.id,
      tenantId: contracts.tenantId,
      consumerId: contracts.consumerId,
      consumerName: contracts.consumerName,
      consumerVersion: contracts.consumerVersion,
      consumerGitSha: contracts.consumerGitSha,
      providerId: contracts.providerId,
      providerName: contracts.providerName,
      providerVersion: contracts.providerVersion,
      environment: contracts.environment,
      specType: contracts.specType,
      status: contracts.status,
      firstSeen: contracts.firstSeen,
      lastSeen: contracts.lastSeen,
      createdAt: contracts.createdAt,
      updatedAt: contracts.updatedAt,
      interactionCount: count(interactions.id).as('interaction_count'),
    })
    .from(contracts)
    .leftJoin(interactions, eq(contracts.id, interactions.contractId))
    .where(and(...whereConditions))
    .groupBy(
      contracts.id,
      contracts.tenantId,
      contracts.consumerId,
      contracts.consumerName,
      contracts.consumerVersion,
      contracts.consumerGitSha,
      contracts.providerId,
      contracts.providerName,
      contracts.providerVersion,
      contracts.environment,
      contracts.specType,
      contracts.status,
      contracts.firstSeen,
      contracts.lastSeen,
      contracts.createdAt,
      contracts.updatedAt
    )
    .orderBy(desc(contracts.lastSeen))
    .limit(limit)
    .offset(offset)

  const clientContracts: Contract[] = dbContracts.map(contract => ({
    id: contract.id,
    tenantId: contract.tenantId,
    consumerId: contract.consumerId,
    consumerName: contract.consumerName,
    consumerVersion: contract.consumerVersion,
    consumerGitSha: contract.consumerGitSha || undefined,
    providerId: contract.providerId,
    providerName: contract.providerName,
    providerVersion: contract.providerVersion,
    environment: contract.environment,
    specType: contract.specType,
    status: contract.status as 'active' | 'archived' | 'deprecated',
    interactionCount: contract.interactionCount,
    firstSeen: contract.firstSeen,
    lastSeen: contract.lastSeen,
    createdAt: contract.createdAt,
    updatedAt: contract.updatedAt,
  }))

  console.log(
    `📋 Retrieved ${clientContracts.length} contracts with filters: provider=${provider || 'all'}, consumer=${consumer || 'all'}, environment=${environment || 'all'}`
  )

  // Calculate overall statistics (independent of pagination)
  const allContracts = await db
    .select({
      status: contracts.status,
    })
    .from(contracts)
    .where(eq(contracts.tenantId, tenantId))

  const totalContracts = allContracts.length
  const activeContracts = allContracts.filter(c => c.status === 'active').length
  const archivedContracts = allContracts.filter(c => c.status === 'archived').length
  const deprecatedContracts = allContracts.filter(c => c.status === 'deprecated').length

  return c.json({
    results: clientContracts,
    totalCount,
    limit,
    offset,
    hasNextPage: offset + limit < totalCount,
    hasPreviousPage: offset > 0,
    statistics: {
      totalContracts,
      activeContracts,
      archivedContracts,
      deprecatedContracts,
    },
  })
})

// Get single contract by ID
contractsRouter.get('/:id', async c => {
  const id = c.req.param('id')
  const { tenantId } = c.get('session')

  const db = c.get('db')

  // Use LEFT JOIN to get contract with interaction count in a single query
  const [contract] = await db
    .select({
      id: contracts.id,
      tenantId: contracts.tenantId,
      consumerId: contracts.consumerId,
      consumerName: contracts.consumerName,
      consumerVersion: contracts.consumerVersion,
      consumerGitSha: contracts.consumerGitSha,
      providerId: contracts.providerId,
      providerName: contracts.providerName,
      providerVersion: contracts.providerVersion,
      environment: contracts.environment,
      specType: contracts.specType,
      status: contracts.status,
      firstSeen: contracts.firstSeen,
      lastSeen: contracts.lastSeen,
      createdAt: contracts.createdAt,
      updatedAt: contracts.updatedAt,
      interactionCount: count(interactions.id).as('interaction_count'),
    })
    .from(contracts)
    .leftJoin(interactions, eq(contracts.id, interactions.contractId))
    .where(and(eq(contracts.tenantId, tenantId), eq(contracts.id, id)))
    .groupBy(
      contracts.id,
      contracts.tenantId,
      contracts.consumerId,
      contracts.consumerName,
      contracts.consumerVersion,
      contracts.consumerGitSha,
      contracts.providerId,
      contracts.providerName,
      contracts.providerVersion,
      contracts.environment,
      contracts.specType,
      contracts.status,
      contracts.firstSeen,
      contracts.lastSeen,
      contracts.createdAt,
      contracts.updatedAt
    )

  if (!contract) {
    return c.json({ error: 'Contract not found' }, 404)
  }

  const clientContract: Contract = {
    id: contract.id,
    tenantId: contract.tenantId,
    consumerId: contract.consumerId,
    consumerName: contract.consumerName,
    consumerVersion: contract.consumerVersion,
    consumerGitSha: contract.consumerGitSha || undefined,
    providerId: contract.providerId,
    providerName: contract.providerName,
    providerVersion: contract.providerVersion,
    environment: contract.environment,
    specType: contract.specType,
    status: contract.status as 'active' | 'archived' | 'deprecated',
    interactionCount: contract.interactionCount,
    firstSeen: contract.firstSeen,
    lastSeen: contract.lastSeen,
    createdAt: contract.createdAt,
    updatedAt: contract.updatedAt,
  }

  return c.json(clientContract)
})

// Get interactions for a specific contract
contractsRouter.get('/:id/interactions', async c => {
  const id = c.req.param('id')
  const limit = Number.parseInt(c.req.query('limit') || '100')
  const { tenantId } = c.get('session')

  const db = c.get('db')

  // First verify the contract exists and belongs to this tenant
  const contract = await db.query.contracts.findFirst({
    where: and(eq(contracts.tenantId, tenantId), eq(contracts.id, id)),
  })

  if (!contract) {
    return c.json({ error: 'Contract not found' }, 404)
  }

  // Get interactions for this contract
  const dbInteractions = await db.query.interactions.findMany({
    where: and(eq(interactions.tenantId, tenantId), eq(interactions.contractId, id)),
    orderBy: desc(interactions.timestamp),
    limit,
  })

  const clientInteractions = dbInteractions.map(interaction => ({
    id: interaction.id,
    contractId: interaction.contractId || undefined,
    service: interaction.service,
    consumer: interaction.consumer,
    consumerVersion: interaction.consumerVersion,
    consumerGitSha: interaction.consumerGitSha || undefined,
    environment: interaction.environment,
    operation: interaction.operation,
    request: interaction.request,
    response: interaction.response,
    timestamp: interaction.timestamp,
    duration: interaction.duration,
    clientInfo: interaction.clientInfo,
  }))

  console.log(`📋 Retrieved ${clientInteractions.length} interactions for contract ${id}`)

  return c.json(clientInteractions)
})

// Update contract status
contractsRouter.patch('/:id', async c => {
  const id = c.req.param('id')
  const { tenantId } = c.get('session')
  const updates = await c.req.json()

  const db = c.get('db')

  // Validate the contract exists and belongs to this tenant
  const existing = await db.query.contracts.findFirst({
    where: and(eq(contracts.tenantId, tenantId), eq(contracts.id, id)),
  })

  if (!existing) {
    return c.json({ error: 'Contract not found' }, 404)
  }

  // Validate updates
  const allowedUpdates = ['status']
  const updateData: { status?: string; updatedAt?: Date } = { updatedAt: new Date() }

  for (const [key, value] of Object.entries(updates)) {
    if (allowedUpdates.includes(key)) {
      if (key === 'status' && !['active', 'archived', 'deprecated'].includes(value as string)) {
        return c.json({ error: 'Invalid status. Must be active, archived, or deprecated' }, 400)
      }
      if (key === 'status') {
        updateData.status = value as string
      }
    }
  }

  // Perform update
  const [updatedContract] = await db
    .update(contracts)
    .set(updateData)
    .where(and(eq(contracts.tenantId, tenantId), eq(contracts.id, id)))
    .returning()

  // Get the updated contract with interaction count using JOIN
  const [contractWithCount] = await db
    .select({
      id: contracts.id,
      tenantId: contracts.tenantId,
      consumerId: contracts.consumerId,
      consumerName: contracts.consumerName,
      consumerVersion: contracts.consumerVersion,
      consumerGitSha: contracts.consumerGitSha,
      providerId: contracts.providerId,
      providerName: contracts.providerName,
      providerVersion: contracts.providerVersion,
      environment: contracts.environment,
      specType: contracts.specType,
      status: contracts.status,
      firstSeen: contracts.firstSeen,
      lastSeen: contracts.lastSeen,
      createdAt: contracts.createdAt,
      updatedAt: contracts.updatedAt,
      interactionCount: count(interactions.id).as('interaction_count'),
    })
    .from(contracts)
    .leftJoin(interactions, eq(contracts.id, interactions.contractId))
    .where(eq(contracts.id, id))
    .groupBy(
      contracts.id,
      contracts.tenantId,
      contracts.consumerId,
      contracts.consumerName,
      contracts.consumerVersion,
      contracts.consumerGitSha,
      contracts.providerId,
      contracts.providerName,
      contracts.providerVersion,
      contracts.environment,
      contracts.specType,
      contracts.status,
      contracts.firstSeen,
      contracts.lastSeen,
      contracts.createdAt,
      contracts.updatedAt
    )

  const clientContract: Contract = {
    id: contractWithCount.id,
    tenantId: contractWithCount.tenantId,
    consumerId: contractWithCount.consumerId,
    consumerName: contractWithCount.consumerName,
    consumerVersion: contractWithCount.consumerVersion,
    consumerGitSha: contractWithCount.consumerGitSha || undefined,
    providerId: contractWithCount.providerId,
    providerName: contractWithCount.providerName,
    providerVersion: contractWithCount.providerVersion,
    environment: contractWithCount.environment,
    specType: contractWithCount.specType,
    status: contractWithCount.status as 'active' | 'archived' | 'deprecated',
    interactionCount: contractWithCount.interactionCount,
    firstSeen: contractWithCount.firstSeen,
    lastSeen: contractWithCount.lastSeen,
    createdAt: contractWithCount.createdAt,
    updatedAt: contractWithCount.updatedAt,
  }

  console.log(`✅ Updated contract ${id} status to ${updates.status}`)

  // Broadcast WebSocket event for contract update
  try {
    await NotificationService.broadcastContractEvent(
      tenantId,
      'update',
      {
        id: contractWithCount.id,
        provider: contractWithCount.providerName,
        consumer: contractWithCount.consumerName,
      },
      { env: c.env || c.get('env') }
    )
  } catch (err) {
    console.error('Notification broadcast failed (contract update):', err)
  }

  return c.json(clientContract)
})

// This endpoint is no longer needed since we calculate counts dynamically
// Keeping for backward compatibility but it's a no-op
contractsRouter.post('/recalculate-counts', async c => {
  const db = c.get('db')
  const { tenantId } = c.get('session')

  // Get contract count for the tenant
  const [contractCountResult] = await db
    .select({ count: count() })
    .from(contracts)
    .where(eq(contracts.tenantId, tenantId))

  const totalContracts = contractCountResult?.count || 0

  return c.json({
    message: `Interaction counts are now calculated dynamically - no recalculation needed`,
    updated: 0,
    totalContracts,
  })
})

// Helper function to create or update a contract from interaction data
export async function createOrUpdateContract(
  db: DbConnection,
  tenantId: string,
  providerId: string,
  providerName: string,
  consumerId: string,
  consumerName: string,
  consumerVersion: string,
  consumerGitSha: string | null,
  providerVersion: string,
  environment: string,
  env: any
): Promise<string> {
  // Get specType from the provider service
  const providerService = await db.query.services.findFirst({
    where: and(eq(services.tenantId, tenantId), eq(services.id, providerId)),
  })

  if (!providerService) {
    throw new Error(`Provider service with ID ${providerId} not found`)
  }

  if (!providerService.specType) {
    throw new Error(`Provider service ${providerName} has no specType`)
  }

  const specType = providerService.specType

  // Try to find existing contract
  const existingContract = await db.query.contracts.findFirst({
    where: and(
      eq(contracts.tenantId, tenantId),
      eq(contracts.consumerId, consumerId),
      eq(contracts.consumerVersion, consumerVersion),
      eq(contracts.providerId, providerId),
      eq(contracts.providerVersion, providerVersion)
    ),
  })

  if (existingContract) {
    // Just update last seen timestamp - we'll update counts in batch
    await db
      .update(contracts)
      .set({
        lastSeen: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(contracts.id, existingContract.id))

    return existingContract.id
  }

  // Create new contract
  const [newContract] = await db
    .insert(contracts)
    .values({
      tenantId,
      consumerId,
      consumerName,
      consumerVersion,
      consumerGitSha,
      providerId,
      providerName,
      providerVersion,
      environment,
      specType,
      status: 'active',
      firstSeen: new Date(),
      lastSeen: new Date(),
    })
    .returning()

  console.log(
    `✅ Created new contract ${newContract.id} for ${consumerName}@${consumerVersion} -> ${providerName}@${providerVersion}`
  )

  // Broadcast WebSocket event for contract creation
  try {
    await NotificationService.broadcastContractEvent(
      tenantId,
      'create',
      {
        id: newContract.id,
        provider: providerName,
        consumer: consumerName,
      },
      { env }
    )
  } catch (err) {
    console.error('Notification broadcast failed (contract create):', err)
  }

  return newContract.id
}
