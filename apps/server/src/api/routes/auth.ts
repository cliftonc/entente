import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'
import { tenantUsers, tenants, users } from '../../db/schema'
import {
  createStateCookie,
  deleteStateCookie,
  fetchGitHubUser,
  generateState,
  getGitHubOAuth,
} from '../auth/github'
import {
  createSession,
  createSessionCookie,
  deleteSession,
  deleteSessionCookie,
  validateSession,
} from '../auth/sessions'
import { getEnv, getRequiredEnv } from '../middleware/env'

const authRouter = new Hono()

// Initiate GitHub OAuth
authRouter.get('/github', async c => {
  try {
    const env = c.get('env')
    const clientId = getRequiredEnv(env, 'GITHUB_CLIENT_ID')
    const clientSecret = getRequiredEnv(env, 'GITHUB_CLIENT_SECRET')
    const appUrl = getEnv(env, 'APP_URL') || 'https://entente.dev'

    const github = getGitHubOAuth(clientId, clientSecret, appUrl)
    const state = generateState()
    const url = await github.createAuthorizationURL(state, ['user:email'])

    // Store state in cookie for verification
    c.header('Set-Cookie', createStateCookie(state))

    // Redirect directly to GitHub
    return c.redirect(url.toString())
  } catch (error) {
    console.error('GitHub OAuth initialization error:', error)
    return c.json({ error: 'Failed to initialize GitHub OAuth' }, 500)
  }
})

// Handle GitHub OAuth callback
authRouter.get('/github/callback', async c => {
  const code = c.req.query('code')
  const state = c.req.query('state')
  const storedState = getCookie(c, 'github_oauth_state')

  if (!code || !state || !storedState) {
    return c.json({ error: 'Invalid OAuth callback' }, 400)
  }

  // Check for CLI flow
  const cliRedirectUri = getCookie(c, 'cli_redirect_uri')

  // Regular state validation for both flows
  if (state !== storedState) {
    return c.json({ error: 'Invalid OAuth state' }, 400)
  }

  try {
    const db = c.get('db')
    const env = c.get('env')
    const clientId = getRequiredEnv(env, 'GITHUB_CLIENT_ID')
    const clientSecret = getRequiredEnv(env, 'GITHUB_CLIENT_SECRET')
    const appUrl = getEnv(env, 'APP_URL') || 'https://entente.dev'

    const github = getGitHubOAuth(clientId, clientSecret, appUrl)
    const tokens = await github.validateAuthorizationCode(code)
    const githubUser = await fetchGitHubUser(tokens.accessToken())

    // Check if user exists
    let user = await db.select().from(users).where(eq(users.githubId, githubUser.id)).limit(1)

    if (user.length === 0) {
      // Create new user
      const newUser = await db
        .insert(users)
        .values({
          githubId: githubUser.id,
          username: githubUser.login,
          email: githubUser.email,
          name: githubUser.name || githubUser.login,
          avatarUrl: githubUser.avatar_url,
        })
        .returning()

      user = newUser

      // Create personal tenant for new user
      const tenant = await db
        .insert(tenants)
        .values({
          name: `${githubUser.name || githubUser.login}'s Team`,
          slug: githubUser.login,
        })
        .returning()

      // Link user to tenant as owner
      await db.insert(tenantUsers).values({
        tenantId: tenant[0].id,
        userId: user[0].id,
        role: 'owner',
      })
    } else {
      // Update existing user info
      await db
        .update(users)
        .set({
          username: githubUser.login,
          email: githubUser.email,
          name: githubUser.name || githubUser.login,
          avatarUrl: githubUser.avatar_url,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user[0].id))
    }

    // Create session
    const sessionId = await createSession(db, user[0].id)

    // Clear state cookie and set session cookie
    c.header('Set-Cookie', deleteStateCookie())
    c.header('Set-Cookie', createSessionCookie(sessionId))

    // Handle CLI flow
    if (cliRedirectUri) {
      // Get user's tenant for API key creation
      const userTenant = await db
        .select({ tenantId: tenantUsers.tenantId })
        .from(tenantUsers)
        .where(eq(tenantUsers.userId, user[0].id))
        .limit(1)

      if (userTenant.length === 0) {
        // Clear CLI cookie
        c.header(
          'Set-Cookie',
          'cli_redirect_uri=; HttpOnly; SameSite=Lax; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure'
        )
        return c.redirect(
          `${cliRedirectUri}?error=${encodeURIComponent('User has no associated tenant')}`
        )
      }

      const keyName = `user-${user[0].username}`

      // Create or update API key for CLI
      const { keys } = await import('../../db/schema')
      const { and } = await import('drizzle-orm')

      // Check if API key already exists
      const existingKey = await db
        .select()
        .from(keys)
        .where(
          and(
            eq(keys.tenantId, userTenant[0].tenantId),
            eq(keys.name, keyName),
            eq(keys.isActive, true)
          )
        )
        .limit(1)

      let apiKey: string
      if (existingKey.length > 0) {
        // Generate new key data for existing key
        const { generateApiKey } = await import('../utils/keys')
        const keyData = generateApiKey()

        // Update the existing key with new hash
        await db
          .update(keys)
          .set({
            keyHash: keyData.keyHash,
            keyPrefix: keyData.keyPrefix,
            lastUsedAt: new Date(),
          })
          .where(eq(keys.id, existingKey[0].id))

        apiKey = keyData.fullKey
      } else {
        // Create new API key
        const { generateApiKey } = await import('../utils/keys')
        const keyData = generateApiKey()

        await db.insert(keys).values({
          tenantId: userTenant[0].tenantId,
          name: keyName,
          keyHash: keyData.keyHash,
          keyPrefix: keyData.keyPrefix,
          createdBy: user[0].username,
          permissions: 'read,write',
        })

        apiKey = keyData.fullKey
      }

      // Clear CLI cookie and redirect to CLI callback with API key
      c.header(
        'Set-Cookie',
        'cli_redirect_uri=; HttpOnly; SameSite=Lax; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure'
      )
      return c.redirect(`${cliRedirectUri}?key=${encodeURIComponent(apiKey)}`)
    }

    // Regular web flow - redirect to dashboard
    return c.redirect('/')
  } catch (error) {
    console.error('GitHub OAuth callback error:', error)
    c.header('Set-Cookie', deleteStateCookie())

    // Handle CLI error redirect
    if (cliRedirectUri) {
      c.header(
        'Set-Cookie',
        'cli_redirect_uri=; HttpOnly; SameSite=Lax; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure'
      )
      return c.redirect(
        `${cliRedirectUri}?error=${encodeURIComponent('OAuth authentication failed')}`
      )
    }

    return c.json({ error: 'OAuth authentication failed' }, 500)
  }
})

