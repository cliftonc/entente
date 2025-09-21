import type { VerificationResult } from '@entente/types'
import { debugLog } from '@entente/types'
import { and, count, desc, eq } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'

type CloudflareEnv = {
  ASSETS?: any
  NOTIFICATIONS_HUB?: any // DurableObjectNamespace binding (Workers)
}
import {
  deployments,
  interactions,
  serviceDependencies,
  services,
  verificationResults,
  verificationTasks,
} from '../db/schema/index.js'
import { authMiddleware } from './middleware/auth.js'
import { databaseMiddleware } from './middleware/database.js'
import { demoRestrictionsMiddleware } from './middleware/demo-restrictions.js'
import { envMiddleware } from './middleware/env.js'
import { performanceMiddleware } from './middleware/performance.js'

import { getEnv } from './middleware/env.js'
import { adminRouter } from './routes/admin.js'
import { authRouter } from './routes/auth.js'
import { contractsRouter } from './routes/contracts.js'
import { dependenciesRouter } from './routes/dependencies.js'
import { deploymentsRouter } from './routes/deployments.js'
import { eventsRouter } from './routes/events.js'
import { fixturesRouter } from './routes/fixtures.js'
import { githubRoutes } from './routes/github.js'
import { interactionsRouter } from './routes/interactions.js'
import { keysRouter } from './routes/keys.js'
import { mockRouter } from './routes/mock.js'
import { serviceVersionsRouter } from './routes/service-versions.js'
import { servicesRouter } from './routes/services.js'
import settingsRouter from './routes/settings.js'
import { specsRouter } from './routes/specs.js'
import { statsRouter } from './routes/stats.js'
import { systemViewRouter } from './routes/system-view.js'
import { verificationRouter } from './routes/verification.js'
import { websocketRouter } from './routes/websocket.js'

const app = new Hono<{ Bindings: CloudflareEnv }>()

