#!/usr/bin/env node
import 'dotenv/config'
import { serve } from '@hono/node-server'
import app from './index.js'

const port = 3001

console.log(`🚀 Entente API server running on http://localhost:${port}`)

serve({
  fetch: app.fetch,
  port,
})