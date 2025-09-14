import type { Context, Next } from 'hono'
import { validateApiKey, updateKeyUsage } from '../routes/keys'
import { validateSession } from '../auth/sessions'
import { getCookie } from 'hono/cookie'
import { createHash } from 'crypto'
import { eq } from 'drizzle-orm'
import { tenantUsers, users, userSessions } from '../../db/schema'
import { timeOperation } from './performance'

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

    const validation = await timeOperation(c, 'API Key Validation', async () => {
      return validateApiKey(db, apiKey)
    })

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

    // Combined query: validate session + get user + get tenant in one call
    const result = await timeOperation(c, 'Session Validation Query', async () => {
      return db
        .select({
          user: {
            id: users.id,
            githubId: users.githubId,
            username: users.username,
            email: users.email,
            name: users.name,
            avatarUrl: users.avatarUrl,
          },
          session: userSessions,
          tenantId: tenantUsers.tenantId,
          role: tenantUsers.role,
        })
        .from(userSessions)
        .innerJoin(users, eq(userSessions.userId, users.id))
        .innerJoin(tenantUsers, eq(tenantUsers.userId, users.id))
        .where(eq(userSessions.id, sessionId))
        .limit(1)
    })

    if (result.length > 0) {
      const { user, session, tenantId, role } = result[0]

      // Check if session is expired
      if (session.expiresAt < new Date()) {
        // Delete expired session asynchronously
        db.delete(userSessions).where(eq(userSessions.id, sessionId)).catch(err => {
          console.error('Failed to delete expired session:', err)
        })
      } else {
        // Extend session if it's close to expiring (within 1 day) - async
        const oneDay = 1000 * 60 * 60 * 24
        if (session.expiresAt.getTime() - Date.now() < oneDay) {
          const newExpiresAt = new Date(Date.now() + (1000 * 60 * 60 * 24 * 7)) // 7 days
          db.update(userSessions)
            .set({ expiresAt: newExpiresAt })
            .where(eq(userSessions.id, sessionId))
            .catch(err => {
              console.error('Failed to extend session:', err)
            })
        }

        // Map role to permissions
        const permissions = role === 'owner'
          ? ['admin', 'read', 'write']
          : ['read', 'write']

        c.set('auth', {
          tenantId,
          permissions,
          userId: user.id,
          user,
        })

        // Set session context for consistent access
        c.set('session', {
          tenantId,
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