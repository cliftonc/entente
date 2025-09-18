import type {
  ClientInteraction,
  HTTPRequest,
  VerificationResult,
  VerificationResults,
  VerificationTask,
} from '@entente/types'
import { Hono } from 'hono'

import { and, count, desc, eq, gte, isNull, lte } from 'drizzle-orm'
import {
  interactions,
  serviceDependencies,
  services,
  verificationResults,
  verificationTasks,
} from '../../db/schema'
import { NotificationService } from '../services/notification'

export const verificationRouter = new Hono()

// Get verification result by ID
verificationRouter.get('/result/:id', async c => {
  const id = c.req.param('id')
  const db = c.get('db')
  const { tenantId } = c.get('session')

  const dbResult = await db
    .select({
      id: verificationResults.id,
      provider: verificationResults.provider,
      providerVersion: verificationResults.providerVersion,
      taskId: verificationResults.taskId,
      submittedAt: verificationResults.submittedAt,
      results: verificationResults.results,
      // Provider git info
      providerGitSha: verificationResults.providerGitSha,
      providerGitRepositoryUrl: services.gitRepositoryUrl,
      // Consumer info directly from verification results
      consumer: verificationResults.consumer,
      consumerVersion: verificationResults.consumerVersion,
      consumerGitSha: verificationResults.consumerGitSha,
      // Fallback to task info if result fields are null (backward compatibility)
      taskConsumer: verificationTasks.consumer,
      taskConsumerVersion: verificationTasks.consumerVersion,
      taskConsumerGitSha: verificationTasks.consumerGitSha,
      // Contract ID from task
      contractId: verificationTasks.contractId,
    })
    .from(verificationResults)
    .leftJoin(verificationTasks, eq(verificationResults.taskId, verificationTasks.id))
    .leftJoin(
      services,
      and(
        eq(services.name, verificationResults.provider),
        eq(services.type, 'provider'),
        eq(services.tenantId, tenantId)
      )
    )
    .where(and(eq(verificationResults.tenantId, tenantId), eq(verificationResults.id, id)))
    .then(results => results[0])

  if (!dbResult) {
    return c.json({ error: 'Verification result not found' }, 404)
  }

  const resultData = dbResult.results as VerificationResult[]
  const total = resultData.length
  const passed = resultData.filter(r => r.success).length

  // Get interaction details for each result
  const enrichedResults = await Promise.all(
    resultData.map(async result => {
      if (result.interactionId) {
        const interaction = await db.query.interactions.findFirst({
          where: and(
            eq(interactions.tenantId, tenantId),
            eq(interactions.id, result.interactionId)
          ),
        })

        return {
          ...result,
          interaction: interaction || undefined,
        }
      }
      return result
    })
  )

  const result = {
    id: dbResult.id,
    provider: dbResult.provider,
    providerVersion: dbResult.providerVersion,
    providerGitSha: dbResult.providerGitSha,
    providerGitRepositoryUrl: dbResult.providerGitRepositoryUrl,
    taskId: dbResult.taskId,
    submittedAt: dbResult.submittedAt,
    status: passed === total ? 'passed' : 'failed',
    total,
    passed,
    failed: total - passed,
    results: enrichedResults,
    // Add consumer information (from results with fallback to task)
    consumer: dbResult.consumer || dbResult.taskConsumer,
    consumerVersion: dbResult.consumerVersion || dbResult.taskConsumerVersion,
    consumerGitSha: dbResult.consumerGitSha || dbResult.taskConsumerGitSha,
    consumerGitRepositoryUrl: null, // TODO: Get from consumer service JOIN
    // Contract ID from task
    contractId: dbResult.contractId,
  }

  return c.json(result)
})

