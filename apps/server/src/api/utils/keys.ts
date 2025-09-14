import { createHash, randomBytes } from 'node:crypto'

export function generateApiKey(): { fullKey: string; keyHash: string; keyPrefix: string } {
  const keyBytes = randomBytes(32)
  const fullKey = `ent_${keyBytes.toString('hex')}`
  const keyHash = createHash('sha256').update(fullKey).digest('hex')
  const keyPrefix = `${fullKey.substring(0, 12)}...`

  return { fullKey, keyHash, keyPrefix }
}
