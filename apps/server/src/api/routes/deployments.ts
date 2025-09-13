import { Hono } from 'hono'
import type { DeploymentState, ActiveVersion } from '@entente/types'

import { deployments } from '../../db/schema'
import { eq, and, ne, desc, count, gte } from 'drizzle-orm'

export const deploymentsRouter = new Hono()

// Update deployment state
deploymentsRouter.post('/', async (c) => {
  const deployment: DeploymentState = await c.req.json()

  if (!deployment.service || !deployment.version || !deployment.environment) {
    return c.json({ error: 'Missing required deployment fields' }, 400)
  }

  const db = c.get('db')
  const { tenantId } = c.get('session')

  await db.insert(deployments).values({
    tenantId,
    service: deployment.service,
    version: deployment.version,
    environment: deployment.environment,
    deployedAt: new Date(deployment.deployedAt || new Date()),
    deployedBy: deployment.deployedBy,
    active: deployment.active,
  })

  // If marking as active, deactivate other versions in same environment
  if (deployment.active) {
    await db.update(deployments)
      .set({ active: false })
      .where(
        and(
          eq(deployments.tenantId, tenantId),
          eq(deployments.service, deployment.service),
          eq(deployments.environment, deployment.environment),
          ne(deployments.version, deployment.version)
        )
      )
  }

  console.log(`🚀 Updated deployment: ${deployment.service}@${deployment.version} in ${deployment.environment} (active: ${deployment.active})`)

  return c.json({ status: 'updated', deployment }, 201)
})

// Get active versions by environment
deploymentsRouter.get('/active', async (c) => {
  const environment = c.req.query('environment')

  if (!environment) {
    return c.json({ error: 'Environment parameter is required' }, 400)
  }

  const db = c.get('db')
  const { tenantId } = c.get('session')

  const activeDeployments = await db.query.deployments.findMany({
    where: and(
      eq(deployments.tenantId, tenantId),
      eq(deployments.environment, environment),
      eq(deployments.active, true)
    ),
    columns: {
      service: true,
      version: true,
      environment: true,
      deployedAt: true,
    },
    orderBy: desc(deployments.deployedAt),
  })

  const activeVersions: ActiveVersion[] = activeDeployments.map(d => ({
    service: d.service,
    version: d.version,
    environment: d.environment,
    deployedAt: d.deployedAt,
  }))

  return c.json(activeVersions)
})

// Get deployment history for a service
deploymentsRouter.get('/:service/history', async (c) => {
  const service = c.req.param('service')
  const environment = c.req.query('environment')
  const limit = parseInt(c.req.query('limit') || '50')

  const db = c.get('db')
  const { tenantId } = c.get('session')

  const whereConditions = [
    eq(deployments.tenantId, tenantId),
    eq(deployments.service, service)
  ]

  if (environment) whereConditions.push(eq(deployments.environment, environment))

  const deploymentHistory = await db.query.deployments.findMany({
    where: and(...whereConditions),
    orderBy: desc(deployments.deployedAt),
    limit,
  })

  const deploymentStates: DeploymentState[] = deploymentHistory.map(d => ({
    service: d.service,
    version: d.version,
    environment: d.environment,
    deployedAt: d.deployedAt,
    deployedBy: d.deployedBy,
    active: d.active,
  }))

  return c.json(deploymentStates)
})

// Get deployment summary for dashboard
deploymentsRouter.get('/summary', async (c) => {
  const db = c.get('db')
  const { tenantId } = c.get('session')

  // Get total active deployments
  const totalActiveResult = await db.select({ count: count() })
    .from(deployments)
    .where(and(
      eq(deployments.tenantId, tenantId),
      eq(deployments.active, true)
    ))

  const totalActiveDeployments = totalActiveResult[0]?.count || 0

  // Get recent deployments (last 24 hours)
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const recentDeployments = await db.query.deployments.findMany({
    where: and(
      eq(deployments.tenantId, tenantId),
      gte(deployments.deployedAt, twentyFourHoursAgo)
    ),
    orderBy: desc(deployments.deployedAt),
    limit: 10,
    columns: {
      service: true,
      version: true,
      environment: true,
      deployedAt: true,
      deployedBy: true,
    },
  })

  // Get environment breakdown (simplified - would need proper groupBy in production)
  const allActiveDeployments = await db.query.deployments.findMany({
    where: and(
      eq(deployments.tenantId, tenantId),
      eq(deployments.active, true)
    ),
    columns: {
      environment: true,
    },
  })

  const environmentCounts = allActiveDeployments.reduce((acc, dep) => {
    acc[dep.environment] = (acc[dep.environment] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const environmentBreakdown = Object.entries(environmentCounts).map(([environment, count]) => ({
    environment,
    count,
  }))

  const summary = {
    totalActiveDeployments: Number(totalActiveDeployments),
    environmentBreakdown,
    recentDeployments,
  }

  return c.json(summary)
})