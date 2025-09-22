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
import { canIDeployRouter } from './routes/can-i-deploy.js'
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
app.use('/api/can-i-deploy/*', authMiddleware)
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
app.route('/api/can-i-deploy', canIDeployRouter)
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
