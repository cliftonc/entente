import { createHash } from 'crypto'
import type { ApiKey, CreateKeyRequest, RevokeKeyRequest } from '@entente/types'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { Hono } from 'hono'
import { keys } from '../../db/schema'
import { generateApiKey } from '../utils/keys'

export const keysRouter = new Hono()

// Create new API key
keysRouter.post('/', async c => {
  const body: CreateKeyRequest = await c.req.json()

  if (!body.name || !body.createdBy) {
    return c.json({ error: 'Name and createdBy are required' }, 400)
  }

  const db = c.get('db')
  const { tenantId } = c.get('session')
  const { fullKey, keyHash, keyPrefix } = generateApiKey()

  const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null

  const [newKey] = await db
    .insert(keys)
    .values({
      tenantId,
      name: body.name,
      keyHash,
      keyPrefix,
      createdBy: body.createdBy,
      expiresAt,
      permissions: body.permissions || 'read,write',
    })
    .returning()

  const response: ApiKey = {
    id: newKey.id,
    name: newKey.name,
    keyPrefix: newKey.keyPrefix,
    fullKey, // Only returned on creation
    createdBy: newKey.createdBy,
    expiresAt: newKey.expiresAt?.toISOString() || null,
    lastUsedAt: newKey.lastUsedAt?.toISOString() || null,
    isActive: newKey.isActive,
    permissions: newKey.permissions,
    createdAt: newKey.createdAt.toISOString(),
    revokedAt: newKey.revokedAt?.toISOString() || null,
    revokedBy: newKey.revokedBy || null,
  }

  console.log(`🔑 Created API key "${body.name}" for ${body.createdBy}`)

  return c.json(response, 201)
})

// List API keys
keysRouter.get('/', async c => {
  const db = c.get('db')
  const includeRevoked = c.req.query('includeRevoked') === 'true'
  const { tenantId } = c.get('session')

  const whereConditions = [eq(keys.tenantId, tenantId)]

  if (!includeRevoked) {
    whereConditions.push(isNull(keys.revokedAt))
  }

  const dbKeys = await db.query.keys.findMany({
    where: and(...whereConditions),
    orderBy: desc(keys.createdAt),
  })

  const keysList: ApiKey[] = dbKeys.map(key => ({
    id: key.id,
    name: key.name,
    keyPrefix: key.keyPrefix,
    createdBy: key.createdBy,
    expiresAt: key.expiresAt?.toISOString() || null,
    lastUsedAt: key.lastUsedAt?.toISOString() || null,
    isActive: key.isActive,
    permissions: key.permissions,
    createdAt: key.createdAt.toISOString(),
    revokedAt: key.revokedAt?.toISOString() || null,
    revokedBy: key.revokedBy || null,
  }))

  return c.json(keysList)
})

// Get single API key
keysRouter.get('/:id', async c => {
  const db = c.get('db')
  const keyId = c.req.param('id')
  const { tenantId } = c.get('session')

  const key = await db.query.keys.findFirst({
    where: and(eq(keys.tenantId, tenantId), eq(keys.id, keyId)),
  })

  if (!key) {
    return c.json({ error: 'API key not found' }, 404)
  }

  const response: ApiKey = {
    id: key.id,
    name: key.name,
    keyPrefix: key.keyPrefix,
    createdBy: key.createdBy,
    expiresAt: key.expiresAt?.toISOString() || null,
    lastUsedAt: key.lastUsedAt?.toISOString() || null,
    isActive: key.isActive,
    permissions: key.permissions,
    createdAt: key.createdAt.toISOString(),
    revokedAt: key.revokedAt?.toISOString() || null,
    revokedBy: key.revokedBy || null,
  }

  return c.json(response)
})

// Revoke API key
keysRouter.delete('/:id', async c => {
  const db = c.get('db')
  const keyId = c.req.param('id')
  const body: RevokeKeyRequest = await c.req.json()
  const { tenantId } = c.get('session')

  if (!body.revokedBy) {
    return c.json({ error: 'revokedBy is required' }, 400)
  }

  const [revokedKey] = await db
    .update(keys)
    .set({
      isActive: false,
      revokedAt: new Date(),
      revokedBy: body.revokedBy,
    })
    .where(
      and(
        eq(keys.tenantId, tenantId),
        eq(keys.id, keyId),
        isNull(keys.revokedAt) // Only revoke if not already revoked
      )
    )
    .returning()

  if (!revokedKey) {
    return c.json({ error: 'API key not found or already revoked' }, 404)
  }

  console.log(`🗑️ Revoked API key "${revokedKey.name}" by ${body.revokedBy}`)

  return c.json({
    status: 'revoked',
    id: revokedKey.id,
    name: revokedKey.name,
    revokedAt: revokedKey.revokedAt?.toISOString(),
    revokedBy: revokedKey.revokedBy,
  })
})

// Update key usage (internal function for middleware)
export async function updateKeyUsage(db: any, keyHash: string): Promise<void> {
  await db.update(keys).set({ lastUsedAt: new Date() }).where(eq(keys.keyHash, keyHash))
}

// Validate API key (internal function for middleware)
export async function validateApiKey(
  db: any,
  apiKey: string
): Promise<{ valid: boolean; tenantId?: string; permissions?: string[] }> {
  if (!apiKey.startsWith('ent_')) {
    return { valid: false }
  }

  const keyHash = createHash('sha256').update(apiKey).digest('hex')

  const key = await db.query.keys.findFirst({
    where: and(eq(keys.keyHash, keyHash), eq(keys.isActive, true), isNull(keys.revokedAt)),
  })

  if (!key) {
    return { valid: false }
  }

  // Check if key is expired
  if (key.expiresAt && key.expiresAt < new Date()) {
    return { valid: false }
  }

  const permissions = key.permissions.split(',').map(p => p.trim())

  return {
    valid: true,
    tenantId: key.tenantId,
    permissions,
  }
}