// Get pending verification tasks (tasks without results)
verificationRouter.get('/pending', async c => {
  const db = c.get('db')
  const { tenantId } = c.get('session')
  const limit = Number.parseInt(c.req.query('limit') || '100')

  // Get all verification tasks that don't have results yet
  const pendingTasks = await db
    .select({
      id: verificationTasks.id,
      tenantId: verificationTasks.tenantId,
      contractId: verificationTasks.contractId,
      providerId: verificationTasks.providerId,
      consumerId: verificationTasks.consumerId,
      dependencyId: verificationTasks.dependencyId,
      provider: verificationTasks.provider,
      providerVersion: verificationTasks.providerVersion,
      providerGitSha: verificationTasks.providerGitSha,
      consumer: verificationTasks.consumer,
      consumerVersion: verificationTasks.consumerVersion,
      consumerGitSha: verificationTasks.consumerGitSha,
      environment: verificationTasks.environment,
      interactions: verificationTasks.interactions,
      createdAt: verificationTasks.createdAt,
      // Provider git repository URL
      providerGitRepositoryUrl: services.gitRepositoryUrl,
    })
    .from(verificationTasks)
    .leftJoin(verificationResults, eq(verificationResults.taskId, verificationTasks.id))
    .leftJoin(
      services,
      and(
        eq(services.name, verificationTasks.provider),
        eq(services.type, 'provider'),
        eq(services.tenantId, tenantId)
      )
    )
    .where(
      and(
        eq(verificationTasks.tenantId, tenantId),
        // Only tasks without results
        isNull(verificationResults.id)
      )
    )
    .orderBy(desc(verificationTasks.createdAt))
    .limit(limit)

  const tasks = pendingTasks.map(task => ({
    id: task.id,
    tenantId: task.tenantId,
    contractId: task.contractId,
    providerId: task.providerId,
    consumerId: task.consumerId,
    dependencyId: task.dependencyId ?? undefined,
    provider: task.provider,
    providerVersion: task.providerVersion,
    providerGitSha: task.providerGitSha,
    providerGitRepositoryUrl: task.providerGitRepositoryUrl,
    consumer: task.consumer,
    consumerVersion: task.consumerVersion,
    consumerGitSha: task.consumerGitSha,
    environment: task.environment,
    interactions: task.interactions,
    createdAt: task.createdAt,
  }))

  return c.json(tasks)
})

