import { generateInteractionHash } from '@entente/fixtures'
import type { ClientInteraction } from '@entente/types'
import { and, avg, count, desc, eq, gte } from 'drizzle-orm'
import { Hono } from 'hono'
import { interactions, serviceDependencies, services, verificationTasks } from '../../db/schema'

export const interactionsRouter = new Hono()

// Helper function to create/update verification tasks when interactions are recorded
async function createVerificationTaskFromInteraction(
  db: any,
  tenantId: string,
  providerId: string | null,
  consumerId: string | null,
  providerName: string,
  consumerName: string,
  consumerVersion: string,
  environment: string
) {
  // Only create task if we have both provider and consumer IDs
  if (!providerId || !consumerId) {
    console.log(
      `ℹ️  Skipping verification task creation: missing provider (${providerId}) or consumer (${consumerId}) ID`
    )
    return
  }

  // Check if verification task already exists for this consumer version + provider
  const existingTask = await db.query.verificationTasks.findFirst({
    where: and(
      eq(verificationTasks.tenantId, tenantId),
      eq(verificationTasks.consumerId, consumerId),
      eq(verificationTasks.consumerVersion, consumerVersion),
      eq(verificationTasks.providerId, providerId)
    ),
  })

  if (existingTask) {
    // Task already exists, update interactions by fetching latest for this pair
    const allInteractions = await db.query.interactions.findMany({
      where: and(
        eq(interactions.tenantId, tenantId),
        eq(interactions.consumerId, consumerId),
        eq(interactions.providerId, providerId),
        eq(interactions.consumerVersion, consumerVersion)
      ),
      orderBy: desc(interactions.timestamp),
      limit: 100, // Reasonable limit
    })

    await db
      .update(verificationTasks)
      .set({
        interactions: allInteractions,
      })
      .where(eq(verificationTasks.id, existingTask.id))

    console.log(
      `✅ Updated verification task with ${allInteractions.length} interactions for ${consumerName}@${consumerVersion} -> ${providerName}`
    )
  } else {
    // Create new verification task
    const allInteractions = await db.query.interactions.findMany({
      where: and(
        eq(interactions.tenantId, tenantId),
        eq(interactions.consumerId, consumerId),
        eq(interactions.providerId, providerId),
        eq(interactions.consumerVersion, consumerVersion)
      ),
      orderBy: desc(interactions.timestamp),
      limit: 100, // Reasonable limit
    })

    try {
      await db.insert(verificationTasks).values({
        tenantId,
        providerId,
        consumerId,
        provider: providerName,
        providerVersion: 'latest', // Will be set by provider when verifying
        consumer: consumerName,
        consumerVersion,
        environment,
        interactions: allInteractions,
      })

      console.log(
        `✅ Created verification task with ${allInteractions.length} interactions for ${consumerName}@${consumerVersion} -> ${providerName}`
      )
    } catch (error: any) {
      // Handle unique constraint violation (race condition)
      if (error.code === '23505') {
        console.log(
          `📋 Race condition detected for verification task: ${consumerName}@${consumerVersion} -> ${providerName}`
        )
      } else {
        console.error(`⚠️  Failed to create verification task: ${error.message}`)
      }
    }
  }
}

// Helper function to create/update verification tasks when interactions are recorded
async function createDependencyFromInteraction(
  db: any,
  tenantId: string,
  providerId: string | null,
  consumerId: string | null,
  providerName: string,
  consumerName: string,
  consumerVersion: string
) {
  // Only create task if we have both provider and consumer IDs
  if (!providerId || !consumerId) {
    console.log(
      `ℹ️  Skipping dependency creation: missing provider (${providerId}) or consumer (${consumerId}) ID`
    )
    return
  }

  // Check if dependency already exists for this consumer version + provider
  const existingDependency = await db.query.serviceDependencies.findFirst({
    where: and(
      eq(verificationTasks.tenantId, tenantId),
      eq(verificationTasks.consumerId, consumerId),
      eq(verificationTasks.consumerVersion, consumerVersion),
      eq(verificationTasks.providerId, providerId)
    ),
  })

  if (!existingDependency) {
    // Create new dependency
    try {
      await db.insert(serviceDependencies).values({
        tenantId,
        providerId,
        consumerId,
        provider: providerName,
        providerVersion: 'latest', // Will be set by provider when verifying
        consumer: consumerName,
        consumerVersion,
      })

      console.log(
        `✅ Created dependendcy for ${consumerName}@${consumerVersion} -> ${providerName}`
      )
    } catch (error: any) {
      // Handle unique constraint violation (race condition)
      if (error.code === '23505') {
        console.log(
          `📋 Race condition detected for dependency: ${consumerName}@${consumerVersion} -> ${providerName}`
        )
      } else {
        console.error(`⚠️  Failed to create dependency: ${error.message}`)
      }
    }
  }
}