// Middleware
app.use('*', performanceMiddleware)
app.use('*', logger())
app.use('*', envMiddleware)
app.use('*', databaseMiddleware)
app.use(
  '*',
  cors({
    origin: ['http://localhost:3000', 'https://entente.your-domain.com'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  })
)

// Health check (no auth required)
app.get('/health', c => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Auth routes (no auth required for login)
app.route('/auth', authRouter)

// Admin routes (secret key protected)
app.route('/admin', adminRouter)

// Public GitHub app name endpoint (no auth required)
app.get('/api/github/app-name', async c => {
  const env = c.get('env')
  const appName = getEnv(env, 'GITHUB_APP_NAME') || 'entente-dev'
  return c.json({ appName })
})

// Protected API routes (require authentication)
app.use('/api/keys/*', authMiddleware)
app.use('/api/specs/*', authMiddleware)
app.use('/api/interactions/*', authMiddleware)
app.use('/api/contracts/*', authMiddleware)
app.use('/api/fixtures/*', authMiddleware)
app.use('/api/deployments/*', authMiddleware)
app.use('/api/verification/*', authMiddleware)
app.use('/api/services/*', authMiddleware)
app.use('/api/service-versions/*', authMiddleware)
app.use('/api/dependencies/*', authMiddleware)
app.use('/api/stats/*', authMiddleware)
app.use('/api/settings/*', authMiddleware)
app.use('/api/github/*', authMiddleware)
app.use('/api/mock/*', authMiddleware)
app.use('/api/events/*', authMiddleware)
app.use('/api/system-view/*', authMiddleware)

// Apply demo restrictions to protected routes (after auth middleware)
app.use('/api/settings/*', demoRestrictionsMiddleware)
app.use('/api/keys/*', demoRestrictionsMiddleware)
app.use('/admin/*', demoRestrictionsMiddleware)

app.route('/api/keys', keysRouter)
app.route('/api/specs', specsRouter)
app.route('/api/interactions', interactionsRouter)
app.route('/api/contracts', contractsRouter)
app.route('/api/fixtures', fixturesRouter)
app.route('/api/deployments', deploymentsRouter)
app.route('/api/verification', verificationRouter)
app.route('/api/services', servicesRouter)
app.route('/api/service-versions', serviceVersionsRouter)
app.route('/api/dependencies', dependenciesRouter)
app.route('/api/stats', statsRouter)
app.route('/api/system-view', systemViewRouter)
app.route('/api/settings', settingsRouter)
app.route('/api/github', githubRoutes)
app.route('/api/mock', mockRouter)
app.route('/api/events', eventsRouter)

// WebSocket route (no auth middleware - auth handled in the WebSocket handler)
app.route('/', websocketRouter)

// Serve static files (favicon, manifest, etc.)
// Handle both Cloudflare Workers and Node.js development
app.get('/favicon*', async c => {
  const pathname = new URL(c.req.url).pathname
  const assets = c.env?.ASSETS

  if (assets) {
    // Cloudflare Workers environment
    const response = await assets.fetch(new URL(pathname, c.req.url).href)
    if (response.ok) {
      return response
    }
  }

  // Fallback for Node.js development
  return c.notFound()
})

app.get('/android-chrome*', async c => {
  const pathname = new URL(c.req.url).pathname
  const assets = c.env?.ASSETS

  if (assets) {
    const response = await assets.fetch(new URL(pathname, c.req.url).href)
    if (response.ok) {
      return response
    }
  }

  return c.notFound()
})

app.get('/apple-touch-icon*', async c => {
  const pathname = new URL(c.req.url).pathname
  const assets = c.env?.ASSETS

  if (assets) {
    const response = await assets.fetch(new URL(pathname, c.req.url).href)
    if (response.ok) {
      return response
    }
  }

  return c.notFound()
})

app.get('/site.webmanifest', async c => {
  const assets = c.env?.ASSETS

  if (assets) {
    const response = await assets.fetch(new URL('/site.webmanifest', c.req.url).href)
    if (response.ok) {
      return response
    }
  }

  return c.notFound()
})

// Can I Deploy endpoint (protected)
app.get('/api/can-i-deploy', authMiddleware, async c => {
  const service = c.req.query('service') || c.req.query('consumer') // Accept both for backward compatibility
  const version = c.req.query('version')
  const environment = c.req.query('environment')
  const type = c.req.query('type') // New parameter for unified services table

  if (!service || !version || !environment) {
    return c.json({ error: 'Missing required parameters' }, 400)
  }

  if (type && !['consumer', 'provider'].includes(type)) {
    return c.json({ error: "Type must be either 'consumer' or 'provider'" }, 400)
  }

  const db = c.get('db')
  const auth = c.get('auth')
  const tenantId = auth.tenantId

  try {
    // Find the service record, optionally filtered by type
    const whereConditions = [eq(services.tenantId, tenantId), eq(services.name, service)]

    // Type filtering is no longer needed as services don't have types

    const serviceRecords = await db
      .select()
      .from(services)
      .where(and(...whereConditions))

    if (serviceRecords.length === 0) {
      return c.json({
        canDeploy: false,
        compatibleServices: [],
        message: `Service ${service} not found${type ? ` with type ${type}` : ''}`,
        serviceType: 'unknown',
      })
    }

    // Determine service roles from contracts
    // For now, assume it can be both until we can query contracts
    const isConsumer = true
    const isProvider = true

    const compatibleServices = []
    let allVerified = true
    const errorMessages = []

    // If it's a consumer, check dependencies against providers in target environment
    if (isConsumer) {
      // Step 1: Find all dependencies for this consumer version
      const consumerServices = alias(services, 'consumer_services')
      const providerServices = alias(services, 'provider_services')

      const requiredDependencies = await db
        .select({
          id: serviceDependencies.id,
          providerId: serviceDependencies.providerId,
          providerName: providerServices.name,
        })
        .from(serviceDependencies)
        .innerJoin(consumerServices, eq(serviceDependencies.consumerId, consumerServices.id))
        .innerJoin(providerServices, eq(serviceDependencies.providerId, providerServices.id))
        .where(
          and(
            eq(serviceDependencies.tenantId, tenantId),
            eq(consumerServices.name, service),
            eq(serviceDependencies.consumerVersion, version)
          )
        )

      if (requiredDependencies.length === 0) {
        errorMessages.push(
          `No dependencies found for consumer ${service}@${version} in ${environment}`
        )
      }

      // Step 2: For each required dependency, check if the provider is deployed and verified
      for (const dependency of requiredDependencies) {
        // Check if the required provider version is actively deployed
        const deploymentQuery = await db
          .select({
            service: deployments.service,
            version: deployments.version,
            deployedAt: deployments.deployedAt,
          })
          .from(deployments)
          .where(
            and(
              eq(deployments.tenantId, tenantId),
              eq(deployments.service, dependency.providerName),
              eq(deployments.environment, environment),
              eq(deployments.active, true)
            )
          )
          .limit(1)

        const deployment = deploymentQuery[0]

        if (!deployment) {
          allVerified = false
          errorMessages.push(
            `Required provider ${dependency.providerName} is not deployed in ${environment}`
          )
          continue
        }

        // Look for verification results that link this provider version to this consumer version
        const verificationQuery = await db
          .select({
            id: verificationResults.id,
            results: verificationResults.results,
            submittedAt: verificationResults.submittedAt,
            taskConsumer: verificationTasks.consumer,
            taskConsumerVersion: verificationTasks.consumerVersion,
          })
          .from(verificationResults)
          .innerJoin(verificationTasks, eq(verificationResults.taskId, verificationTasks.id))
          .where(
            and(
              eq(verificationResults.tenantId, tenantId),
              eq(verificationResults.provider, dependency.providerName),
              eq(verificationResults.providerVersion, deployment.version), // Use the deployed version
              eq(verificationTasks.consumer, service),
              eq(verificationTasks.consumerVersion, version)
              // Note: No environment filter - verification is environment-agnostic
            )
          )
          .limit(1)

        const verification = verificationQuery[0]
        // Check if all results in the verification passed
        let isVerified = false
        if (verification?.results) {
          const results = verification.results as VerificationResult[]
          isVerified = results.length > 0 && results.every(r => r.success === true)
        }

        if (!isVerified) {
          allVerified = false
          errorMessages.push(
            `Provider ${dependency.providerName}@${deployment.version} verification is pending or failed for ${service}@${version}`
          )
        }

        // Count interactions between this provider and consumer (across all environments)
        const interactionCount = await db
          .select({ count: count() })
          .from(interactions)
          .where(
            and(
              eq(interactions.tenantId, tenantId),
              eq(interactions.service, dependency.providerName),
              eq(interactions.consumer, service),
              eq(interactions.consumerVersion, version)
              // Note: No environment filter - interactions are environment-agnostic
            )
          )

        const totalInteractions = interactionCount[0]?.count || 0

        compatibleServices.push({
          service: dependency.providerName,
          version: deployment.version,
          verified: isVerified,
          interactionCount: totalInteractions,
          type: 'provider',
          activelyDeployed: true, // We know it's deployed since we checked
        })
      }
    }

    // If it's a provider, check what consumers are deployed and depend on it
    if (isProvider) {
      // Step 0: Find all deployed dependencies for this provider version
      const providerServices = alias(services, 'provider_services')
      const consumerServices = alias(services, 'consumer_services')

      const deployedDependencies = await db
        .select({
          id: serviceDependencies.id,
          consumer: consumerServices.name,
          consumerId: serviceDependencies.consumerId,
          consumerVersion: serviceDependencies.consumerVersion,
          deployedAt: deployments.deployedAt,
        })
        .from(serviceDependencies)
        .innerJoin(providerServices, eq(serviceDependencies.providerId, providerServices.id))
        .innerJoin(consumerServices, eq(serviceDependencies.consumerId, consumerServices.id))
        .innerJoin(deployments, eq(serviceDependencies.consumerId, deployments.serviceId))
        .where(
          and(
            eq(serviceDependencies.tenantId, tenantId),
            eq(providerServices.name, service),
            eq(deployments.environment, environment),
            eq(deployments.active, true)
          )
        )

      if (deployedDependencies.length === 0) {
        // If a provider has no dependents, it's safe to deploy
        return c.json({
          canDeploy: true,
          compatibleServices: [],
          message: `Provider ${service}@${version} has no dependents and is safe to deploy in ${environment}`,
          serviceType: 'provider',
        })
      }

      debugLog(
        `Found ${deployedDependencies.length} deployed consumers in ${environment}`
      )

      for (const consumer of deployedDependencies) {
        // Skip consumers with null consumerId
        if (!consumer.consumerId) {
          continue
        }

        // Get the latest verification status
        const verificationQuery = await db
          .select({
            id: verificationResults.id,
            results: verificationResults.results,
            submittedAt: verificationResults.submittedAt,
            taskConsumer: verificationTasks.consumer,
            taskConsumerVersion: verificationTasks.consumerVersion,
            provider: verificationResults.provider,
            providerVersion: verificationResults.providerVersion,
          })
          .from(verificationResults)
          .innerJoin(verificationTasks, eq(verificationResults.taskId, verificationTasks.id))
          .where(
            and(
              eq(verificationResults.tenantId, tenantId),
              eq(verificationResults.provider, service),
              eq(verificationResults.providerVersion, version),
              eq(verificationResults.consumerId, consumer.consumerId),
              eq(verificationResults.consumerVersion, consumer.consumerVersion)
            )
          )
          .orderBy(desc(verificationResults.submittedAt))
          .limit(1)

        const verification = verificationQuery[0]
        // Check if all results in the verification passed
        let isVerified = false
        if (verification?.results) {
          const results = verification.results as VerificationResult[]
          isVerified = results.length > 0 && results.every(r => r.success === true)
          debugLog(`All results passed: ${isVerified}`)
        } else {
          debugLog(
            `No verification results found for ${consumer.consumer}@${consumer.consumerVersion}`
          )
        }

        // Count interactions between this provider and consumer (across all environments)
        const interactionCount = await db
          .select({ count: count() })
          .from(interactions)
          .where(
            and(
              eq(interactions.tenantId, tenantId),
              eq(interactions.service, service),
              eq(interactions.consumer, consumer.consumer),
              eq(interactions.consumerVersion, consumer.consumerVersion)
              // Note: No environment filter - interactions are environment-agnostic
            )
          )

        const totalInteractions = interactionCount[0]?.count || 0

        if (!isVerified) {
          allVerified = false
          errorMessages.push(
            `Consumer ${consumer.consumer}@${consumer.consumerVersion} verification is pending or failed for ${service}@${version}`
          )
        }

        compatibleServices.push({
          service: consumer.consumer,
          version: consumer.consumerVersion,
          verified: isVerified,
          interactionCount: totalInteractions,
          type: 'consumer',
          activelyDeployed: true, // We know it's deployed since we got it from deployments
        })
      }
    }

    if (compatibleServices.length === 0) {
      const serviceType =
        isConsumer && isProvider
          ? 'consumer/provider'
          : isConsumer
            ? 'consumer'
            : isProvider
              ? 'provider'
              : 'unknown'
      return c.json({
        canDeploy: false,
        compatibleServices: [],
        message: `No dependencies or dependents found for ${serviceType} ${service}@${version} in ${environment}`,
        serviceType,
      })
    }

    const canDeploy = allVerified && errorMessages.length === 0
    const message = canDeploy
      ? `All verifications passed for ${service}@${version}`
      : errorMessages.join('; ')

    // Record failed deployment attempt if can't deploy
    if (!canDeploy) {
      try {
        // Use the first service record
        const primaryService = serviceRecords[0]

        const canIDeployResult = {
          canDeploy,
          compatibleServices,
          message,
          serviceType:
            isConsumer && isProvider ? 'consumer/provider' : isConsumer ? 'consumer' : 'provider',
          errorMessages,
          allVerified,
        }

        // Record the failed deployment attempt
        await db.insert(deployments).values({
          tenantId,
          serviceId: primaryService.id,
          service,
          version,
          environment,
          deployedAt: new Date(),
          deployedBy: auth.user?.username || 'unknown',
          active: false,
          status: 'failed',
          failureReason: message,
          failureDetails: canIDeployResult,
        })
      } catch (deploymentError) {
        console.error('Failed to record deployment attempt:', deploymentError)
        // Don't fail the can-i-deploy check just because we couldn't record the attempt
      }
    }

    // Mark failed deployment attempts as resolved if deployment can now proceed
    if (canDeploy) {
      try {
        const resolvedCount = await db
          .update(deployments)
          .set({
            status: 'resolved',
            failureReason: `Resolved: ${message}`, // Update reason to show resolution
          })
          .where(
            and(
              eq(deployments.tenantId, tenantId),
              eq(deployments.service, service),
              eq(deployments.version, version),
              eq(deployments.status, 'failed')
            )
          )
          .returning({ id: deployments.id })

        if (resolvedCount.length > 0) {
          console.log(
            `✅ Marked ${resolvedCount.length} failed deployment attempts as resolved for ${service}@${version}`
          )
        }
      } catch (resolveError) {
        console.error('Failed to resolve deployment attempts:', resolveError)
        // Don't fail the can-i-deploy check just because we couldn't resolve previous attempts
      }
    }

    return c.json({
      canDeploy,
      compatibleServices,
      message,
      serviceType:
        isConsumer && isProvider ? 'consumer/provider' : isConsumer ? 'consumer' : 'provider',
    })
  } catch (error) {
    console.error('Error in can-i-deploy:', error)
    return c.json(
      {
        error: 'Failed to check deployment compatibility',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    )
  }
})

// Serve React SPA for all unmatched routes (must be last)
app.get('*', async c => {
  try {
    const env = c.get('env')
    const appUrl = getEnv(env, 'APP_URL') || 'https://entente.dev'
    const shouldIncludeAnalytics = appUrl === 'https://entente.dev'

    const analyticsScript = shouldIncludeAnalytics
      ? '<script async src="https://scripts.simpleanalyticscdn.com/latest.js"></script>'
      : ''

    // Try to get the index.html from assets
    const assets = c.env?.ASSETS
    if (assets) {
      const indexResponse = await assets.fetch(new URL('/index.html', c.req.url).href)
      if (indexResponse.ok) {
        let indexHtml = await indexResponse.text()

        // Inject analytics script before closing head tag if needed
        if (shouldIncludeAnalytics) {
          indexHtml = indexHtml.replace('</head>', `  ${analyticsScript}\n  </head>`)
        }

        return c.html(indexHtml)
      }
    }

    // Fallback if assets are not available
    return c.html(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Entente</title>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />${analyticsScript ? `\n          ${analyticsScript}` : ''}
        </head>
        <body>
          <div id="root">Loading...</div>
          <script>
            console.error('Static assets not found. Check your Cloudflare Workers assets configuration.');
          </script>
        </body>
      </html>
    `)
  } catch (error) {
    console.error('Error serving SPA:', error)
    return c.html('Application unavailable', 500)
  }
})

// Export for Cloudflare Workers
export { NotificationsHub } from './durable-objects/notifications-hub.js'
export default app