// Get all verification results
verificationRouter.get('/', async c => {
  const db = c.get('db')
  const { tenantId } = c.get('session')
  const limit = Number.parseInt(c.req.query('limit') || '10')
  const offset = Number.parseInt(c.req.query('offset') || '0')
  const startDate = c.req.query('startDate')
  const endDate = c.req.query('endDate')

  // Build where conditions for filtering
  const whereConditions = [eq(verificationResults.tenantId, tenantId)]

  if (startDate) {
    // Parse the date string - handle both YYYY-MM-DD format and ISO format
    let startDateTime: Date
    if (startDate.includes('T')) {
      // Already an ISO string, just parse it
      startDateTime = new Date(startDate)
    } else {
      // Date-only format, convert to start of day
      startDateTime = new Date(startDate + 'T00:00:00.000Z')
    }

    if (!isNaN(startDateTime.getTime())) {
      whereConditions.push(gte(verificationResults.submittedAt, startDateTime))
    }
  }

  if (endDate) {
    // Parse the date string - handle both YYYY-MM-DD format and ISO format
    let endDateTime: Date
    if (endDate.includes('T')) {
      // Already an ISO string, just parse it
      endDateTime = new Date(endDate)
    } else {
      // Date-only format, convert to end of day
      endDateTime = new Date(endDate + 'T23:59:59.999Z')
    }

    if (!isNaN(endDateTime.getTime())) {
      whereConditions.push(lte(verificationResults.submittedAt, endDateTime))
    }
  }

  // Get total count for pagination with same filters
  const [totalCountResult] = await db
    .select({ count: count() })
    .from(verificationResults)
    .where(and(...whereConditions))

  const totalCount = totalCountResult.count

  const dbResults = await db
    .select({
      id: verificationResults.id,
      provider: verificationResults.provider,
      providerVersion: verificationResults.providerVersion,
      providerGitSha: verificationResults.providerGitSha,
      taskId: verificationResults.taskId,
      submittedAt: verificationResults.submittedAt,
      results: verificationResults.results,
      // Provider git repository URL
      providerGitRepositoryUrl: services.gitRepositoryUrl,
      // Consumer info directly from verification results
      consumer: verificationResults.consumer,
      consumerVersion: verificationResults.consumerVersion,
      consumerGitSha: verificationResults.consumerGitSha,
      // Fallback to task info if result fields are null (backward compatibility)
      taskConsumer: verificationTasks.consumer,
      taskConsumerVersion: verificationTasks.consumerVersion,
      taskConsumerGitSha: verificationTasks.consumerGitSha,
      // Contract ID from task
      contractId: verificationTasks.contractId,
    })
    .from(verificationResults)
    .leftJoin(verificationTasks, eq(verificationResults.taskId, verificationTasks.id))
    .leftJoin(
      services,
      and(
        eq(services.name, verificationResults.provider),
        eq(services.type, 'provider'),
        eq(services.tenantId, tenantId)
      )
    )
    .where(and(...whereConditions))
    .orderBy(desc(verificationResults.submittedAt))
    .limit(limit)
    .offset(offset)

  const results = dbResults.map(result => {
    const resultData = result.results as VerificationResult[]
    const total = resultData.length
    const passed = resultData.filter(r => r.success).length

    return {
      id: result.id,
      provider: result.provider,
      providerVersion: result.providerVersion,
      providerGitSha: result.providerGitSha,
      providerGitRepositoryUrl: result.providerGitRepositoryUrl,
      taskId: result.taskId,
      submittedAt: result.submittedAt,
      status: passed === total ? 'passed' : 'failed',
      total,
      passed,
      failed: total - passed,
      createdAt: result.submittedAt,
      lastRun: result.submittedAt,
      // Add consumer information (from results with fallback to task)
      consumer: result.consumer || result.taskConsumer,
      consumerVersion: result.consumerVersion || result.taskConsumerVersion,
      consumerGitSha: result.consumerGitSha || result.taskConsumerGitSha,
      consumerGitRepositoryUrl: null, // TODO: Get from consumer service JOIN
      // Contract ID from task
      contractId: result.contractId,
    }
  })

  // Calculate overall statistics (with same date filters)
  const allResults = await db
    .select({
      results: verificationResults.results,
    })
    .from(verificationResults)
    .where(and(...whereConditions))

  const totalVerifications = allResults.length
  let passedVerifications = 0
  let failedVerifications = 0

  for (const result of allResults) {
    const resultData = result.results as VerificationResult[]
    const total = resultData.length
    const passed = resultData.filter(r => r.success).length

    if (passed === total) {
      passedVerifications++
    } else {
      failedVerifications++
    }
  }

  const overallPassRate =
    totalVerifications > 0 ? (passedVerifications / totalVerifications) * 100 : 0

  return c.json({
    results,
    totalCount,
    limit,
    offset,
    hasNextPage: offset + limit < totalCount,
    hasPreviousPage: offset > 0,
    statistics: {
      totalVerifications,
      passedVerifications,
      failedVerifications,
      overallPassRate,
    },
  })
})

