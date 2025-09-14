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

  console.log(`🚀 [${c.req.method}] ${c.req.url} - START`)

  await next()

  const totalTime = Date.now() - startTime
  const timings = c.get('timings') || {}

  console.log(`✅ [${c.req.method}] ${c.req.url} - COMPLETE (${totalTime}ms)`)

  // Log detailed timings if we have them
  if (Object.keys(timings).length > 0) {
    console.log('📊 Detailed timings:')
    Object.entries(timings).forEach(([operation, duration]) => {
      console.log(`   ${operation}: ${duration}ms`)
    })
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

      console.log(`⏱️  ${operationName}: ${duration}ms`)
      return result
    })
    .catch(error => {
      const duration = Date.now() - startTime
      const timings = c.get('timings') || {}
      timings[`${operationName} (ERROR)`] = duration
      c.set('timings', timings)

      console.log(`❌ ${operationName}: ${duration}ms (ERROR: ${error.message})`)
      throw error
    })
}