// Get all interactions (for filtering)
interactionsRouter.get('/', async c => {
  const provider = c.req.query('provider')
  const consumer = c.req.query('consumer')
  const environment = c.req.query('environment')
  const limit = Number.parseInt(c.req.query('limit') || '100')

  const { tenantId } = c.get('session')

  const whereConditions = [eq(interactions.tenantId, tenantId)]

  if (provider) whereConditions.push(eq(interactions.service, provider))
  if (consumer) whereConditions.push(eq(interactions.consumer, consumer))
  if (environment) whereConditions.push(eq(interactions.environment, environment))

  const db = c.get('db')

  // Use a SQL query with JOIN to get consumer git repository URL
  const dbInteractions = await db
    .select({
      id: interactions.id,
      service: interactions.service,
      consumer: interactions.consumer,
      consumerVersion: interactions.consumerVersion,
      consumerGitSha: interactions.consumerGitSha,
      environment: interactions.environment,
      operation: interactions.operation,
      request: interactions.request,
      response: interactions.response,
      timestamp: interactions.timestamp,
      duration: interactions.duration,
      clientInfo: interactions.clientInfo,
      consumerGitRepositoryUrl: services.gitRepositoryUrl,
    })
    .from(interactions)
    .leftJoin(
      services,
      and(eq(interactions.consumerId, services.id), eq(services.type, 'consumer'))
    )
    .where(and(...whereConditions))
    .orderBy(desc(interactions.timestamp))
    .limit(limit)

  const clientInteractions: ClientInteraction[] = dbInteractions.map(
    interaction =>
      ({
        id: interaction.id,
        service: interaction.service,
        consumer: interaction.consumer,
        consumerVersion: interaction.consumerVersion,
        consumerGitSha: interaction.consumerGitSha,
        consumerGitRepositoryUrl: interaction.consumerGitRepositoryUrl,
        environment: interaction.environment,
        operation: interaction.operation,
        request: interaction.request as any,
        response: interaction.response as any,
        timestamp: interaction.timestamp,
        duration: interaction.duration,
        clientInfo: interaction.clientInfo as any,
        provider: interaction.service,
      }) as any
  )

  console.log(
    `📋 Retrieved ${clientInteractions.length} interactions with filters: provider=${provider || 'all'}, consumer=${consumer || 'all'}`
  )

  return c.json(clientInteractions)
})

// Get single interaction by ID
interactionsRouter.get('/by-id/:id', async c => {
  const id = c.req.param('id')
  const { tenantId } = c.get('session')

  const db = c.get('db')
  const interaction = await db.query.interactions.findFirst({
    where: and(eq(interactions.tenantId, tenantId), eq(interactions.id, id)),
  })

  if (!interaction) {
    return c.json({ error: 'Interaction not found' }, 404)
  }

  const clientInteraction: ClientInteraction = {
    id: interaction.id,
    service: interaction.service,
    consumer: interaction.consumer,
    consumerVersion: interaction.consumerVersion,
    environment: interaction.environment,
    operation: interaction.operation,
    request: interaction.request as any,
    response: interaction.response as any,
    timestamp: interaction.timestamp,
    duration: interaction.duration,
    clientInfo: interaction.clientInfo as any,
  }

  return c.json(clientInteraction)
})