// Get recent verification results for dashboard visualization
verificationRouter.get('/recent', async c => {
  const db = c.get('db')
  const { tenantId } = c.get('session')

  // Get recent verification results (last N days by default)
  const days = Number.parseInt(c.req.query('days') || '30')
  const limit = Number.parseInt(c.req.query('limit') || '1000')

  // Calculate cutoff from end of today going back N days (in UTC)
  const endOfToday = new Date()
  endOfToday.setUTCHours(23, 59, 59, 999)
  const daysAgo = new Date(endOfToday.getTime() - days * 24 * 60 * 60 * 1000)

  console.log(`🔍 Querying recent verifications for tenant ${tenantId}`)
  console.log(`📅 Days: ${days}, Limit: ${limit}`)
  console.log(`⏰ End of today: ${endOfToday.toISOString()}`)
  console.log(`⏰ Cutoff date: ${daysAgo.toISOString()}`)

  const recentResults = await db
    .select({
      id: verificationResults.id,
      provider: verificationResults.provider,
      consumer: verificationResults.consumer,
      submittedAt: verificationResults.submittedAt,
      results: verificationResults.results,
      taskConsumer: verificationTasks.consumer,
    })
    .from(verificationResults)
    .leftJoin(verificationTasks, eq(verificationResults.taskId, verificationTasks.id))
    .where(
      and(eq(verificationResults.tenantId, tenantId), gte(verificationResults.submittedAt, daysAgo))
    )
    .orderBy(desc(verificationResults.submittedAt))
    .limit(limit)

  console.log(`📊 Found ${recentResults.length} recent verification results`)

  const formattedResults = recentResults.map(result => {
    const resultData = result.results as VerificationResult[]
    const total = resultData.length
    const passed = resultData.filter(r => r.success).length
    const failed = total - passed

    return {
      id: result.id,
      submittedAt: result.submittedAt,
      status: passed === total ? 'passed' : 'failed',
      provider: result.provider,
      consumer: result.consumer || result.taskConsumer,
      passed,
      failed,
      total,
    }
  })

  return c.json(formattedResults)
})

// Get verification tasks for a provider
verificationRouter.get('/:provider', async c => {
  const provider = c.req.param('provider')
  // Note: Environment parameter ignored - providers verify against ALL consumer interactions

  const db = c.get('db')
  const { tenantId } = c.get('session')

  const whereConditions = [
    eq(verificationTasks.tenantId, tenantId),
    eq(verificationTasks.provider, provider),
  ]

  // Fetch ALL verification tasks regardless of environment
  const dbTasks = await db.query.verificationTasks.findMany({
    where: and(...whereConditions),
    orderBy: desc(verificationTasks.createdAt),
  })

  const tasks: VerificationTask[] = dbTasks.map(task => ({
    id: task.id,
    tenantId: task.tenantId,
    providerId: task.providerId,
    consumerId: task.consumerId,
    dependencyId: task.dependencyId ?? undefined,
    provider: task.provider,
    providerVersion: task.providerVersion,
    consumer: task.consumer,
    consumerVersion: task.consumerVersion,
    consumerGitSha: task.consumerGitSha,
    environment: task.environment,
    interactions: task.interactions as ClientInteraction[],
    createdAt: task.createdAt,
  }))

  console.log(
    `🔍 Retrieved ${tasks.length} verification task(s) for ${provider} (all environments)`
  )

  return c.json(tasks)
})

