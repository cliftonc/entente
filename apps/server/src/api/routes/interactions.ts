import { Hono } from 'hono'
import type { ClientInteraction } from '@entente/types'
import { interactions } from '../../db/schema'
import { eq, and, desc, gte, count, avg } from 'drizzle-orm'

export const interactionsRouter = new Hono()

// Record client interaction
interactionsRouter.post('/', async (c) => {
  const interaction: ClientInteraction = await c.req.json()

  // Validate interaction data
  if (!interaction.service || !interaction.consumer || !interaction.operation) {
    return c.json({ error: 'Missing required interaction fields' }, 400)
  }

  const db = c.get('db')
  const { tenantId } = c.get('session')

  await db.insert(interactions).values({
    tenantId,
    service: interaction.service,
    serviceVersion: interaction.serviceVersion,
    consumer: interaction.consumer,
    consumerVersion: interaction.consumerVersion,
    environment: interaction.environment,
    operation: interaction.operation,
    request: interaction.request,
    response: interaction.response,
    timestamp: new Date(interaction.timestamp),
    duration: interaction.duration,
    clientInfo: interaction.clientInfo,
  })

  console.log(`📝 Recorded interaction: ${interaction.consumer} -> ${interaction.service}.${interaction.operation}`)

  return c.json({ status: 'recorded', id: interaction.id }, 201)
})

// Get recorded interactions for a service
interactionsRouter.get('/:service', async (c) => {
  const service = c.req.param('service')
  const version = c.req.query('version')
  const consumer = c.req.query('consumer')
  const environment = c.req.query('environment')

  if (!version) {
    return c.json({ error: 'Version parameter is required' }, 400)
  }

  const { tenantId } = c.get('session')

  const whereConditions = [
    eq(interactions.tenantId, tenantId),
    eq(interactions.service, service),
    eq(interactions.serviceVersion, version!),
  ]

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
    serviceVersion: interaction.serviceVersion,
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
interactionsRouter.get('/:service/stats', async (c) => {
  const service = c.req.param('service')
  const version = c.req.query('version')
  const days = parseInt(c.req.query('days') || '7')

  const { tenantId } = c.get('session')
  const daysAgo = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const whereConditions = [
    eq(interactions.tenantId, tenantId),
    eq(interactions.service, service),
    gte(interactions.timestamp, daysAgo)
  ]

  if (version) whereConditions.push(eq(interactions.serviceVersion, version))

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
  const operationCounts = allInteractions.reduce((acc, interaction) => {
    acc[interaction.operation] = (acc[interaction.operation] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const operationBreakdown = Object.entries(operationCounts)
    .map(([operation, count]) => ({ operation, count }))
    .sort((a, b) => b.count - a.count)

  // Consumer breakdown
  const consumerCounts = allInteractions.reduce((acc, interaction) => {
    acc[interaction.consumer] = (acc[interaction.consumer] || 0) + 1
    return acc
  }, {} as Record<string, number>)

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