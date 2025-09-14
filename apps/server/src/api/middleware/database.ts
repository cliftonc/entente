import type { Context, Next } from 'hono'
import { createDatabase } from '../../db/client'
import { getRequiredEnv } from './env'
import { timeOperation } from './performance'

// Extend Hono context with database
declare module 'hono' {
  interface ContextVariableMap {
    db: ReturnType<typeof createDatabase>
  }
}

export async function databaseMiddleware(c: Context, next: Next) {
  try {
    const env = c.get('env')
    const databaseUrl = getRequiredEnv(env, 'DATABASE_URL')

    // Time database connection creation
    const db = await timeOperation(c, 'Database Connection Creation', async () => {
      return createDatabase(databaseUrl)
    })

    c.set('db', db)

    await next()
  } catch (error) {
    console.error('Database middleware error:', error)
    return c.json({ error: 'Database configuration error' }, 500)
  }
}