// Submit verification results
verificationRouter.post('/:provider', async c => {
  const provider = c.req.param('provider')
  const results: VerificationResults = await c.req.json()

  if (!results.providerVersion || !results.results || !results.taskId) {
    return c.json(
      {
        error: 'Missing required verification fields (providerVersion, results, taskId)',
      },
      400
    )
  }

  // Validate taskId is a proper UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(results.taskId)) {
    return c.json(
      {
        error: 'Invalid taskId: must be a valid UUID. Did you fetch verification tasks first?',
      },
      400
    )
  }

  const db = c.get('db')
  const { tenantId } = c.get('session')

  // Get the verification task to find the associated dependency
  const task = await db.query.verificationTasks.findFirst({
    where: and(eq(verificationTasks.tenantId, tenantId), eq(verificationTasks.id, results.taskId)),
  })

  if (!task) {
    return c.json({ error: 'Verification task not found' }, 404)
  }

  // Get the consumer and provider ID
  // Find the consumer service
  const consumer = await db.query.services.findFirst({
    where: and(
      eq(services.tenantId, tenantId),
      eq(services.name, task.consumer),
      eq(services.type, 'consumer')
    ),
  })

  if (!consumer) {
    return c.json({ error: 'Consumer service not found. Register the consumer first.' }, 404)
  }

  // Find the consumer service
  const providerService = await db.query.services.findFirst({
    where: and(
      eq(services.tenantId, tenantId),
      eq(services.name, provider),
      eq(services.type, 'provider')
    ),
  })

  if (!providerService) {
    return c.json({ error: 'Provider service not found. Register the provider first.' }, 404)
  }

  const [newResult] = await db
    .insert(verificationResults)
    .values({
      tenantId,
      provider,
      consumerId: consumer.id,
      providerId: providerService.id,
      providerVersion: results.providerVersion,
      providerGitSha: results.providerGitSha || null,
      consumer: task.consumer,
      consumerVersion: task.consumerVersion,
      consumerGitSha: task.consumerGitSha || null,
      taskId: results.taskId,
      results: results.results,
    })
    .returning()

  const passed = results.results.filter(r => r.success).length
  const total = results.results.length
  const allPassed = passed === total

  // Broadcast WebSocket event for verification result completion
  try {
    await NotificationService.broadcastVerificationEvent(
      tenantId,
      'completed',
      {
        id: newResult.id,
        provider,
        consumer: task.consumer,
        contractId: task.contractId || '',
        status: allPassed ? 'passed' : 'failed',
        providerVersion: results.providerVersion,
        consumerVersion: task.consumerVersion,
      },
      { env: c.env || c.get('env') }
    )
  } catch (err) {
    console.error('Notification broadcast failed (verification completed):', err)
  }

  // Update dependency status based on verification results
  if (task.dependencyId) {
    const newStatus = allPassed ? 'verified' : 'failed'
    // Note: serviceDependencies table structure changed, status field removed
    // Status is now tracked via verificationResults table

    console.log(`📋 Updated dependency ${task.dependencyId} status to ${newStatus}`)
  }

  console.log(`✅ Received verification results for ${provider}: ${passed}/${total} passed`)

  return c.json(
    {
      status: 'received',
      summary: {
        total,
        passed,
        failed: total - passed,
        dependencyStatusUpdated: !!task.dependencyId,
      },
    },
    201
  )
})

// Get verification history for a provider
verificationRouter.get('/:provider/history', async c => {
  const provider = c.req.param('provider')
  const limit = Number.parseInt(c.req.query('limit') || '50')

  const db = c.get('db')
  const { tenantId } = c.get('session')

  const dbHistory = await db
    .select({
      id: verificationResults.id,
      provider: verificationResults.provider,
      providerVersion: verificationResults.providerVersion,
      providerGitSha: verificationResults.providerGitSha,
      taskId: verificationResults.taskId,
      submittedAt: verificationResults.submittedAt,
      results: verificationResults.results,
      providerGitRepositoryUrl: services.gitRepositoryUrl,
      // Consumer info directly from verification results
      consumer: verificationResults.consumer,
      consumerVersion: verificationResults.consumerVersion,
      consumerGitSha: verificationResults.consumerGitSha,
      // Fallback to task info if result fields are null (backward compatibility)
      taskConsumer: verificationTasks.consumer,
      taskConsumerVersion: verificationTasks.consumerVersion,
      taskConsumerGitSha: verificationTasks.consumerGitSha,
    })
    .from(verificationResults)
    .leftJoin(verificationTasks, eq(verificationResults.taskId, verificationTasks.id))
    .leftJoin(
      services,
      and(
        eq(services.name, provider),
        eq(services.type, 'provider'),
        eq(services.tenantId, tenantId)
      )
    )
    .where(
      and(eq(verificationResults.tenantId, tenantId), eq(verificationResults.provider, provider))
    )
    .orderBy(desc(verificationResults.submittedAt))
    .limit(limit)

  const history = dbHistory.map(result => {
    const results = result.results as VerificationResult[]
    const total = results.length
    const passed = results.filter(r => r.success).length

    return {
      id: result.id,
      provider: result.provider,
      providerVersion: result.providerVersion,
      providerGitSha: result.providerGitSha,
      providerGitRepositoryUrl: result.providerGitRepositoryUrl,
      taskId: result.taskId,
      submittedAt: result.submittedAt,
      // Add consumer information (from results with fallback to task)
      consumer: result.consumer || result.taskConsumer,
      consumerVersion: result.consumerVersion || result.taskConsumerVersion,
      consumerGitSha: result.consumerGitSha || result.taskConsumerGitSha,
      summary: {
        total,
        passed,
        failed: total - passed,
      },
    }
  })

  return c.json(history)
})

