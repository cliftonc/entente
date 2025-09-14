import { Hono } from 'hono'
import type { DeploymentState, ActiveVersion, ConsumerDeployment, ProviderDeployment } from '@entente/types'

import { deployments, services, serviceDependencies, verificationTasks, interactions } from '../../db/schema'
import { eq, and, ne, desc, count, gte } from 'drizzle-orm'

export const deploymentsRouter = new Hono()

// Deploy a consumer with dependencies
deploymentsRouter.post('/consumer', async (c) => {
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
  const [deployment] = await db.insert(deployments).values({
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
  }).returning()

  // Deactivate other versions in same environment
  await db.update(deployments)
    .set({ active: false })
    .where(
      and(
        eq(deployments.tenantId, tenantId),
        eq(deployments.serviceId, consumer.id),
        eq(deployments.environment, consumerDeployment.environment),
        ne(deployments.id, deployment.id)
      )
    )

  // Register dependencies
  const registeredDependencies = []
  if (consumerDeployment.dependencies && consumerDeployment.dependencies.length > 0) {
    for (const dep of consumerDeployment.dependencies) {
      // Find provider service
      const provider = await db.query.services.findFirst({
        where: and(
          eq(services.tenantId, tenantId),
          eq(services.name, dep.provider),
          eq(services.type, 'provider')
        ),
      })

      if (!provider) {
        console.warn(`⚠️  Provider service ${dep.provider} not found, skipping dependency registration`)
        continue
      }

      // Check if dependency already exists
      const existingDep = await db.query.serviceDependencies.findFirst({
        where: and(
          eq(serviceDependencies.tenantId, tenantId),
          eq(serviceDependencies.consumerId, consumer.id),
          eq(serviceDependencies.providerId, provider.id),
          eq(serviceDependencies.consumerVersion, consumerDeployment.version),
          eq(serviceDependencies.providerVersion, dep.version),
          eq(serviceDependencies.environment, consumerDeployment.environment)
        ),
      })

      if (existingDep) {
        // Update existing dependency
        await db.update(serviceDependencies)
          .set({
            deploymentId: deployment.id,
            registeredAt: new Date(),
            status: 'pending_verification',
            verifiedAt: null,
          })
          .where(eq(serviceDependencies.id, existingDep.id))

        registeredDependencies.push(existingDep)

        // Create verification tasks from recorded interactions for updated dependency
        await createVerificationTasksFromInteractions(db, tenantId, consumer.id, provider.id, consumerDeployment.version, dep.version, consumerDeployment.environment, existingDep.id)
      } else {
        // Create new dependency
        const [newDep] = await db.insert(serviceDependencies).values({
          tenantId,
          consumerId: consumer.id,
          consumerVersion: consumerDeployment.version,
          providerId: provider.id,
          providerVersion: dep.version,
          environment: consumerDeployment.environment,
          deploymentId: deployment.id,
          status: 'pending_verification',
        }).returning()

        registeredDependencies.push(newDep)

        // Create verification tasks from recorded interactions for new dependency
        await createVerificationTasksFromInteractions(db, tenantId, consumer.id, provider.id, consumerDeployment.version, dep.version, consumerDeployment.environment, newDep.id)
      }
    }
  }

  console.log(`🚀 Consumer deployed: ${consumerDeployment.name}@${consumerDeployment.version} in ${consumerDeployment.environment} with ${registeredDependencies.length} dependencies`)

  return c.json({
    status: 'deployed',
    deployment: {
      id: deployment.id,
      type: 'consumer',
      name: consumerDeployment.name,
      version: consumerDeployment.version,
      environment: consumerDeployment.environment,
      deployedAt: deployment.deployedAt,
    },
    dependenciesRegistered: registeredDependencies.length,
  }, 201)
})

// Deploy a provider
deploymentsRouter.post('/provider', async (c) => {
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
  const [deployment] = await db.insert(deployments).values({
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
  }).returning()

  // Deactivate other versions in same environment
  await db.update(deployments)
    .set({ active: false })
    .where(
      and(
        eq(deployments.tenantId, tenantId),
        eq(deployments.serviceId, provider.id),
        eq(deployments.environment, providerDeployment.environment),
        ne(deployments.id, deployment.id)
      )
    )

  console.log(`🚀 Provider deployed: ${providerDeployment.name}@${providerDeployment.version} in ${providerDeployment.environment}`)

  return c.json({
    status: 'deployed',
    deployment: {
      id: deployment.id,
      type: 'provider',
      name: providerDeployment.name,
      version: providerDeployment.version,
      environment: providerDeployment.environment,
      deployedAt: deployment.deployedAt,
    },
  }, 201)
})

// Helper function to create verification tasks from interactions
async function createVerificationTasksFromInteractions(
  db: any,
  tenantId: string,
  consumerId: string,
  providerId: string,
  consumerVersion: string,
  providerVersion: string,
  environment: string,
  dependencyId: string
) {
  // Find recorded interactions between this consumer and provider
  const recordedInteractions = await db.query.interactions.findMany({
    where: and(
      eq(interactions.tenantId, tenantId),
      eq(interactions.consumerId, consumerId),
      eq(interactions.providerId, providerId),
      eq(interactions.consumerVersion, consumerVersion),
      eq(interactions.environment, environment)
    ),
    limit: 100, // Reasonable limit for verification tasks
  })

  if (recordedInteractions.length === 0) {
    console.log(`ℹ️  No recorded interactions found for ${consumerId} -> ${providerId}`)
    return
  }

  // Check if verification task already exists
  const existingTask = await db.query.verificationTasks.findFirst({
    where: and(
      eq(verificationTasks.tenantId, tenantId),
      eq(verificationTasks.consumerId, consumerId),
      eq(verificationTasks.providerId, providerId),
      eq(verificationTasks.consumerVersion, consumerVersion),
      eq(verificationTasks.providerVersion, providerVersion),
      eq(verificationTasks.environment, environment)
    ),
  })

  if (existingTask) {
    // Update existing task with new interactions
    await db.update(verificationTasks)
      .set({
        interactions: recordedInteractions
      })
      .where(eq(verificationTasks.id, existingTask.id))

    console.log(`✅ Updated verification task with ${recordedInteractions.length} interactions for ${consumerId} -> ${providerId}`)
    return
  }

  // Get actual provider and consumer names for the verification task
  const providerData = await db.query.services.findFirst({
    where: eq(services.id, providerId),
    columns: { name: true },
  })

  const consumerData = await db.query.services.findFirst({
    where: eq(services.id, consumerId),
    columns: { name: true },
  })

  if (!providerData || !consumerData) {
    console.error(`⚠️  Failed to find provider or consumer data for verification task`)
    return
  }

  // Create verification task
  await db.insert(verificationTasks).values({
    tenantId,
    providerId,
    consumerId,
    dependencyId,
    provider: providerData.name,
    providerVersion,
    consumer: consumerData.name,
    consumerVersion,
    environment,
    interactions: recordedInteractions,
  })

  console.log(`✅ Created verification task with ${recordedInteractions.length} interactions for ${consumerId} -> ${providerId}`)
}

// Update deployment state (legacy endpoint for backward compatibility)
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
  const includeInactive = c.req.query('include_inactive') === 'true'

  if (!environment) {
    return c.json({ error: 'Environment parameter is required' }, 400)
  }

  const db = c.get('db')
  const { tenantId } = c.get('session')

  const whereConditions = [
    eq(deployments.tenantId, tenantId),
    eq(deployments.environment, environment)
  ]

  // Only filter by active status if not including inactive deployments
  if (!includeInactive) {
    whereConditions.push(eq(deployments.active, true))
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