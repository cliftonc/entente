import type {
  ActiveVersion,
  ConsumerDeployment,
  DeploymentState,
  DeploymentStatus,
  ProviderDeployment,
  ServiceDeployment,
} from '@entente/types'
import { Hono } from 'hono'

import { and, count, desc, eq, gte, ne, or } from 'drizzle-orm'
import { deployments, services } from '../../db/schema'
import { NotificationService } from '../services/notification'
import { findServiceVersion } from '../utils/service-versions'

export const deploymentsRouter = new Hono()

// Deploy a service (unified endpoint)
deploymentsRouter.post('/', async c => {
  const serviceDeployment: ServiceDeployment = await c.req.json()

  console.log('[DEPLOY SERVICE] Request received:', {
    name: serviceDeployment.name,
    version: serviceDeployment.version,
    environment: serviceDeployment.environment
  })

  if (!serviceDeployment.name || !serviceDeployment.version || !serviceDeployment.environment) {
    console.log('[DEPLOY SERVICE] Missing required fields')
    return c.json({ error: 'Missing required fields: name, version, environment' }, 400)
  }

  const db = c.get('db')
  const auth = c.get('auth')
  const tenantId = auth.tenantId

  console.log('[DEPLOY SERVICE] Auth info:', { tenantId, userId: auth.userId })

  // Find the service
  console.log('[DEPLOY SERVICE] Searching for service:', {
    tenantId,
    name: serviceDeployment.name
  })

  const service = await db.query.services.findFirst({
    where: and(
      eq(services.tenantId, tenantId),
      eq(services.name, serviceDeployment.name)
    ),
  })

  console.log('[DEPLOY SERVICE] Service found:', service ? service.id : 'NOT FOUND')

  if (!service) {
    console.log('[DEPLOY SERVICE] Service not found, returning 404')
    return c.json({ error: 'Service not found. Register the service first.' }, 404)
  }

  // Validate that service version exists
  console.log('[DEPLOY SERVICE] Validating service version:', {
    name: serviceDeployment.name,
    version: serviceDeployment.version
  })

  const serviceVersion = await findServiceVersion(
    db,
    tenantId,
    serviceDeployment.name,
    serviceDeployment.version
  )

  console.log('[DEPLOY SERVICE] Service version found:', serviceVersion ? serviceVersion.id : 'NOT FOUND')

  if (!serviceVersion) {
    console.log('[DEPLOY SERVICE] Service version not found, returning 404')
    return c.json(
      {
        error: `Service version not found: ${serviceDeployment.name}@${serviceDeployment.version}. Please register this version first through service registration or interaction recording.`,
      },
      404
    )
  }

  // Create deployment record
  const [deployment] = await db
    .insert(deployments)
    .values({
      tenantId,
      serviceId: service.id,
      service: serviceDeployment.name,
      version: serviceDeployment.version,
      serviceVersionId: serviceVersion.id,
      gitSha: serviceDeployment.gitSha,
      environment: serviceDeployment.environment,
      deployedAt: new Date(),
      deployedBy: serviceDeployment.deployedBy || 'unknown',
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
        eq(deployments.serviceId, service.id),
        eq(deployments.environment, serviceDeployment.environment),
        ne(deployments.id, deployment.id)
      )
    )

  console.log(
    `🚀 Service deployed: ${serviceDeployment.name}@${serviceDeployment.version} in ${serviceDeployment.environment}`
  )

  // Broadcast WebSocket event
  try {
    await NotificationService.broadcastDeploymentEvent(
      tenantId,
      'create',
      {
        id: deployment.id,
        service: serviceDeployment.name,
        version: serviceDeployment.version,
        environment: serviceDeployment.environment,
        status: 'successful',
        deployedAt: deployment.deployedAt,
        deployedBy: deployment.deployedBy,
        gitSha: deployment.gitSha || undefined,
        specType: service.specType || undefined,
      },
      { env: c.env || c.get('env') }
    )
  } catch (err) {
    console.error('Notification broadcast failed (deployment create):', err)
  }

  return c.json({
    id: deployment.id,
    service: serviceDeployment.name,
    version: serviceDeployment.version,
    environment: serviceDeployment.environment,
    deployedAt: deployment.deployedAt,
    deployedBy: deployment.deployedBy,
    active: deployment.active,
    status: deployment.status,
  })
})

