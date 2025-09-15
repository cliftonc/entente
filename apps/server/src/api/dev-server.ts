#!/usr/bin/env node
import 'dotenv/config'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import app from './index.js'

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

console.log(`🚀 Entente API server running on http://localhost:${port}`)

serve({
  fetch: devApp.fetch,
  port,
})
