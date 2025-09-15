import type { Context, Next } from 'hono'

// Performance timing context
declare module 'hono' {
  interface ContextVariableMap {
    startTime: number
    timings: Record<string, number>
  }
}

export async function performanceMiddleware(c: Context, next: Next) {
  const startTime = Date.now()
  c.set('startTime', startTime)
  c.set('timings', {})

  await next()

  const totalTime = Date.now() - startTime
  const timings = c.get('timings') || {}

  // Log detailed timings if we have them
  const env = c.get('env')
  if (Object.keys(timings).length > 0 && env?.DEBUG === 'true') {
    console.log('📊 Detailed timings:')
    for (const [operation, duration] of Object.entries(timings)) {
      console.log(`   ${operation}: ${duration}ms`)
    }
  }
}

// Helper function to time operations
export function timeOperation<T>(
  c: Context,
  operationName: string,
  operation: () => Promise<T>
): Promise<T> {
  const startTime = Date.now()

  return operation()
    .then(result => {
      const duration = Date.now() - startTime
      const timings = c.get('timings') || {}
      timings[operationName] = duration
      c.set('timings', timings)

      const env = c.get('env')
      if (env?.DEBUG === 'true') {
        console.log(`⏱️  ${operationName}: ${duration}ms`)
      }
      return result
    })
    .catch(error => {
      const duration = Date.now() - startTime
      const timings = c.get('timings') || {}
      timings[`${operationName} (ERROR)`] = duration
      c.set('timings', timings)

      const env = c.get('env')
      if (env?.DEBUG === 'true') {
        console.log(`❌ ${operationName}: ${duration}ms (ERROR: ${error.message})`)
      }
      throw error
    })
}
