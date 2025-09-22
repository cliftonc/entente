import { getApiKey } from './config.js'

async function getAuthHeaders(): Promise<Record<string, string>> {
  const apiKey = await getApiKey()

  if (!apiKey) {
    throw new Error('Not authenticated. Please run "entente login" first.')
  }

  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }
}

export async function makeAuthenticatedRequest(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = await getAuthHeaders()

  const response = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  })

  if (response.status === 401) {
    throw new Error('Authentication failed. Please run "entente login" to re-authenticate.')
  }

  return response
}