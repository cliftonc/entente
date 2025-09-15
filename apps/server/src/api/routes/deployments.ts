import type {
  ActiveVersion,
  ConsumerDeployment,
  DeploymentState,
  ProviderDeployment,
} from '@entente/types'
import { Hono } from 'hono'

import { and, count, desc, eq, gte, ne } from 'drizzle-orm'
import { deployments, services } from '../../db/schema'

export const deploymentsRouter = new Hono()

// Deploy a consumer with dependencies
deploymentsRouter.post('/consumer', async c => {
  const consumerDeployment: ConsumerDeployment = await c.req.json()

  if (!consumerDeployment.name || !consumerDeployment.version || !consumerDeployment.environment) {
    return c.json({ error: 'Missing required fields: name, version, environment' }, 400)
  }

  const db = c.get('db')
  const { tenantId } = c.get('session')

  // Find the consumer service
  const consumer = await db.query.services.findFirst({
    where: and(
      eq(services.tenantId, tenantId),
      eq(services.name, consumerDeployment.name),
      eq(services.type, 'consumer')
    ),
  })

  if (!consumer) {
    return c.json({ error: 'Consumer service not found. Register the consumer first.' }, 404)
  }

  // Create deployment record
  const [deployment] = await db
    .insert(deployments)
    .values({
      tenantId,
      type: 'consumer',
      serviceId: consumer.id,
      service: consumerDeployment.name, // Backward compatibility
      version: consumerDeployment.version,
      gitSha: consumerDeployment.gitSha,
      environment: consumerDeployment.environment,
      deployedAt: new Date(),
      deployedBy: consumerDeployment.deployedBy || 'unknown',
      active: true,
      status: 'successful',
    })
    .returning()

  // Deactivate other versions in same environment
  await db
    .update(deployments)
    .set({ active: false })
    .where(
      and(
        eq(deployments.tenantId, tenantId),
        eq(deployments.serviceId, consumer.id),
        eq(deployments.environment, consumerDeployment.environment),
        ne(deployments.id, deployment.id)
      )
    )

  console.log(
    `🚀 Consumer deployed: ${consumerDeployment.name}@${consumerDeployment.version} in ${consumerDeployment.environment}`
  )

  return c.json(
    {
      status: 'deployed',
      deployment: {
        id: deployment.id,
        type: 'consumer',
        name: consumerDeployment.name,
        version: consumerDeployment.version,
        environment: consumerDeployment.environment,
        deployedAt: deployment.deployedAt,
      },
    },
    201
  )
})

// Deploy a provider
deploymentsRouter.post('/provider', async c => {
  const providerDeployment: ProviderDeployment = await c.req.json()

  if (!providerDeployment.name || !providerDeployment.version || !providerDeployment.environment) {
    return c.json({ error: 'Missing required fields: name, version, environment' }, 400)
  }

  const db = c.get('db')
  const { tenantId } = c.get('session')

  // Find the provider service
  const provider = await db.query.services.findFirst({
    where: and(
      eq(services.tenantId, tenantId),
      eq(services.name, providerDeployment.name),
      eq(services.type, 'provider')
    ),
  })

  if (!provider) {
    return c.json({ error: 'Provider service not found. Register the provider first.' }, 404)
  }

  // Create deployment record
  const [deployment] = await db
    .insert(deployments)
    .values({
      tenantId,
      type: 'provider',
      serviceId: provider.id,
      service: providerDeployment.name, // Backward compatibility
      version: providerDeployment.version,
      gitSha: providerDeployment.gitSha,
      environment: providerDeployment.environment,
      deployedAt: new Date(),
      deployedBy: providerDeployment.deployedBy || 'unknown',
      active: true,
      status: 'successful',
    })
    .returning()

  // Deactivate other versions in same environment
  await db
    .update(deployments)
    .set({ active: false })
    .where(
      and(
        eq(deployments.tenantId, tenantId),
        eq(deployments.serviceId, provider.id),
        eq(deployments.environment, providerDeployment.environment),
        ne(deployments.id, deployment.id)
      )
    )

  console.log(
    `🚀 Provider deployed: ${providerDeployment.name}@${providerDeployment.version} in ${providerDeployment.environment}`
  )

  return c.json(
    {
      status: 'deployed',
      deployment: {
        id: deployment.id,
        type: 'provider',
        name: providerDeployment.name,
        version: providerDeployment.version,
        environment: providerDeployment.environment,
        deployedAt: deployment.deployedAt,
      },
    },
    201
  )
})

