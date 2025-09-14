import 'dotenv/config'
import { serve } from '@hono/node-server'
import app from './index.js'

const port = Number.parseInt(process.env.PORT || '4002', 10)
const castleServiceUrl = process.env.CASTLE_SERVICE_URL || 'http://localhost:4001'

console.log(`🏰 Castle Client starting on port ${port}`)
console.log(`🔗 Castle Service URL: ${castleServiceUrl}`)

serve(
  {
    fetch: app.fetch,
    port,
  },
  info => {
    console.log(`🏰 Castle Client is running on http://localhost:${info.port}`)
    console.log('🔧 Health check available at: http://localhost:' + info.port + '/health')
    console.log('📋 French Heritage API at: http://localhost:' + info.port + '/french-heritage')
  }
)
