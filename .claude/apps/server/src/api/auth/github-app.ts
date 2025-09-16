import { App } from '@octokit/app'
import type { Octokit } from '@octokit/rest'
import { eq } from 'drizzle-orm'
import { githubAppInstallations } from '../../db/schema'
import type { Database } from '../db/database'

interface GitHubInstallationInfo {
  id: number
  account: {
    id: number
    login: string
    type: 'User' | 'Organization'
  }
  repository_selection: 'all' | 'selected'
  repositories?: Array<{
    id: number
    name: string
    full_name: string
    private: boolean
  }>
  permissions: Record<string, string>
  suspended_at?: string
}

// In-memory cache for Octokit instances
const octokitCache = new Map<string, { octokit: Octokit; expiresAt: Date }>()

export function createGitHubApp(appId: string, privateKey: string): App {
  return new App({
    appId: appId,
    privateKey: privateKey,
  })
}

export async function createInstallationToken(
  installationId: number,
  appId: string,
  privateKey: string
): Promise<string> {
  const app = createGitHubApp(appId, privateKey)

  // Create installation access token
  const { data } = await app.octokit.request(
    'POST /app/installations/{installation_id}/access_tokens',
    {
      installation_id: installationId,
    }
  )

  return data.token
}

export async function getInstallationOctokit(
  installationId: number,
  appId: string,
  privateKey: string
): Promise<Octokit> {
  const cacheKey = `${appId}-${installationId}`
  const cached = octokitCache.get(cacheKey)

  if (cached && cached.expiresAt > new Date()) {
    return cached.octokit
  }

  const app = createGitHubApp(appId, privateKey)
  const octokit = await app.getInstallationOctokit(installationId)

  // Cache for 50 minutes (tokens expire in 1 hour)
  const expiresAt = new Date(Date.now() + 50 * 60 * 1000)
  octokitCache.set(cacheKey, { octokit, expiresAt })

  return octokit
}

export async function getInstallationInfo(
  installationId: number,
  appId: string,
  privateKey: string
): Promise<GitHubInstallationInfo> {
  const app = createGitHubApp(appId, privateKey)

  // Use app-level authentication to get installation info
  const { data: installationData } = await app.octokit.request(
    'GET /app/installations/{installation_id}',
    {
      installation_id: installationId,
    }
  )

  return {
    id: installationData.id,
    account: {
      id: installationData.account?.id || 0,
      login: installationData.account?.login || '',
      type: installationData.account?.type as 'User' | 'Organization',
    },
    repository_selection: installationData.repository_selection as 'all' | 'selected',
    permissions: installationData.permissions,
    suspended_at: installationData.suspended_at || undefined,
  }
}

export async function getInstallationRepositories(
  installationId: number,
  appId: string,
  privateKey: string
): Promise<Array<{ id: number; name: string; full_name: string; private: boolean }>> {
  const octokit = await getInstallationOctokit(installationId, appId, privateKey)

  const { data } = await octokit.rest.apps.listReposAccessibleToInstallation({
    per_page: 100,
  })

  return data.repositories.map(repo => ({
    id: repo.id,
    name: repo.name,
    full_name: repo.full_name,
    private: repo.private,
  }))
}

// Simple Base64 encoding for private keys (not encryption, just encoding for storage)
export function encodePrivateKey(privateKey: string): string {
  return Buffer.from(privateKey, 'utf8').toString('base64')
}

export function decodePrivateKey(encodedPrivateKey: string): string {
  return Buffer.from(encodedPrivateKey, 'base64').toString('utf8')
}

export async function getInstallationForTenant(
  db: Database,
  tenantId: string
): Promise<{
  installationId: number
  appId: number
  privateKey: string
} | null> {
  const installations = await db
    .select({
      installationId: githubAppInstallations.installationId,
      appId: githubAppInstallations.appId,
      privateKeyEncrypted: githubAppInstallations.privateKeyEncrypted,
    })
    .from(githubAppInstallations)
    .where(eq(githubAppInstallations.tenantId, tenantId))
    .limit(1)

  if (installations.length === 0) {
    return null
  }

  const installation = installations[0]
  const privateKey = decodePrivateKey(installation.privateKeyEncrypted)

  return {
    installationId: installation.installationId,
    appId: installation.appId,
    privateKey,
  }
}

export async function verifyWebhookSignature(
  payload: string,
  signature: string,
  webhookSecret: string
): Promise<boolean> {
  // Use Web Crypto API for HMAC verification (works in Workers)
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(webhookSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const hmacBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  const hmacArray = Array.from(new Uint8Array(hmacBuffer))
  const hmacHex = hmacArray.map(b => b.toString(16).padStart(2, '0')).join('')
  const expectedSignature = `sha256=${hmacHex}`

  return signature === expectedSignature
}
