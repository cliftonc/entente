import type { Context, Next } from 'hono'
import { validateApiKey, updateKeyUsage } from '../routes/keys'
import { validateSession } from '../auth/sessions'
import { getCookie } from 'hono/cookie'
import { createHash } from 'crypto'
import { eq } from 'drizzle-orm'
import { tenantUsers } from '../../db/schema'

export interface AuthContext {
  tenantId: string
  permissions: string[]
  apiKey?: string
  userId?: string
  user?: {
    id: string
    githubId: number
    username: string
    email: string
    name: string
    avatarUrl: string | null
  }
}

export interface SessionContext {
  tenantId: string
  userId?: string
  permissions: string[]
}

declare module 'hono' {
  interface ContextVariableMap {
    auth: AuthContext
    session: SessionContext
  }
}

export async function authMiddleware(c: Context, next: Next) {
  // Try API key authentication first
  const authHeader = c.req.header('Authorization')

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const db = c.get('db')
    const apiKey = authHeader.substring(7)
    const validation = await validateApiKey(db, apiKey)

    if (validation.valid && validation.tenantId && validation.permissions) {
      // Update key usage asynchronously
      const keyHash = createHash('sha256').update(apiKey).digest('hex')
      updateKeyUsage(db, keyHash).catch(err => {
        console.error('Failed to update key usage:', err)
      })

      // Set auth context for API key
      c.set('auth', {
        tenantId: validation.tenantId,
        permissions: validation.permissions,
        apiKey,
      })

      // Set session context for consistent access
      c.set('session', {
        tenantId: validation.tenantId,
        permissions: validation.permissions,
      })

      await next()
      return
    }
  }

  // Try session-based authentication
  const sessionId = getCookie(c, 'sessionId')

  if (sessionId) {
    const db = c.get('db')
    const { user, session } = await validateSession(db, sessionId)

    if (user && session) {
      // Get user's default tenant (for now, we'll use the first one they belong to)
      const userTenant = await db
        .select({ tenantId: tenantUsers.tenantId, role: tenantUsers.role })
        .from(tenantUsers)
        .where(eq(tenantUsers.userId, user.id))
        .limit(1)

      if (userTenant.length > 0) {
        // Map role to permissions
        const permissions = userTenant[0].role === 'owner'
          ? ['admin', 'read', 'write']
          : ['read', 'write']

        c.set('auth', {
          tenantId: userTenant[0].tenantId,
          permissions,
          userId: user.id,
          user: {
            id: user.id,
            githubId: user.githubId,
            username: user.username,
            email: user.email,
            name: user.name,
            avatarUrl: user.avatarUrl,
          },
        })

        // Set session context for consistent access
        c.set('session', {
          tenantId: userTenant[0].tenantId,
          userId: user.id,
          permissions,
        })

        await next()
        return
      }
    }
  }

  return c.json({ error: 'Authentication required' }, 401)
}

export function requirePermission(permission: string) {
  return async (c: Context, next: Next) => {
    const auth = c.get('auth')

    if (!auth) {
      return c.json({ error: 'Authentication required' }, 401)
    }

    if (!auth.permissions.includes(permission) && !auth.permissions.includes('admin')) {
      return c.json({ error: `Permission '${permission}' required` }, 403)
    }

    await next()
  }
}