// Get current session info
authRouter.get('/session', async c => {
  const db = c.get('db')

  // Try API key authentication first
  const authHeader = c.req.header('Authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const apiKey = authHeader.substring(7)
    const { validateApiKey } = await import('./keys')
    const validation = await validateApiKey(db, apiKey)

    if (validation.valid && validation.tenantId) {
      // Get user info from tenant membership
      const userTenant = await db
        .select({
          user: users,
          role: tenantUsers.role,
        })
        .from(tenantUsers)
        .innerJoin(users, eq(tenantUsers.userId, users.id))
        .where(eq(tenantUsers.tenantId, validation.tenantId))
        .limit(1)

      if (userTenant.length > 0) {
        const user = userTenant[0].user

        // Get all user's tenants
        const userTenants = await db
          .select({
            tenant: tenants,
            role: tenantUsers.role,
            joinedAt: tenantUsers.joinedAt,
          })
          .from(tenantUsers)
          .innerJoin(tenants, eq(tenantUsers.tenantId, tenants.id))
          .where(eq(tenantUsers.userId, user.id))

        return c.json({
          authenticated: true,
          user: {
            id: user.id,
            githubId: user.githubId,
            username: user.username,
            email: user.email,
            name: user.name,
            avatarUrl: user.avatarUrl,
          },
          tenants: userTenants,
          apiKey: true, // Indicate this is API key auth
        })
      }
    }
  }

  // Fall back to session-based authentication
  const sessionId = getCookie(c, 'sessionId')

  if (!sessionId) {
    return c.json({ authenticated: false })
  }

  const { user, session } = await validateSession(db, sessionId)

  if (!user || !session) {
    c.header('Set-Cookie', deleteSessionCookie())
    return c.json({ authenticated: false })
  }

  // Get user's tenants
  const userTenants = await db
    .select({
      tenant: tenants,
      role: tenantUsers.role,
      joinedAt: tenantUsers.joinedAt,
    })
    .from(tenantUsers)
    .innerJoin(tenants, eq(tenantUsers.tenantId, tenants.id))
    .where(eq(tenantUsers.userId, user.id))

  return c.json({
    authenticated: true,
    user: {
      id: user.id,
      githubId: user.githubId,
      username: user.username,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
    },
    tenants: userTenants,
    session: {
      id: session.id,
      expiresAt: session.expiresAt,
    },
  })
})