// Get active versions by environment
deploymentsRouter.get('/active', async c => {
  const environment = c.req.query('environment')
  const includeInactive = c.req.query('include_inactive') === 'true'

  if (!environment) {
    return c.json({ error: 'Environment parameter is required' }, 400)
  }

  const db = c.get('db')
  const { tenantId } = c.get('session')

  const whereConditions = [
    eq(deployments.tenantId, tenantId),
    eq(deployments.environment, environment),
  ]

  // Only filter by active status if not including inactive deployments
  if (!includeInactive) {
    whereConditions.push(eq(deployments.active, true))
    // Only include successful deployments by default for active deployments
    whereConditions.push(eq(deployments.status, 'successful'))
  }

  const activeDeployments = await db
    .select({
      id: deployments.id,
      type: deployments.type,
      service: deployments.service,
      version: deployments.version,
      gitSha: deployments.gitSha,
      environment: deployments.environment,
      deployedAt: deployments.deployedAt,
      deployedBy: deployments.deployedBy,
      active: deployments.active,
      status: deployments.status,
      failureReason: deployments.failureReason,
      failureDetails: deployments.failureDetails,
      gitRepositoryUrl: services.gitRepositoryUrl,
    })
    .from(deployments)
    .leftJoin(services, eq(deployments.serviceId, services.id))
    .where(and(...whereConditions))
    .orderBy(desc(deployments.deployedAt))

  const activeVersions = activeDeployments.map(d => ({
    id: d.id,
    serviceType: d.type,
    service: d.service,
    version: d.version,
    gitSha: d.gitSha,
    gitRepositoryUrl: d.gitRepositoryUrl,
    environment: d.environment,
    deployedAt: d.deployedAt,
    deployedBy: d.deployedBy,
    active: d.active,
    status: d.status,
    failureReason: d.failureReason,
    failureDetails: d.failureDetails,
  }))

  return c.json(activeVersions)
})

// Get deployment history for a service
deploymentsRouter.get('/:service/history', async c => {
  const service = c.req.param('service')
  const environment = c.req.query('environment')
  const limit = Number.parseInt(c.req.query('limit') || '50')

  const db = c.get('db')
  const { tenantId } = c.get('session')

  const whereConditions = [eq(deployments.tenantId, tenantId), eq(deployments.service, service)]

  if (environment) whereConditions.push(eq(deployments.environment, environment))

  const deploymentHistory = await db.query.deployments.findMany({
    where: and(...whereConditions),
    orderBy: desc(deployments.deployedAt),
    limit,
  })

  const deploymentStates: DeploymentState[] = deploymentHistory.map(d => ({
    id: d.id,
    type: d.type as 'provider' | 'consumer',
    tenantId: d.tenantId,
    service: d.service,
    version: d.version,
    environment: d.environment,
    deployedAt: d.deployedAt,
    deployedBy: d.deployedBy,
    active: d.active,
    status: d.status,
    failureReason: d.failureReason,
    failureDetails: d.failureDetails,
  }))

  return c.json(deploymentStates)
})

// Get deployment summary for dashboard
deploymentsRouter.get('/summary', async c => {
  const db = c.get('db')
  const { tenantId } = c.get('session')

  // Get total active deployments
  const totalActiveResult = await db
    .select({ count: count() })
    .from(deployments)
    .where(and(eq(deployments.tenantId, tenantId), eq(deployments.active, true)))

  const totalActiveDeployments = totalActiveResult[0]?.count || 0

  // Get recent deployments (last 24 hours)
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const recentDeployments = await db.query.deployments.findMany({
    where: and(eq(deployments.tenantId, tenantId), gte(deployments.deployedAt, twentyFourHoursAgo)),
    orderBy: desc(deployments.deployedAt),
    limit: 10,
    columns: {
      service: true,
      version: true,
      environment: true,
      deployedAt: true,
      deployedBy: true,
      status: true,
      failureReason: true,
    },
  })

  // Get environment breakdown (simplified - would need proper groupBy in production)
  const allActiveDeployments = await db.query.deployments.findMany({
    where: and(eq(deployments.tenantId, tenantId), eq(deployments.active, true)),
    columns: {
      environment: true,
    },
  })

  const environmentCounts = allActiveDeployments.reduce(
    (acc, dep) => {
      acc[dep.environment] = (acc[dep.environment] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  const environmentBreakdown = Object.entries(environmentCounts).map(([environment, count]) => ({
    environment,
    count,
  }))

  // Get failed deployment attempts (last 24 hours)
  const failedDeploymentsResult = await db
    .select({ count: count() })
    .from(deployments)
    .where(
      and(
        eq(deployments.tenantId, tenantId),
        eq(deployments.status, 'failed'),
        gte(deployments.deployedAt, twentyFourHoursAgo)
      )
    )

  const failedDeployments = failedDeploymentsResult[0]?.count || 0

  const summary = {
    totalActiveDeployments: Number(totalActiveDeployments),
    failedDeployments: Number(failedDeployments),
    environmentBreakdown,
    recentDeployments,
  }

  return c.json(summary)
})

// Get unique environments
deploymentsRouter.get('/environments', async c => {
  const db = c.get('db')
  const { tenantId } = c.get('session')

  const environments = await db
    .selectDistinct({ environment: deployments.environment })
    .from(deployments)
    .where(eq(deployments.tenantId, tenantId))

  const uniqueEnvironments = environments.map(e => e.environment)

  return c.json(uniqueEnvironments)
})
