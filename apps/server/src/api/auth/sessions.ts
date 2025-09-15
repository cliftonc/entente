import { eq } from 'drizzle-orm'
import type { createDatabase } from '../../db/client'
import { userSessions, users } from '../../db/schema'

const SESSION_EXPIRES_IN = 1000 * 60 * 60 * 24 * 7 // 7 days

export function generateSessionId(): string {
  // Generate cryptographically secure random session ID
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}

export async function createSession(
  db: ReturnType<typeof createDatabase>,
  userId: string,
  selectedTenantId?: string
): Promise<string> {
  const sessionId = generateSessionId()
  const expiresAt = new Date(Date.now() + SESSION_EXPIRES_IN)

  await db.insert(userSessions).values({
    id: sessionId,
    userId,
    selectedTenantId,
    expiresAt,
  })

  return sessionId
}

export async function validateSession(db: ReturnType<typeof createDatabase>, sessionId: string) {
  const result = await db
    .select({
      user: users,
      session: userSessions,
    })
    .from(userSessions)
    .innerJoin(users, eq(userSessions.userId, users.id))
    .where(eq(userSessions.id, sessionId))
    .limit(1)

  if (result.length === 0) {
    return { user: null, session: null }
  }

  const { user, session } = result[0]

  // Check if session is expired
  if (session.expiresAt < new Date()) {
    await deleteSession(db, sessionId)
    return { user: null, session: null }
  }

  // Extend session if it's close to expiring (within 1 day)
  const oneDay = 1000 * 60 * 60 * 24
  if (session.expiresAt.getTime() - Date.now() < oneDay) {
    await extendSession(db, sessionId)
  }

  return { user, session }
}

export async function deleteSession(
  db: ReturnType<typeof createDatabase>,
  sessionId: string
): Promise<void> {
  await db.delete(userSessions).where(eq(userSessions.id, sessionId))
}

export async function extendSession(
  db: ReturnType<typeof createDatabase>,
  sessionId: string
): Promise<void> {
  const newExpiresAt = new Date(Date.now() + SESSION_EXPIRES_IN)
  await db
    .update(userSessions)
    .set({ expiresAt: newExpiresAt })
    .where(eq(userSessions.id, sessionId))
}

export async function updateSelectedTenant(
  db: ReturnType<typeof createDatabase>,
  sessionId: string,
  selectedTenantId: string | null
): Promise<void> {
  await db
    .update(userSessions)
    .set({ selectedTenantId })
    .where(eq(userSessions.id, sessionId))
}

export async function deleteUserSessions(
  db: ReturnType<typeof createDatabase>,
  userId: string
): Promise<void> {
  await db.delete(userSessions).where(eq(userSessions.userId, userId))
}

export function createSessionCookie(sessionId: string): string {
  const expires = new Date(Date.now() + SESSION_EXPIRES_IN)
  const isProduction = process.env.NODE_ENV === 'production'
  const secure = isProduction ? '; Secure' : ''

  // No domain attribute - let the browser handle it naturally
  const cookieString = `sessionId=${sessionId}; HttpOnly; SameSite=Lax; Path=/; Expires=${expires.toUTCString()}${secure}`
  console.log('🍪 Creating session cookie:', { isProduction, secure, cookieString: cookieString.substring(0, 100) + '...' })
  return cookieString
}

export function deleteSessionCookie(): string {
  const isProduction = process.env.NODE_ENV === 'production'
  const secure = isProduction ? '; Secure' : ''
  return `sessionId=; HttpOnly; SameSite=Lax; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secure}`
}