// Record client interaction
interactionsRouter.post('/', async c => {
  const interaction: ClientInteraction = await c.req.json()

  // Validate interaction data
  if (!interaction.service || !interaction.consumer || !interaction.operation) {
    return c.json({ error: 'Missing required interaction fields' }, 400)
  }

  const db = c.get('db')
  const { tenantId } = c.get('session')

  // Look up provider ID by service name
  const provider = await db.query.services.findFirst({
    where: and(
      eq(services.tenantId, tenantId),
      eq(services.name, interaction.service),
      eq(services.type, 'provider')
    ),
    columns: { id: true },
  })

  // Look up consumer ID by consumer name
  const consumer = await db.query.services.findFirst({
    where: and(
      eq(services.tenantId, tenantId),
      eq(services.name, interaction.consumer),
      eq(services.type, 'consumer')
    ),
    columns: { id: true },
  })

  // Log warnings if provider or consumer not found (they should be registered first)
  if (!provider) {
    console.warn(`⚠️  Provider '${interaction.service}' not found for tenant ${tenantId}`)
  }
  if (!consumer) {
    console.warn(`⚠️  Consumer '${interaction.consumer}' not found for tenant ${tenantId}`)
  }

  // Generate hash for deduplication
  const hash = await generateInteractionHash(
    interaction.service,
    interaction.consumer,
    interaction.consumerVersion,
    interaction.operation,
    interaction.request,
    interaction.response
  )

  // Check if interaction with same hash already exists for this tenant
  const existingInteraction = await db.query.interactions.findFirst({
    where: and(eq(interactions.tenantId, tenantId), eq(interactions.hash, hash)),
  })

  if (existingInteraction) {
    console.log(
      `📋 Duplicate interaction found: ${interaction.consumer} -> ${interaction.service}.${interaction.operation}`
    )

    const clientInteraction: ClientInteraction = {
      id: existingInteraction.id,
      service: existingInteraction.service,
      consumer: existingInteraction.consumer,
      consumerVersion: existingInteraction.consumerVersion,
      environment: existingInteraction.environment,
      operation: existingInteraction.operation,
      request: existingInteraction.request as any,
      response: existingInteraction.response as any,
      timestamp: existingInteraction.timestamp,
      duration: existingInteraction.duration,
      clientInfo: existingInteraction.clientInfo as any,
    }

    return c.json({ status: 'duplicate', interaction: clientInteraction }, 200)
  }

  // Create new interaction if no duplicate found
  try {
    const [newInteraction] = await db
      .insert(interactions)
      .values({
        tenantId,
        providerId: provider?.id || null,
        consumerId: consumer?.id || null,
        service: interaction.service,
        consumer: interaction.consumer,
        consumerVersion: interaction.consumerVersion,
        consumerGitSha: interaction.consumerGitSha || null,
        environment: interaction.environment,
        operation: interaction.operation,
        request: interaction.request,
        response: interaction.response,
        timestamp: new Date(interaction.timestamp),
        duration: interaction.duration,
        clientInfo: interaction.clientInfo,
        hash,
      })
      .returning()

    console.log(
      `📝 Recorded interaction: ${interaction.consumer}${consumer?.id ? ` (${consumer.id})` : ''} -> ${interaction.service}${provider?.id ? ` (${provider.id})` : ''}.${interaction.operation}`
    )

    return c.json({ status: 'recorded', id: newInteraction.id }, 201)
  } catch (error: any) {
    // Handle unique constraint violation (race condition)
    if (error.code === '23505' && error.constraint?.includes('tenant_hash_unique')) {
      console.log(
        `📋 Race condition detected for interaction: ${interaction.consumer} -> ${interaction.service}.${interaction.operation}`
      )

      const existingInteraction = await db.query.interactions.findFirst({
        where: and(eq(interactions.tenantId, tenantId), eq(interactions.hash, hash)),
      })

      if (existingInteraction) {
        const clientInteraction: ClientInteraction = {
          id: existingInteraction.id,
          service: existingInteraction.service,
          consumer: existingInteraction.consumer,
          consumerVersion: existingInteraction.consumerVersion,
          environment: existingInteraction.environment,
          operation: existingInteraction.operation,
          request: existingInteraction.request as any,
          response: existingInteraction.response as any,
          timestamp: existingInteraction.timestamp,
          duration: existingInteraction.duration,
          clientInfo: existingInteraction.clientInfo as any,
        }

        return c.json({ status: 'duplicate', interaction: clientInteraction }, 200)
      }
    }

    // Re-throw if it's not a duplicate key error
    throw error
  }
})

