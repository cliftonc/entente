import { Hono } from 'hono'
import type { VerificationTask, VerificationResults, ClientInteraction } from '@entente/types'

import { verificationTasks, verificationResults, interactions } from '../../db/schema'
import { eq, and, desc, gte, count } from 'drizzle-orm'

export const verificationRouter = new Hono()

// Get verification tasks for a provider
verificationRouter.get('/:provider', async (c) => {
  const provider = c.req.param('provider')
  const environment = c.req.query('environment')

  const db = c.get('db')
  const { tenantId } = c.get('session')

  const whereConditions = [
    eq(verificationTasks.tenantId, tenantId),
    eq(verificationTasks.provider, provider)
  ]

  if (environment) whereConditions.push(eq(verificationTasks.environment, environment))

  const dbTasks = await db.query.verificationTasks.findMany({
    where: and(...whereConditions),
    orderBy: desc(verificationTasks.createdAt),
  })

  const tasks: VerificationTask[] = dbTasks.map(task => ({
    id: task.id,
    provider: task.provider,
    providerVersion: task.providerVersion,
    consumer: task.consumer,
    consumerVersion: task.consumerVersion,
    environment: task.environment,
    interactions: task.interactions as ClientInteraction[],
  }))

  console.log(`🔍 Retrieved ${tasks.length} verification task(s) for ${provider}`)

  return c.json(tasks)
})

// Submit verification results
verificationRouter.post('/:provider', async (c) => {
  const provider = c.req.param('provider')
  const results: VerificationResults = await c.req.json()

  if (!results.providerVersion || !results.results) {
    return c.json({ error: 'Missing required verification fields' }, 400)
  }

  const db = c.get('db')
  const { tenantId } = c.get('session')

  await db.insert(verificationResults).values({
    tenantId,
    provider,
    providerVersion: results.providerVersion,
    taskId: results.taskId,
    results: results.results,
  })

  const passed = results.results.filter(r => r.success).length
  const total = results.results.length

  console.log(`✅ Received verification results for ${provider}: ${passed}/${total} passed`)

  return c.json({ 
    status: 'received',
    summary: {
      total,
      passed,
      failed: total - passed,
    },
  }, 201)
})

// Get verification history for a provider
verificationRouter.get('/:provider/history', async (c) => {
  const provider = c.req.param('provider')
  const limit = parseInt(c.req.query('limit') || '50')

  const db = c.get('db')
  const { tenantId } = c.get('session')

  const dbHistory = await db.query.verificationResults.findMany({
    where: and(
      eq(verificationResults.tenantId, tenantId),
      eq(verificationResults.provider, provider)
    ),
    orderBy: desc(verificationResults.submittedAt),
    limit,
  })

  const history = dbHistory.map(result => {
    const results = result.results as any[]
    const total = results.length
    const passed = results.filter(r => r.success).length

    return {
      id: result.id,
      provider: result.provider,
      providerVersion: result.providerVersion,
      taskId: result.taskId,
      submittedAt: result.submittedAt,
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
verificationRouter.get('/:provider/stats', async (c) => {
  const provider = c.req.param('provider')
  const days = parseInt(c.req.query('days') || '30')

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
  let uniqueConsumers = new Set<string>()

  recentResults.forEach(result => {
    const results = result.results as any[]
    totalTests += results.length
    totalPassed += results.filter(r => r.success).length
  })

  // Get unique consumers from verification tasks
  const relatedTasks = await db.query.verificationTasks.findMany({
    where: and(
      eq(verificationTasks.tenantId, tenantId),
      eq(verificationTasks.provider, provider)
    ),
    columns: { consumer: true },
  })

  relatedTasks.forEach(task => uniqueConsumers.add(task.consumer))

  const averagePassRate = totalTests > 0 ? totalPassed / totalTests : 0

  // Create simplified recent trends (would need more complex grouping for daily trends)
  const recentTrends = recentResults.slice(0, 7).map(result => {
    const results = result.results as any[]
    const passRate = results.length > 0 ? results.filter(r => r.success).length / results.length : 0
    return {
      date: result.submittedAt,
      passRate,
    }
  }).reverse()

  const stats = {
    totalVerifications,
    averagePassRate,
    totalInteractionsTested: totalTests,
    uniqueConsumers: uniqueConsumers.size,
    recentTrends,
  }

  return c.json(stats)
})