// Logout
authRouter.post('/logout', async c => {
  const sessionId = getCookie(c, 'sessionId')

  if (sessionId) {
    const db = c.get('db')
    await deleteSession(db, sessionId)
  }

  c.header('Set-Cookie', deleteSessionCookie())
  return c.json({ success: true })
})

// CLI Authentication endpoints
authRouter.get('/cli', async c => {
  const redirectUri = c.req.query('redirect_uri')

  if (!redirectUri) {
    return c.json({ error: 'redirect_uri parameter required' }, 400)
  }

  // Check if user is already authenticated
  const sessionId = getCookie(c, 'sessionId')

  if (sessionId) {
    const db = c.get('db')
    const { user, session } = await validateSession(db, sessionId)

    if (user && session) {
      // User is already authenticated, get or create API key
      const { keys } = await import('../../db/schema')
      const { eq, and } = await import('drizzle-orm')

      // Get user's tenant
      const userTenant = await db
        .select({ tenantId: tenantUsers.tenantId })
        .from(tenantUsers)
        .where(eq(tenantUsers.userId, user.id))
        .limit(1)

      if (userTenant.length === 0) {
        return c.json({ error: 'User has no associated tenant' }, 500)
      }

      const keyName = `user-${user.username}`

      // Check if API key already exists
      const existingKey = await db
        .select()
        .from(keys)
        .where(
          and(
            eq(keys.tenantId, userTenant[0].tenantId),
            eq(keys.name, keyName),
            eq(keys.isActive, true)
          )
        )
        .limit(1)

      let apiKey: string
      if (existingKey.length > 0) {
        // Use existing key - but we can't return the actual key from DB since it's hashed
        // So we need to generate a new one
        const { generateApiKey } = await import('../utils/keys')
        const keyData = generateApiKey()

        // Update the existing key with new hash
        await db
          .update(keys)
          .set({
            keyHash: keyData.keyHash,
            keyPrefix: keyData.keyPrefix,
            lastUsedAt: new Date(),
          })
          .where(eq(keys.id, existingKey[0].id))

        apiKey = keyData.fullKey
      } else {
        // Create new API key
        const { generateApiKey } = await import('../utils/keys')
        const keyData = generateApiKey()

        await db.insert(keys).values({
          tenantId: userTenant[0].tenantId,
          name: keyName,
          keyHash: keyData.keyHash,
          keyPrefix: keyData.keyPrefix,
          createdBy: user.username,
          permissions: 'read,write',
        })

        apiKey = keyData.fullKey
      }

      // Redirect to CLI callback with API key
      return c.redirect(`${redirectUri}?key=${encodeURIComponent(apiKey)}`)
    }
  }

  // User not authenticated, show login page
  // Store CLI redirect URI in a cookie and redirect to GitHub OAuth
  const expires = new Date(Date.now() + 1000 * 60 * 10) // 10 minutes
  c.header(
    'Set-Cookie',
    `cli_redirect_uri=${encodeURIComponent(redirectUri)}; HttpOnly; SameSite=Lax; Path=/; Expires=${expires.toUTCString()}; Secure`
  )

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Entente CLI Authentication</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body {
            font-family: system-ui, -apple-system, sans-serif;
            margin: 0;
            padding: 40px 20px;
            background: #f8fafc;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .container {
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            text-align: center;
            max-width: 400px;
            width: 100%;
          }
          h1 {
            color: #1f2937;
            margin-bottom: 16px;
            font-size: 24px;
            font-weight: 600;
          }
          p {
            color: #6b7280;
            margin-bottom: 32px;
            line-height: 1.5;
          }
          .btn {
            background: #1f2937;
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 500;
            cursor: pointer;
            text-decoration: none;
            display: inline-block;
            transition: background-color 0.2s;
          }
          .btn:hover {
            background: #374151;
          }
          .cli-info {
            background: #f3f4f6;
            padding: 16px;
            border-radius: 8px;
            margin-bottom: 24px;
            font-size: 14px;
            color: #4b5563;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🔐 CLI Authentication</h1>
          <div class="cli-info">
            You are authenticating the Entente CLI tool.<br>
            After login, you'll be redirected back to your terminal.
          </div>
          <p>Click the button below to authenticate with your GitHub account:</p>
          <a href="/auth/github" class="btn">
            Login with GitHub
          </a>
        </div>
      </body>
    </html>
  `

  return c.html(html)
})

export { authRouter }