// Get recorded interactions for a service
interactionsRouter.get('/:service', async c => {
  const service = c.req.param('service')
  const version = c.req.query('version')
  const consumer = c.req.query('consumer')
  const environment = c.req.query('environment')

  const { tenantId } = c.get('session')

  const whereConditions = [eq(interactions.tenantId, tenantId), eq(interactions.service, service)]

  // Only filter by version if provided (note: interactions don't have serviceVersion)
  // Version filtering should be done against the services table, not interactions

  if (consumer) whereConditions.push(eq(interactions.consumer, consumer))
  if (environment) whereConditions.push(eq(interactions.environment, environment))

  const db = c.get('db')
  const dbInteractions = await db.query.interactions.findMany({
    where: and(...whereConditions),
    orderBy: desc(interactions.timestamp),
  })

  const clientInteractions: ClientInteraction[] = dbInteractions.map(interaction => ({
    id: interaction.id,
    service: interaction.service,
    consumer: interaction.consumer,
    consumerVersion: interaction.consumerVersion,
    environment: interaction.environment,
    operation: interaction.operation,
    request: interaction.request as any,
    response: interaction.response as any,
    timestamp: interaction.timestamp,
    duration: interaction.duration,
    clientInfo: interaction.clientInfo as any,
  }))

  return c.json(clientInteractions)
})