// Deploy a consumer with dependencies
deploymentsRouter.post('/consumer', async c => {
  const consumerDeployment: ConsumerDeployment = await c.req.json()

  console.log('[DEPLOY CONSUMER] Request received:', {
    name: consumerDeployment.name,
    version: consumerDeployment.version,
    environment: consumerDeployment.environment
  })

  if (!consumerDeployment.name || !consumerDeployment.version || !consumerDeployment.environment) {
    console.log('[DEPLOY CONSUMER] Missing required fields')
    return c.json({ error: 'Missing required fields: name, version, environment' }, 400)
  }

  const db = c.get('db')
  const auth = c.get('auth')
  const tenantId = auth.tenantId

  console.log('[DEPLOY CONSUMER] Auth info:', { tenantId, userId: auth.userId })

  // Find the service
  console.log('[DEPLOY CONSUMER] Searching for service:', {
    tenantId,
    name: consumerDeployment.name
  })

  // Debug: Show all services for this tenant
  const allServices = await db.query.services.findMany({
    where: eq(services.tenantId, tenantId),
    columns: { id: true, name: true }
  })
  console.log('[DEPLOY CONSUMER] All services for tenant:', allServices)

  const consumer = await db.query.services.findFirst({
    where: and(
      eq(services.tenantId, tenantId),
      eq(services.name, consumerDeployment.name)
    ),
  })

  console.log('[DEPLOY CONSUMER] Consumer service found:', consumer ? consumer.id : 'NOT FOUND')

  if (!consumer) {
    console.log('[DEPLOY CONSUMER] Consumer service not found, returning 404')
    return c.json({ error: 'Service not found. Register the service first.' }, 404)
  }

  // Validate that service version exists
  console.log('[DEPLOY CONSUMER] Validating service version:', {
    name: consumerDeployment.name,
    version: consumerDeployment.version
  })

  const serviceVersion = await findServiceVersion(
    db,
    tenantId,
    consumerDeployment.name,
    consumerDeployment.version
  )

  console.log('[DEPLOY CONSUMER] Service version found:', serviceVersion ? serviceVersion.id : 'NOT FOUND')

  if (!serviceVersion) {
    console.log('[DEPLOY CONSUMER] Service version not found, returning 404')
    return c.json(
      {
        error: `Service version not found: ${consumerDeployment.name}@${consumerDeployment.version}. Please register this version first through service registration or interaction recording.`,
      },
      404
    )
  }

  // Create deployment record
  const [deployment] = await db
    .insert(deployments)
    .values({
      tenantId,
      serviceId: consumer.id,
      service: consumerDeployment.name, // Backward compatibility
      version: consumerDeployment.version,
      serviceVersionId: serviceVersion.id, // Link to service version
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

  // Broadcast WebSocket event
  try {
    await NotificationService.broadcastDeploymentEvent(
      tenantId,
      'create',
      {
        id: deployment.id,
        service: consumerDeployment.name,
        version: consumerDeployment.version,
        environment: consumerDeployment.environment,
        status: 'successful',
        deployedAt: deployment.deployedAt,
        deployedBy: deployment.deployedBy,
        gitSha: deployment.gitSha || undefined,
        specType: consumer.specType || undefined,
      },
      { env: c.env || c.get('env') }
    )
  } catch (err) {
    console.error('Notification broadcast failed (deployment create consumer):', err)
  }

  return c.json(
    {
      status: 'deployed',
      deployment: {
        id: deployment.id,
        type: 'consumer',
        name: consumerDeployment.name,
        version: consumerDeployment.version,
        environment: consumerDeployment.environment,
        specType: consumer.specType || undefined,
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
  const auth = c.get('auth')
  const tenantId = auth.tenantId

  // Find the service
  const provider = await db.query.services.findFirst({
    where: and(
      eq(services.tenantId, tenantId),
      eq(services.name, providerDeployment.name)
    ),
  })

  if (!provider) {
    return c.json({ error: 'Service not found. Register the service first.' }, 404)
  }

  // Validate that service version exists
  const serviceVersion = await findServiceVersion(
    db,
    tenantId,
    providerDeployment.name,
    providerDeployment.version
  )

  if (!serviceVersion) {
    return c.json(
      {
        error: `Service version not found: ${providerDeployment.name}@${providerDeployment.version}. Please register this version first through service registration or spec upload.`,
      },
      404
    )
  }

  // Create deployment record
  const [deployment] = await db
    .insert(deployments)
    .values({
      tenantId,
      serviceId: provider.id,
      service: providerDeployment.name, // Backward compatibility
      version: providerDeployment.version,
      serviceVersionId: serviceVersion.id, // Link to service version
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
    `🚀 Service deployed: ${providerDeployment.name}@${providerDeployment.version} in ${providerDeployment.environment}`
  )

  // Broadcast WebSocket event
  try {
    await NotificationService.broadcastDeploymentEvent(
      tenantId,
      'create',
      {
        id: deployment.id,
        service: providerDeployment.name,
        version: providerDeployment.version,
        environment: providerDeployment.environment,
        status: 'successful',
        deployedAt: deployment.deployedAt,
        deployedBy: deployment.deployedBy,
        gitSha: deployment.gitSha || undefined,
        specType: provider.specType || undefined,
      },
      { env: c.env || c.get('env') }
    )
  } catch (err) {
    console.error('Notification broadcast failed (deployment create provider):', err)
  }

  return c.json(
    {
      status: 'deployed',
      deployment: {
        id: deployment.id,
        type: 'provider',
        name: providerDeployment.name,
        version: providerDeployment.version,
        environment: providerDeployment.environment,
        specType: provider.specType || undefined,
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
  const auth = c.get('auth')
  const tenantId = auth.tenantId

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
      specType: services.specType,
    })
    .from(deployments)
    .leftJoin(services, eq(deployments.serviceId, services.id))
    .where(whereConditions.length > 0 ? and(...whereConditions.filter(Boolean)) : undefined)
    .orderBy(desc(deployments.deployedAt))

  const activeVersions = activeDeployments.map(d => ({
    id: d.id,
    service: d.service,
    version: d.version,
    gitSha: d.gitSha,
    gitRepositoryUrl: d.gitRepositoryUrl,
    specType: d.specType || undefined,
    environment: d.environment,
    deployedAt: d.deployedAt,
    deployedBy: d.deployedBy,
    active: d.active,
    status: d.status as DeploymentStatus,
    failureReason: d.failureReason || undefined,
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
  const auth = c.get('auth')
  const tenantId = auth.tenantId

  const whereConditions = [eq(deployments.tenantId, tenantId), eq(deployments.service, service)]

  if (environment) whereConditions.push(eq(deployments.environment, environment))

  const deploymentHistory = await db
    .select({
      id: deployments.id,
      tenantId: deployments.tenantId,
      service: deployments.service,
      version: deployments.version,
      environment: deployments.environment,
      deployedAt: deployments.deployedAt,
      deployedBy: deployments.deployedBy,
      active: deployments.active,
      status: deployments.status,
      failureReason: deployments.failureReason,
      failureDetails: deployments.failureDetails,
      specType: services.specType,
    })
    .from(deployments)
    .leftJoin(services, eq(deployments.serviceId, services.id))
    .where(and(...whereConditions))
    .orderBy(desc(deployments.deployedAt))
    .limit(limit)

  const deploymentStates: DeploymentState[] = deploymentHistory.map(d => ({
    id: d.id,
    tenantId: d.tenantId,
    service: d.service,
    version: d.version,
    environment: d.environment,
    deployedAt: d.deployedAt,
    deployedBy: d.deployedBy,
    active: d.active,
    status: d.status as DeploymentStatus,
    failureReason: d.failureReason || undefined,
    failureDetails: d.failureDetails,
    specType: d.specType || undefined,
  }))

  return c.json(deploymentStates)
})

// Get deployment summary for dashboard
deploymentsRouter.get('/summary', async c => {
  const db = c.get('db')
  const auth = c.get('auth')
  const tenantId = auth.tenantId

  // Get total active deployments
  const totalActiveResult = await db
    .select({ count: count() })
    .from(deployments)
    .where(and(eq(deployments.tenantId, tenantId), eq(deployments.active, true)))

  const totalActiveDeployments = totalActiveResult[0]?.count || 0

  // Get recent deployments (last 24 hours)
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const recentDeployments = await db
    .select({
      service: deployments.service,
      version: deployments.version,
      environment: deployments.environment,
      deployedAt: deployments.deployedAt,
      deployedBy: deployments.deployedBy,
      status: deployments.status,
      failureReason: deployments.failureReason,
      specType: services.specType,
    })
    .from(deployments)
    .leftJoin(services, eq(deployments.serviceId, services.id))
    .where(and(eq(deployments.tenantId, tenantId), gte(deployments.deployedAt, twentyFourHoursAgo)))
    .orderBy(desc(deployments.deployedAt))
    .limit(10)

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
  const auth = c.get('auth')
  const tenantId = auth.tenantId

  const environments = await db
    .selectDistinct({ environment: deployments.environment })
    .from(deployments)
    .where(eq(deployments.tenantId, tenantId))

  const uniqueEnvironments = environments.map(e => e.environment)

  return c.json(uniqueEnvironments)
})

// Get paginated deployments (all environments)
deploymentsRouter.get('/paginated', async c => {
  const db = c.get('db')
  const auth = c.get('auth')
  const tenantId = auth.tenantId
  const limit = Number.parseInt(c.req.query('limit') || '10')
  const offset = Number.parseInt(c.req.query('offset') || '0')
  const statusFilter = c.req.query('status') // active, inactive, active-or-blocked, all
  const providerFilter = c.req.query('provider')
  const consumerFilter = c.req.query('consumer')
  const environmentFilter = c.req.query('environment')

  // Build where conditions for filters
  const whereConditions = [eq(deployments.tenantId, tenantId)]

  if (providerFilter) {
    const condition = eq(deployments.service, providerFilter)
    if (condition) whereConditions.push(condition)
  }
  if (consumerFilter) {
    const condition = eq(deployments.service, consumerFilter)
    if (condition) whereConditions.push(condition)
  }
  if (environmentFilter && environmentFilter !== 'ALL')
    whereConditions.push(eq(deployments.environment, environmentFilter))

  // Apply status filter logic
  if (statusFilter === 'active') {
    whereConditions.push(eq(deployments.active, true))
  } else if (statusFilter === 'inactive') {
    whereConditions.push(eq(deployments.active, false))
  } else if (statusFilter === 'active-or-blocked') {
    const condition = or(eq(deployments.active, true), eq(deployments.status, 'failed'))
    if (condition) whereConditions.push(condition)
  }
  // 'all' or undefined = no additional status filter

  // Get total count for pagination (with filters applied)
  const totalCountQuery = db
    .select({ count: count() })
    .from(deployments)
    .where(whereConditions.length > 0 ? and(...whereConditions.filter(Boolean)) : undefined)

  const [totalCountResult] = await totalCountQuery
  const totalCount = totalCountResult.count

  // Get paginated deployments with service info (with filters applied)
  const deploymentsQuery = db
    .select({
      id: deployments.id,
      tenantId: deployments.tenantId,
      service: deployments.service,
      version: deployments.version,
      environment: deployments.environment,
      deployedAt: deployments.deployedAt,
      deployedBy: deployments.deployedBy,
      active: deployments.active,
      status: deployments.status,
      failureReason: deployments.failureReason,
      failureDetails: deployments.failureDetails,
      gitSha: deployments.gitSha,
      // Service info
      gitRepositoryUrl: services.gitRepositoryUrl,
      specType: services.specType,
    })
    .from(deployments)
    .leftJoin(
      services,
      and(eq(services.name, deployments.service), eq(services.tenantId, tenantId))
    )
    .where(whereConditions.length > 0 ? and(...whereConditions.filter(Boolean)) : undefined)
    .orderBy(desc(deployments.deployedAt))
    .limit(limit)
    .offset(offset)

  const deploymentsWithService = await deploymentsQuery

  const results = deploymentsWithService.map(d => ({
    id: d.id,
    tenantId: d.tenantId,
    service: d.service,
    version: d.version,
    environment: d.environment,
    deployedAt: d.deployedAt,
    deployedBy: d.deployedBy,
    active: d.active,
    status: d.status as DeploymentStatus,
    failureReason: d.failureReason || undefined,
    failureDetails: d.failureDetails,
    gitSha: d.gitSha,
    gitRepositoryUrl: d.gitRepositoryUrl,
    specType: d.specType || undefined,
  }))

  // Calculate statistics based on filtered results (not paginated, but filtered)
  const statsQuery = db
    .select({
      active: deployments.active,
      status: deployments.status,
    })
    .from(deployments)
    .where(whereConditions.length > 0 ? and(...whereConditions.filter(Boolean)) : undefined)

  const filteredDeployments = await statsQuery

  const totalDeployments = filteredDeployments.length
  const activeDeployments = filteredDeployments.filter(d => d.active).length
  const blockedDeployments = filteredDeployments.filter(d => d.status === 'failed').length

  // Get environment breakdown from filtered results (for the environment cards)
  const envBreakdownQuery = db
    .select({
      environment: deployments.environment,
      active: deployments.active,
      status: deployments.status,
    })
    .from(deployments)
    .where(whereConditions.length > 0 ? and(...whereConditions.filter(Boolean)) : undefined)

  const envBreakdownData = await envBreakdownQuery

  // Calculate counts by environment
  const environmentBreakdown = envBreakdownData.reduce(
    (acc, deployment) => {
      const env = deployment.environment
      if (!acc[env]) {
        acc[env] = { total: 0, active: 0, blocked: 0 }
      }
      acc[env].total++
      if (deployment.active) acc[env].active++
      if (deployment.status === 'failed') acc[env].blocked++
      return acc
    },
    {} as Record<string, { total: number; active: number; blocked: number }>
  )

  return c.json({
    results,
    totalCount,
    limit,
    offset,
    hasNextPage: offset + limit < totalCount,
    hasPreviousPage: offset > 0,
    statistics: {
      totalDeployments,
      activeDeployments,
      blockedDeployments,
    },
    environmentBreakdown,
  })
})