// Get verification statistics
verificationRouter.get('/:provider/stats', async c => {
  const provider = c.req.param('provider')
  const days = Number.parseInt(c.req.query('days') || '30')

  const db = c.get('db')
  const { tenantId } = c.get('session')
  const daysAgo = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  // Get verification results within the time period
  const recentResults = await db.query.verificationResults.findMany({
    where: and(
      eq(verificationResults.tenantId, tenantId),
      eq(verificationResults.provider, provider),
      gte(verificationResults.submittedAt, daysAgo)
    ),
    orderBy: desc(verificationResults.submittedAt),
  })

  const totalVerifications = recentResults.length
  let totalTests = 0
  let totalPassed = 0
  const uniqueConsumers = new Set<string>()

  for (const result of recentResults) {
    const results = result.results as VerificationResult[]
    totalTests += results.length
    totalPassed += results.filter(r => r.success).length
  }

  // Get unique consumers from verification tasks
  const relatedTasks = await db.query.verificationTasks.findMany({
    where: and(eq(verificationTasks.tenantId, tenantId), eq(verificationTasks.provider, provider)),
    columns: { consumer: true },
  })

  for (const task of relatedTasks) {
    uniqueConsumers.add(task.consumer)
  }

  const averagePassRate = totalTests > 0 ? totalPassed / totalTests : 0

  // Create simplified recent trends (would need more complex grouping for daily trends)
  const recentTrends = recentResults
    .slice(0, 7)
    .map(result => {
      const results = result.results as VerificationResult[]
      const passRate =
        results.length > 0 ? results.filter(r => r.success).length / results.length : 0
      return {
        date: result.submittedAt,
        passRate,
      }
    })
    .reverse()

  const stats = {
    totalVerifications,
    averagePassRate,
    totalInteractionsTested: totalTests,
    uniqueConsumers: uniqueConsumers.size,
    recentTrends,
  }

  return c.json(stats)
})

// Get verification data for a specific contract
verificationRouter.get('/contract/:contractId', async c => {
  const contractId = c.req.param('contractId')
  const db = c.get('db')
  const { tenantId } = c.get('session')

  // Get pending tasks for this contract
  const pendingTasks = await db
    .select({
      id: verificationTasks.id,
      provider: verificationTasks.provider,
      providerVersion: verificationTasks.providerVersion,
      providerGitSha: verificationTasks.providerGitSha,
      consumer: verificationTasks.consumer,
      consumerVersion: verificationTasks.consumerVersion,
      consumerGitSha: verificationTasks.consumerGitSha,
      environment: verificationTasks.environment,
      createdAt: verificationTasks.createdAt,
      interactions: verificationTasks.interactions,
    })
    .from(verificationTasks)
    .leftJoin(verificationResults, eq(verificationResults.taskId, verificationTasks.id))
    .where(
      and(
        eq(verificationTasks.tenantId, tenantId),
        eq(verificationTasks.contractId, contractId),
        isNull(verificationResults.id) // Only tasks without results
      )
    )
    .orderBy(desc(verificationTasks.createdAt))

  // Get completed verification results for this contract
  const completedResults = await db
    .select({
      id: verificationResults.id,
      provider: verificationResults.provider,
      providerVersion: verificationResults.providerVersion,
      providerGitSha: verificationResults.providerGitSha,
      consumer: verificationResults.consumer,
      consumerVersion: verificationResults.consumerVersion,
      consumerGitSha: verificationResults.consumerGitSha,
      taskId: verificationResults.taskId,
      submittedAt: verificationResults.submittedAt,
      results: verificationResults.results,
    })
    .from(verificationResults)
    .leftJoin(verificationTasks, eq(verificationResults.taskId, verificationTasks.id))
    .where(
      and(eq(verificationResults.tenantId, tenantId), eq(verificationTasks.contractId, contractId))
    )
    .orderBy(desc(verificationResults.submittedAt))

  const processedResults = completedResults.map(result => {
    const resultData = result.results as VerificationResult[]
    const total = resultData.length
    const passed = resultData.filter(r => r.success).length

    return {
      id: result.id,
      provider: result.provider,
      providerVersion: result.providerVersion,
      providerGitSha: result.providerGitSha,
      consumer: result.consumer,
      consumerVersion: result.consumerVersion,
      consumerGitSha: result.consumerGitSha,
      taskId: result.taskId,
      submittedAt: result.submittedAt,
      status: passed === total ? 'passed' : 'failed',
      total,
      passed,
      failed: total - passed,
    }
  })

  return c.json({
    pendingTasks,
    completedResults: processedResults,
  })
})

