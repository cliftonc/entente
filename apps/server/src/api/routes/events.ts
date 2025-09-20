import { specRegistry } from '@entente/fixtures'
import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { stream } from 'hono/streaming'
import { specs } from '../../db/schema'

export const eventsRouter = new Hono()

// Server-Sent Events endpoint for AsyncAPI specs
eventsRouter.get('/stream/:service/:version', async c => {
  const service = c.req.param('service')
  const version = c.req.param('version')
  const { tenantId } = c.get('session')

  // Get the AsyncAPI spec for this service
  const db = c.get('db')
  const spec = await db.query.specs.findFirst({
    where: and(
      eq(specs.tenantId, tenantId),
      eq(specs.service, service),
      eq(specs.version, version),
      eq(specs.specType, 'asyncapi')
    ),
  })

  if (!spec) {
    return c.json({ error: 'AsyncAPI spec not found' }, 404)
  }

  // Parse the AsyncAPI spec
  const parsedSpec = specRegistry.parseSpec(spec.spec)
  if (!parsedSpec || parsedSpec.type !== 'asyncapi') {
    return c.json({ error: 'Invalid AsyncAPI spec' }, 400)
  }

  // Extract operations and channels
  const handler = specRegistry.getHandler('asyncapi')!
  const operations = handler.extractOperations(parsedSpec)

  return stream(c, async stream => {
    // Set SSE headers
    c.header('Content-Type', 'text/event-stream')
    c.header('Cache-Control', 'no-cache')
    c.header('Connection', 'keep-alive')
    c.header('Access-Control-Allow-Origin', '*')

    // Send initial connection event
    await stream.write(`event: connected\n`)
    await stream.write(
      `data: ${JSON.stringify({
        service,
        version,
        channels: operations.map(op => op.channel).filter(Boolean),
        timestamp: new Date().toISOString(),
      })}\n\n`
    )

    // Set up periodic heartbeat
    const heartbeatInterval = setInterval(async () => {
      try {
        await stream.write(`event: heartbeat\n`)
        await stream.write(
          `data: ${JSON.stringify({
            timestamp: new Date().toISOString(),
          })}\n\n`
        )
      } catch (error) {
        clearInterval(heartbeatInterval)
      }
    }, 30000) // Every 30 seconds

    // Simulate events for demo purposes
    const eventInterval = setInterval(async () => {
      try {
        const randomOperation = operations[Math.floor(Math.random() * operations.length)]
        if (randomOperation) {
          const mockData = handler.generateMockData(randomOperation)

          await stream.write(`event: ${randomOperation.channel}\n`)
          await stream.write(`data: ${JSON.stringify(mockData)}\n\n`)
        }
      } catch (error) {
        clearInterval(eventInterval)
      }
    }, 10000) // Every 10 seconds

    // Handle client disconnect
    c.req.raw.signal?.addEventListener('abort', () => {
      clearInterval(heartbeatInterval)
      clearInterval(eventInterval)
    })
  })
})

// WebSocket upgrade endpoint
eventsRouter.get('/ws/:service/:version', async c => {
  const service = c.req.param('service')
  const version = c.req.param('version')

  // Check if this is a WebSocket upgrade request
  const upgrade = c.req.header('upgrade')
  if (upgrade !== 'websocket') {
    return c.json(
      {
        error: 'WebSocket upgrade required',
        wsUrl: `ws://${c.req.header('host')}/api/events/ws/${service}/${version}`,
      },
      400
    )
  }

  // Return WebSocket connection info
  return c.json({
    message: 'WebSocket endpoint available',
    wsUrl: `ws://${c.req.header('host')}/api/events/ws/${service}/${version}`,
    service,
    version,
  })
})
