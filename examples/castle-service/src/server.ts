import 'dotenv/config'
import { serve } from '@hono/node-server'
import app from './index.js'

const port = Number.parseInt(process.env.PORT || '4001', 10)

console.log(`🏰 Castle Service starting on port ${port}`)

serve(
  {
    fetch: app.fetch,
    port,
  },
  info => {
    console.log(`🏰 Castle Service is running on http://localhost:${info.port}`)
    console.log(`📚 Swagger UI documentation: http://localhost:${info.port}/docs`)
    console.log(`📋 OpenAPI specification: http://localhost:${info.port}/openapi.json`)
    console.log(`🔧 Health check: http://localhost:${info.port}/health`)
    console.log(`🚀 Root redirects to docs: http://localhost:${info.port}/`)
  }
)