// Get interaction statistics
interactionsRouter.get('/:service/stats', async c => {
  const service = c.req.param('service')
  const version = c.req.query('version')
  const days = Number.parseInt(c.req.query('days') || '7')

  const { tenantId } = c.get('session')
  const daysAgo = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const whereConditions = [
    eq(interactions.tenantId, tenantId),
    eq(interactions.service, service),
    gte(interactions.timestamp, daysAgo),
  ]

  // Note: interactions don't have serviceVersion - filtering should be against services table

  // Get all interactions within the time period
  const db = c.get('db')
  const allInteractions = await db.query.interactions.findMany({
    where: and(...whereConditions),
    columns: {
      operation: true,
      consumer: true,
      duration: true,
    },
  })

  const totalInteractions = allInteractions.length

  // Calculate average duration
  const totalDuration = allInteractions.reduce((sum, interaction) => sum + interaction.duration, 0)
  const averageDuration = totalInteractions > 0 ? Math.round(totalDuration / totalInteractions) : 0

  // Count unique consumers
  const uniqueConsumers = new Set(allInteractions.map(i => i.consumer)).size

  // Operation breakdown
  const operationCounts = allInteractions.reduce(
    (acc, interaction) => {
      acc[interaction.operation] = (acc[interaction.operation] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  const operationBreakdown = Object.entries(operationCounts)
    .map(([operation, count]) => ({ operation, count }))
    .sort((a, b) => b.count - a.count)

  // Consumer breakdown
  const consumerCounts = allInteractions.reduce(
    (acc, interaction) => {
      acc[interaction.consumer] = (acc[interaction.consumer] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  const consumerBreakdown = Object.entries(consumerCounts)
    .map(([consumer, count]) => ({ consumer, count }))
    .sort((a, b) => b.count - a.count)

  const stats = {
    totalInteractions,
    uniqueConsumers,
    averageDuration,
    operationBreakdown,
    consumerBreakdown,
  }

  return c.json(stats)
})

// Get interactions where the specified service is the consumer (calls made by this consumer)
interactionsRouter.get('/consumer/:consumer', async c => {
  const consumer = c.req.param('consumer')
  const version = c.req.query('version')
  const provider = c.req.query('provider')
  const environment = c.req.query('environment')

  const { tenantId } = c.get('session')

  const whereConditions = [eq(interactions.tenantId, tenantId), eq(interactions.consumer, consumer)]

  // Only filter by version if provided
  if (version && version !== 'latest') {
    whereConditions.push(eq(interactions.consumerVersion, version))
  }

  if (provider) whereConditions.push(eq(interactions.service, provider))
  if (environment) whereConditions.push(eq(interactions.environment, environment))

  const db = c.get('db')
  const dbInteractions = await db.query.interactions.findMany({
    where: and(...whereConditions),
    orderBy: desc(interactions.timestamp),
  })

  const clientInteractions: ClientInteraction[] = dbInteractions.map(interaction => ({
    id: interaction.id,
    service: interaction.service,
    consumer: interaction.consumer,
    consumerVersion: interaction.consumerVersion,
    environment: interaction.environment,
    operation: interaction.operation,
    request: interaction.request as any,
    response: interaction.response as any,
    timestamp: interaction.timestamp,
    duration: interaction.duration,
    clientInfo: interaction.clientInfo as any,
    provider: interaction.service, // Add provider field for consistency
  }))

  console.log(`📋 Retrieved ${clientInteractions.length} consumer interactions for ${consumer}`)

  return c.json(clientInteractions)
})

// Batch record client interactions
interactionsRouter.post('/batch', async c => {
  const incomingInteractions: ClientInteraction[] = await c.req.json()

  if (!Array.isArray(incomingInteractions) || incomingInteractions.length === 0) {
    return c.json({ error: 'Expected array of interactions' }, 400)
  }

  const db = c.get('db')
  const { tenantId } = c.get('session')

  const results = {
    recorded: 0,
    duplicates: 0,
    errors: 0,
  }

  const recordedInteractions: ClientInteraction[] = []
  const consumerProviderPairs = new Set<string>()

  for (const interaction of incomingInteractions) {
    if (!interaction.service || !interaction.consumer || !interaction.operation) {
      results.errors++
      continue
    }

    try {
      // Look up provider and consumer IDs
      const provider = await db.query.services.findFirst({
        where: and(
          eq(services.tenantId, tenantId),
          eq(services.name, interaction.service),
          eq(services.type, 'provider')
        ),
        columns: { id: true },
      })

      const consumer = await db.query.services.findFirst({
        where: and(
          eq(services.tenantId, tenantId),
          eq(services.name, interaction.consumer),
          eq(services.type, 'consumer')
        ),
        columns: { id: true },
      })

      // Generate hash for deduplication
      const hash = await generateInteractionHash(
        interaction.service,
        interaction.consumer,
        interaction.consumerVersion,
        interaction.operation,
        interaction.request,
        interaction.response
      )

      // Check if interaction already exists
      const existingInteraction = await db.query.interactions.findFirst({
        where: and(eq(interactions.tenantId, tenantId), eq(interactions.hash, hash)),
      })

      if (existingInteraction) {
        results.duplicates++

        // Still track consumer-provider pairs for verification task creation even for duplicates
        if (provider?.id && consumer?.id) {
          const pairKey = `${consumer.id}:${interaction.consumerVersion}:${provider.id}`
          consumerProviderPairs.add(pairKey)
        }

        continue
      }

      // Record new interaction
      const [newInteraction] = await db
        .insert(interactions)
        .values({
          tenantId,
          providerId: provider?.id || null,
          consumerId: consumer?.id || null,
          service: interaction.service,
          consumer: interaction.consumer,
          consumerVersion: interaction.consumerVersion,
          consumerGitSha: interaction.consumerGitSha || null,
          environment: interaction.environment,
          operation: interaction.operation,
          request: interaction.request,
          response: interaction.response,
          timestamp: new Date(interaction.timestamp),
          duration: interaction.duration,
          clientInfo: interaction.clientInfo,
          hash,
        })
        .returning()

      recordedInteractions.push({
        ...interaction,
        id: newInteraction.id,
      })

      results.recorded++

      // Track consumer-provider pairs for verification task creation
      if (provider?.id && consumer?.id) {
        const pairKey = `${consumer.id}:${interaction.consumerVersion}:${provider.id}`
        consumerProviderPairs.add(pairKey)
      }
    } catch (error: any) {
      if (error.code === '23505' && error.constraint?.includes('tenant_hash_unique')) {
        results.duplicates++
      } else {
        results.errors++
        console.error(`Failed to record interaction: ${error.message}`)
      }
    }
  }

  // Now create verification tasks for each unique consumer-provider pair
  for (const pairKey of consumerProviderPairs) {
    const [consumerId, consumerVersion, providerId] = pairKey.split(':')

    try {
      // Get provider and consumer names for the task
      const providerData = await db.query.services.findFirst({
        where: eq(services.id, providerId),
        columns: { name: true },
      })

      const consumerData = await db.query.services.findFirst({
        where: eq(services.id, consumerId),
        columns: { name: true },
      })

      if (providerData && consumerData) {
        await createVerificationTaskFromInteraction(
          db,
          tenantId,
          providerId,
          consumerId,
          providerData.name,
          consumerData.name,
          consumerVersion,
          incomingInteractions[0].environment // Use first interaction's environment
        )

        await createDependencyFromInteraction(
          db,
          tenantId,
          providerId,
          consumerId,
          providerData.name,
          consumerData.name,
          consumerVersion
        )
      }
    } catch (error: any) {
      console.error(`Failed to create verification task for ${pairKey}: ${error.message}`)
    }
  }

  console.log(
    `📋 Batch processed ${incomingInteractions.length} interactions: ${results.recorded} recorded, ${results.duplicates} duplicates, ${results.errors} errors`
  )

  return c.json(
    {
      status: 'processed',
      results,
      recordedInteractions,
    },
    201
  )
})
