import { GitHub } from 'arctic'

interface GitHubUser {
  id: number
  login: string
  email: string | null
  name: string
  avatar_url: string
}

export function getGitHubOAuth(clientId: string, clientSecret: string, appUrl: string): GitHub {
  return new GitHub(clientId, clientSecret, `${appUrl}/auth/github/callback`)
}

export async function fetchGitHubUser(accessToken: string): Promise<GitHubUser> {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'User-Agent': 'Entente-Server',
    },
  })

  if (!response.ok) {
    throw new Error('Failed to fetch GitHub user')
  }

  return response.json()
}

export function generateState(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}

export function createStateCookie(state: string): string {
  const expires = new Date(Date.now() + 1000 * 60 * 10) // 10 minutes
  return `github_oauth_state=${state}; HttpOnly; SameSite=Lax; Path=/; Expires=${expires.toUTCString()}; Secure`
}

export function deleteStateCookie(): string {
  return 'github_oauth_state=; HttpOnly; SameSite=Lax; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure'
}
