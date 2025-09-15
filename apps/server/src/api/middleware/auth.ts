import { and, eq } from 'drizzle-orm'
import type { Context, Next } from 'hono'
import { getCookie } from 'hono/cookie'
import { tenantUsers, userSessions, users } from '../../db/schema'
import { validateSession } from '../auth/sessions'
import { updateKeyUsage, validateApiKey } from '../routes/keys'
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

  if (authHeader?.startsWith('Bearer ')) {
    const db = c.get('db')
    const apiKey = authHeader.substring(7)

    const validation = await timeOperation(c, 'API Key Validation', async () => {
      return validateApiKey(db, apiKey)
    })

    if (validation.valid && validation.tenantId && validation.permissions) {
      // Update key usage asynchronously
      updateKeyUsage(db, apiKey).catch(err => {
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

    // First, validate session and get user
    const sessionResult = await timeOperation(c, 'Session Validation Query', async () => {
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
        })
        .from(userSessions)
        .innerJoin(users, eq(userSessions.userId, users.id))
        .where(eq(userSessions.id, sessionId))
        .limit(1)
    })

    if (sessionResult.length > 0) {
      const { user, session } = sessionResult[0]

      // Check if session is expired
      if (session.expiresAt < new Date()) {
        // Delete expired session asynchronously
        db.delete(userSessions)
          .where(eq(userSessions.id, sessionId))
          .catch(err => {
            console.error('Failed to delete expired session:', err)
          })
      } else {
        // Extend session if it's close to expiring (within 1 day) - async
        const oneDay = 1000 * 60 * 60 * 24
        if (session.expiresAt.getTime() - Date.now() < oneDay) {
          const newExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7) // 7 days
          db.update(userSessions)
            .set({ expiresAt: newExpiresAt })
            .where(eq(userSessions.id, sessionId))
            .catch(err => {
              console.error('Failed to extend session:', err)
            })
        }

        // Determine which tenant to use
        let selectedTenantId = session.selectedTenantId
        let selectedRole = 'member'

        if (selectedTenantId) {
          // User has selected a specific tenant, get their role
          const tenantMembership = await db
            .select({ role: tenantUsers.role })
            .from(tenantUsers)
            .where(and(
              eq(tenantUsers.userId, user.id),
              eq(tenantUsers.tenantId, selectedTenantId)
            ))
            .limit(1)

          if (tenantMembership.length > 0) {
            selectedRole = tenantMembership[0].role
          } else {
            // User no longer has access to selected tenant, clear selection
            db.update(userSessions)
              .set({ selectedTenantId: null })
              .where(eq(userSessions.id, sessionId))
              .catch(err => {
                console.error('Failed to clear invalid tenant selection:', err)
              })
            selectedTenantId = null
          }
        }

        if (!selectedTenantId) {
          // No tenant selected or selection invalid, use first available
          const firstTenant = await db
            .select({ tenantId: tenantUsers.tenantId, role: tenantUsers.role })
            .from(tenantUsers)
            .where(eq(tenantUsers.userId, user.id))
            .limit(1)

          if (firstTenant.length > 0) {
            selectedTenantId = firstTenant[0].tenantId
            selectedRole = firstTenant[0].role
          }
        }

        if (!selectedTenantId) {
          // User has no tenant access
          return c.json({ error: 'No tenant access' }, 403)
        }

        // Map role to permissions
        const permissions = selectedRole === 'owner' ? ['admin', 'read', 'write'] : ['read', 'write']

        c.set('auth', {
          tenantId: selectedTenantId,
          permissions,
          userId: user.id,
          user,
        })

        // Set session context for consistent access
        c.set('session', {
          tenantId: selectedTenantId,
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