// Get verification results where the specified service is the consumer
verificationRouter.get('/consumer/:consumer/history', async c => {
  const consumer = c.req.param('consumer')
  const limit = Number.parseInt(c.req.query('limit') || '50')

  const db = c.get('db')
  const { tenantId } = c.get('session')

  // Get verification tasks for this consumer first, then get results for those tasks
  const consumerTasks = await db.query.verificationTasks.findMany({
    where: and(eq(verificationTasks.tenantId, tenantId), eq(verificationTasks.consumer, consumer)),
    columns: { id: true },
  })

  if (consumerTasks.length === 0) {
    return c.json([])
  }

  const taskIds = consumerTasks.map(task => task.id)

  // Get verification results for these tasks with provider git info and task details
  const dbHistory = await db
    .select({
      id: verificationResults.id,
      provider: verificationResults.provider,
      providerVersion: verificationResults.providerVersion,
      providerGitSha: verificationResults.providerGitSha,
      taskId: verificationResults.taskId,
      submittedAt: verificationResults.submittedAt,
      results: verificationResults.results,
      providerGitRepositoryUrl: services.gitRepositoryUrl,
      // Get consumer version from the task
      taskConsumerVersion: verificationTasks.consumerVersion,
      taskConsumerGitSha: verificationTasks.consumerGitSha,
    })
    .from(verificationResults)
    .leftJoin(
      services,
      and(
        eq(services.name, verificationResults.provider),
        eq(services.type, 'provider'),
        eq(services.tenantId, tenantId)
      )
    )
    .leftJoin(verificationTasks, eq(verificationResults.taskId, verificationTasks.id))
    .where(eq(verificationResults.tenantId, tenantId))
    .orderBy(desc(verificationResults.submittedAt))
    .limit(limit)

  // Filter results to only include those for our consumer's tasks
  const filteredHistory = dbHistory.filter(result => taskIds.includes(result.taskId))

  const history = filteredHistory.map(result => {
    const results = result.results as VerificationResult[]
    const total = results.length
    const passed = results.filter(r => r.success).length

    return {
      id: result.id,
      provider: result.provider,
      providerVersion: result.providerVersion,
      providerGitSha: result.providerGitSha,
      providerGitRepositoryUrl: result.providerGitRepositoryUrl,
      taskId: result.taskId,
      submittedAt: result.submittedAt,
      consumer,
      consumerVersion: result.taskConsumerVersion || 'latest',
      consumerGitSha: result.taskConsumerGitSha,
      consumerGitRepositoryUrl: null, // Would need to get from consumer service JOIN
      summary: {
        total,
        passed,
        failed: total - passed,
      },
    }
  })

  console.log(`🔍 Retrieved ${history.length} verification results for consumer ${consumer}`)

  return c.json(history)
})
