#!/usr/bin/env node
import 'dotenv/config'
import { createServer } from 'node:http'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { WebSocketServer } from 'ws'
import app from './index.js'
import { setupWebSocketServer } from './services/websocket-dev.js'

const port = 3001

// Create a development wrapper that adds static file serving
const devApp = new Hono()

// Serve static files from public directory for development
devApp.use('/favicon*', serveStatic({ root: './public/' }))
devApp.use('/android-chrome*', serveStatic({ root: './public/' }))
devApp.use('/apple-touch-icon*', serveStatic({ root: './public/' }))
devApp.use('/site.webmanifest', serveStatic({ root: './public/' }))

// Mount the main app
devApp.route('/', app)

// Create HTTP server
const server = createServer()

// Set up WebSocket server
const wss = new WebSocketServer({
  server,
  path: '/ws',
})

// Initialize WebSocket handlers
setupWebSocketServer(wss)

// Handle HTTP requests with Hono
server.on('request', async (req, res) => {
  // Collect request body for POST/PUT/PATCH requests
  let body: Buffer | undefined
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const chunks: Buffer[] = []
    for await (const chunk of req) {
      chunks.push(chunk)
    }
    body = Buffer.concat(chunks)
  }

  const response = await devApp.fetch(
    new Request(`http://localhost:${port}${req.url}`, {
      method: req.method,
      headers: req.headers as any,
      body: body,
      duplex: 'half',
    } as any)
  )

  // Copy response to Node.js response
  res.statusCode = response.status
  response.headers.forEach((value, key) => {
    res.setHeader(key, value)
  })

  if (response.body) {
    const reader = response.body.getReader()
    const pump = () => {
      reader
        .read()
        .then(({ done, value }) => {
          if (done) {
            res.end()
            return
          }
          res.write(Buffer.from(value))
          pump()
        })
        .catch(err => {
          console.error('Stream error:', err)
          res.end()
        })
    }
    pump()
  } else {
    res.end()
  }
})

console.log(`🚀 Entente API server running on http://localhost:${port}`)
console.log(`📡 WebSocket server running on ws://localhost:${port}/ws`)

server.listen(port)
