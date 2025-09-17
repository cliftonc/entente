import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'
import { githubAppInstallations, tenantUsers, tenants, users } from '../../db/schema'
import {
  createStateCookie,
  deleteStateCookie,
  fetchGitHubUser,
  generateState,
  getGitHubOAuth,
} from '../auth/github'
import {
  encodePrivateKey,
  getInstallationInfo,
  getInstallationRepositories,
} from '../auth/github-app'
import {
  createSession,
  createSessionCookie,
  deleteSession,
  updateSelectedTenant,
  validateSession,
} from '../auth/sessions'
import { getEnv, getRequiredEnv } from '../middleware/env'

const authRouter = new Hono()

const isProduction = process.env.NODE_ENV === 'production'

// Unified helper to clear a cookie
function clearCookieHeader(name: string) {
  return `${name}=; HttpOnly; SameSite=Lax; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT${isProduction ? '; Secure' : ''}`
}

// Helper function to handle GitHub App installation
async function handleGitHubAppInstallation(c: any, installationId: string, setupAction: string) {
  try {
    const db = c.get('db')
    const env = c.get('env')

    // Get environment variables for GitHub App
    const appId = getRequiredEnv(env, 'GITHUB_APP_ID')
    const privateKeyBase64 = getRequiredEnv(env, 'GITHUB_APP_PRIVATE_KEY')
    const webhookSecret = getEnv(env, 'GITHUB_APP_WEBHOOK_SECRET')

    // Decode the private key
    const privateKey = Buffer.from(privateKeyBase64, 'base64').toString('utf8')

    // Handle different setup actions
    if (setupAction === 'install' || setupAction === 'update') {
      // Get installation info from GitHub
      const installationInfo = await getInstallationInfo(
        Number.parseInt(installationId),
        appId,
        privateKey
      )

      // Get repositories if selected
      let repositories: Array<{ id: number; name: string; full_name: string; private: boolean }> =
        []
      if (installationInfo.repository_selection === 'selected') {
        repositories = await getInstallationRepositories(
          Number.parseInt(installationId),
          appId,
          privateKey
        )
      }

      // Encode the private key for storage
      const encodedPrivateKey = encodePrivateKey(privateKey)

      // Get current user from session to determine which tenant this belongs to
      const sessionId = getCookie(c, 'sessionId')
      if (!sessionId) {
        return c.json({ error: 'Authentication required to install GitHub App' }, 401)
      }

      const { user } = await validateSession(db, sessionId)
      if (!user) {
        return c.json({ error: 'Invalid session' }, 401)
      }

      // Get user's primary tenant
      const userTenant = await db
        .select({ tenantId: tenantUsers.tenantId })
        .from(tenantUsers)
        .where(eq(tenantUsers.userId, user.id))
        .limit(1)

      if (userTenant.length === 0) {
        return c.json({ error: 'User has no associated tenant' }, 500)
      }

      // Check if installation already exists (for updates)
      const existingInstallation = await db
        .select()
        .from(githubAppInstallations)
        .where(eq(githubAppInstallations.installationId, Number.parseInt(installationId)))
        .limit(1)

      if (existingInstallation.length > 0) {
        // Update existing installation
        await db
          .update(githubAppInstallations)
          .set({
            accountType: installationInfo.account.type.toLowerCase() as 'user' | 'organization',
            accountLogin: installationInfo.account.login,
            targetType: installationInfo.account.type,
            permissions: installationInfo.permissions,
            repositorySelection: installationInfo.repository_selection,
            selectedRepositories: repositories.length > 0 ? repositories : null,
            appId: Number.parseInt(appId),
            privateKeyEncrypted: encodedPrivateKey,
            webhookSecret: webhookSecret || null,
            suspendedAt: installationInfo.suspended_at
              ? new Date(installationInfo.suspended_at)
              : null,
            updatedAt: new Date(),
          })
          .where(eq(githubAppInstallations.installationId, Number.parseInt(installationId)))
      } else {
        // Create new installation
        await db.insert(githubAppInstallations).values({
          tenantId: userTenant[0].tenantId,
          installationId: Number.parseInt(installationId),
          accountType: installationInfo.account.type.toLowerCase() as 'user' | 'organization',
          accountLogin: installationInfo.account.login,
          targetType: installationInfo.account.type,
          permissions: installationInfo.permissions,
          repositorySelection: installationInfo.repository_selection,
          selectedRepositories: repositories.length > 0 ? repositories : null,
          appId: Number.parseInt(appId),
          privateKeyEncrypted: encodedPrivateKey,
          webhookSecret: webhookSecret || null,
          suspendedAt: installationInfo.suspended_at
            ? new Date(installationInfo.suspended_at)
            : null,
        })
      }

      // Redirect to settings/github with success message
      return c.redirect('/settings/github')
    }

    if (setupAction === 'request') {
      // Installation requires approval - store pending request
      // For now, we'll just redirect with a message
      return c.redirect('/?github-app=pending-approval')
    }

    return c.json({ error: 'Unknown setup_action' }, 400)
  } catch (error) {
    console.error('GitHub App installation error:', error)
    return c.json({ error: 'Failed to process GitHub App installation' }, 500)
  }
}

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

// Handle GitHub App callback (both login and installation)
authRouter.get('/github/callback', async c => {
  const code = c.req.query('code')
  const state = c.req.query('state')
  const installationId = c.req.query('installation_id')
  const setupAction = c.req.query('setup_action')
  const storedState = getCookie(c, 'github_oauth_state')

  // Handle GitHub App installation flow
  if (installationId && setupAction) {
    return handleGitHubAppInstallation(c, installationId, setupAction)
  }

  // Handle user login flow
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

    // If no email from primary endpoint, try the emails endpoint
    if (!githubUser.email) {
      try {
        const emailResponse = await fetch('https://api.github.com/user/emails', {
          headers: {
            Authorization: `Bearer ${tokens.accessToken()}`,
            'User-Agent': 'Entente-Server',
          },
        })

        if (emailResponse.ok) {
          const emails = (await emailResponse.json()) as Array<{
            email: string
            primary: boolean
            verified: boolean
          }>

          const primaryEmail = emails.find(e => e.primary && e.verified)
          const fallbackEmail = emails.find(e => e.verified)

          if (primaryEmail) {
            githubUser.email = primaryEmail.email
          } else if (fallbackEmail) {
            githubUser.email = fallbackEmail.email
          }
        }
      } catch (error) {
        console.error('Failed to fetch GitHub user emails:', error)
      }
    }

    // If still no email, redirect to error page explaining they need to add email to GitHub
    if (!githubUser.email) {
      const errorUrl = `/github-email-required`

      // Clear state cookie
      c.header('Set-Cookie', deleteStateCookie(), { append: true })

      return c.redirect(errorUrl, 302)
    }

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
    c.header('Set-Cookie', deleteStateCookie(), { append: true })

    // Set session cookie (no Domain attribute so browser assigns current host; allows dev on different ports via proxy)
    const sessionCookieString = createSessionCookie(sessionId)
    c.header('Set-Cookie', sessionCookieString, { append: true })

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
        c.header('Set-Cookie', clearCookieHeader('cli_redirect_uri'), { append: true })
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

      // Always create a new API key with proper format
      const { generateApiKey } = await import('../utils/keys')
      const keyData = generateApiKey()

      if (existingKey.length > 0) {
        // Update existing key with new key data
        await db
          .update(keys)
          .set({
            keyHash: keyData.keyHash,
            keyPrefix: keyData.keyPrefix,
            lastUsedAt: new Date(),
          })
          .where(eq(keys.id, existingKey[0].id))
      } else {
        // Create new API key
        await db.insert(keys).values({
          tenantId: userTenant[0].tenantId,
          name: keyName,
          keyHash: keyData.keyHash,
          keyPrefix: keyData.keyPrefix,
          createdBy: user[0].username,
          permissions: 'read,write',
        })
      }

      const apiKey = keyData.fullKey

      // Clear CLI cookie and redirect to CLI callback with API key
      c.header('Set-Cookie', clearCookieHeader('cli_redirect_uri'), { append: true })
      return c.redirect(`${cliRedirectUri}?key=${encodeURIComponent(apiKey)}`)
    }

    // Check for pending invitation
    const pendingInvitation = getCookie(c, 'pending_invitation')
    if (pendingInvitation) {
      try {
        const { teamInvitations, tenants } = await import('../../db/schema')

        // Get invitation details
        const invitation = await db
          .select({
            id: teamInvitations.id,
            tenantId: teamInvitations.tenantId,
            email: teamInvitations.email,
            role: teamInvitations.role,
            expiresAt: teamInvitations.expiresAt,
            status: teamInvitations.status,
          })
          .from(teamInvitations)
          .where(eq(teamInvitations.id, pendingInvitation))
          .limit(1)

        // Don't process the invitation here - just redirect back to the invitation page
        // Let the frontend handle invitation acceptance after the user is properly authenticated
        if (
          invitation.length > 0 &&
          invitation[0].status === 'pending' &&
          new Date() <= new Date(invitation[0].expiresAt) &&
          invitation[0].email === user[0].email
        ) {
          // Clear the pending invitation cookie since we'll let frontend handle acceptance
          c.header('Set-Cookie', clearCookieHeader('pending_invitation'), { append: true })

          // Redirect back to invitation page where the frontend can auto-accept
          return c.redirect(`/invite/accept?token=${pendingInvitation}`)
        }
      } catch (error) {
        console.error('Error processing pending invitation:', error)
        // Don't fail login if invitation processing fails
      }

      // Clear invalid invitation cookie
      c.header('Set-Cookie', clearCookieHeader('pending_invitation'), { append: true })
    }

    // Regular web flow - redirect to dashboard
    return c.redirect('/')
  } catch (error) {
    console.error('GitHub OAuth callback error:', error)
    c.header('Set-Cookie', deleteStateCookie(), { append: true })

    // Handle CLI error redirect
    if (cliRedirectUri) {
      c.header('Set-Cookie', clearCookieHeader('cli_redirect_uri'), { append: true })
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
  if (authHeader?.startsWith('Bearer ')) {
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
    setCookie(c, 'sessionId', '', {
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
      expires: new Date(0),
      path: '/',
    })
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

  // Determine current tenant ID (from session or fallback to first tenant)
  let currentTenantId = session.selectedTenantId
  if (!currentTenantId && userTenants.length > 0) {
    currentTenantId = userTenants[0].tenant.id
  }

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
    currentTenantId,
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

  // Use deleteCookie utility instead of manual cookie string
  setCookie(c, 'sessionId', '', {
    httpOnly: true,
    secure: false,
    sameSite: 'Lax',
    expires: new Date(0),
    path: '/',
  })
  return c.json({ success: true })
})

// Create a new tenant for the current user
authRouter.post('/create-tenant', async c => {
  const sessionId = getCookie(c, 'sessionId')
  if (!sessionId) {
    return c.json({ error: 'Authentication required' }, 401)
  }
  const db = c.get('db')
  const { user } = await validateSession(db, sessionId)
  if (!user) {
    return c.json({ error: 'Invalid session' }, 401)
  }
  let body: any
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }
  const { name } = body || {}
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return c.json({ error: 'name is required' }, 400)
  }
  const baseSlug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'tenant'
  let slug = baseSlug
  let counter = 1
  while (true) {
    const existing = await db.select().from(tenants).where(eq(tenants.slug, slug)).limit(1)
    if (existing.length === 0) break
    counter += 1
    slug = `${baseSlug}-${counter}`.slice(0, 50)
    if (counter > 50) {
      return c.json({ error: 'Failed to generate unique slug' }, 500)
    }
  }
  const newTenant = await db.insert(tenants).values({ name, slug }).returning()
  await db.insert(tenantUsers).values({ tenantId: newTenant[0].id, userId: user.id, role: 'owner' })
  await updateSelectedTenant(db, sessionId, newTenant[0].id)
  return c.json({ success: true, tenant: newTenant[0] })
})

// Delete current tenant and all associated data
authRouter.post('/delete-tenant', async c => {
  const sessionId = getCookie(c, 'sessionId')
  if (!sessionId) {
    return c.json({ error: 'Authentication required' }, 401)
  }
  const db = c.get('db')
  const { user, session } = await validateSession(db, sessionId)
  if (!user || !session) {
    return c.json({ error: 'Invalid session' }, 401)
  }

  let body: any
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }
  const { slug, confirm } = body || {}
  if (!slug || confirm !== slug) {
    return c.json({ error: 'Confirmation slug mismatch' }, 400)
  }

  // Ensure session has a selected tenant
  const tenantId = session.selectedTenantId
  if (!tenantId) {
    return c.json({ error: 'No tenant selected in session' }, 400)
  }

  // Load tenant and verify slug
  const tenantRecord = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1)
  if (tenantRecord.length === 0) {
    return c.json({ error: 'Tenant not found' }, 404)
  }
  if (tenantRecord[0].slug !== slug) {
    return c.json({ error: 'Slug does not match current tenant' }, 400)
  }

  // Verify user is owner of tenant
  const membership = await db
    .select({ role: tenantUsers.role })
    .from(tenantUsers)
    .where(and(eq(tenantUsers.userId, user.id), eq(tenantUsers.tenantId, tenantId)))
    .limit(1)
  if (membership.length === 0 || membership[0].role !== 'owner') {
    return c.json({ error: 'Only tenant owners can delete a tenant' }, 403)
  }

  // Import needed tables lazily to avoid circular issues
  const {
    verificationResults,
    verificationTasks,
    interactions,
    contracts,
    specs,
    fixtures,
    deployments,
    serviceDependencies,
    services,
    githubAppInstallations,
    teamInvitations,
    keys,
    tenantSettings,
    userSessions,
  } = await import('../../db/schema')

  try {
    // Execute deletions inside transactional boundary if available
    // neon-http drizzle currently lacks full transaction API; perform sequential deletes
    // All deletes are scoped by tenantId to avoid cross-tenant impact
    await db.delete(verificationResults).where(eq(verificationResults.tenantId, tenantId))
    await db.delete(verificationTasks).where(eq(verificationTasks.tenantId, tenantId))
    await db.delete(interactions).where(eq(interactions.tenantId, tenantId))
    await db.delete(contracts).where(eq(contracts.tenantId, tenantId))
    await db.delete(specs).where(eq(specs.tenantId, tenantId))
    await db.delete(fixtures).where(eq(fixtures.tenantId, tenantId))
    await db.delete(deployments).where(eq(deployments.tenantId, tenantId))
    await db.delete(serviceDependencies).where(eq(serviceDependencies.tenantId, tenantId))
    await db.delete(services).where(eq(services.tenantId, tenantId))
    await db.delete(githubAppInstallations).where(eq(githubAppInstallations.tenantId, tenantId))
    await db.delete(teamInvitations).where(eq(teamInvitations.tenantId, tenantId))
    await db.delete(keys).where(eq(keys.tenantId, tenantId))
    await db.delete(tenantSettings).where(eq(tenantSettings.tenantId, tenantId))
    await db
      .update(userSessions)
      .set({ selectedTenantId: null })
      .where(eq(userSessions.selectedTenantId, tenantId))
    await db.delete(tenantUsers).where(eq(tenantUsers.tenantId, tenantId))
    await db.delete(tenants).where(eq(tenants.id, tenantId))

    // Find another tenant for user (if any)
    const remainingTenants = await db
      .select({ tenantId: tenantUsers.tenantId })
      .from(tenantUsers)
      .where(eq(tenantUsers.userId, user.id))
      .limit(1)

    let switchedTenantId: string | null = null
    if (remainingTenants.length > 0) {
      switchedTenantId = remainingTenants[0].tenantId
      await updateSelectedTenant(db, sessionId, switchedTenantId)
    } else {
      // No remaining tenants - clear selected tenant (could also logout client-side)
      await updateSelectedTenant(db, sessionId, null)
    }

    return c.json({ success: true, switchedTenantId, logout: remainingTenants.length === 0 })
  } catch (error) {
    console.error('Failed to delete tenant:', error)
    return c.json({ error: 'Failed to delete tenant' }, 500)
  }
})

// Select tenant for current session
authRouter.post('/select-tenant', async c => {
  const sessionId = getCookie(c, 'sessionId')

  if (!sessionId) {
    return c.json({ error: 'Authentication required' }, 401)
  }

  const db = c.get('db')
  const { user, session } = await validateSession(db, sessionId)

  if (!user || !session) {
    setCookie(c, 'sessionId', '', {
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
      expires: new Date(0),
      path: '/',
    })
    return c.json({ error: 'Invalid session' }, 401)
  }

  const body = await c.req.json()
  const { tenantId } = body

  if (!tenantId) {
    return c.json({ error: 'tenantId is required' }, 400)
  }

  // Verify user has access to this tenant
  const userTenant = await db
    .select()
    .from(tenantUsers)
    .where(and(eq(tenantUsers.userId, user.id), eq(tenantUsers.tenantId, tenantId)))
    .limit(1)

  if (userTenant.length === 0) {
    return c.json({ error: 'Access denied to this tenant' }, 403)
  }

  // Update session with selected tenant
  await updateSelectedTenant(db, sessionId, tenantId)

  return c.json({
    success: true,
    currentTenantId: tenantId,
  })
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
        // Return the existing key since we now store it in plaintext
        apiKey = existingKey[0].keyHash

        // Update last used timestamp
        await db.update(keys).set({ lastUsedAt: new Date() }).where(eq(keys.id, existingKey[0].id))
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
    `cli_redirect_uri=${encodeURIComponent(redirectUri)}; HttpOnly; SameSite=Lax; Path=/; Expires=${expires.toUTCString()}${isProduction ? '; Secure' : ''}`
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

// Get invitation details (for frontend)
authRouter.get('/invite/details', async c => {
  const token = c.req.query('token')

  if (!token) {
    return c.json({ error: 'Invitation token is required' }, 400)
  }

  const db = c.get('db')

  // Get invitation details
  const { teamInvitations, tenants } = await import('../../db/schema')
  const invitation = await db
    .select({
      id: teamInvitations.id,
      tenantId: teamInvitations.tenantId,
      email: teamInvitations.email,
      role: teamInvitations.role,
      expiresAt: teamInvitations.expiresAt,
      status: teamInvitations.status,
      tenantName: tenants.name,
    })
    .from(teamInvitations)
    .innerJoin(tenants, eq(teamInvitations.tenantId, tenants.id))
    .where(eq(teamInvitations.id, token))
    .limit(1)

  if (invitation.length === 0) {
    return c.json({ error: 'Invalid invitation token' }, 404)
  }

  return c.json({ invitation: invitation[0] })
})

// Accept team invitation (API endpoint)
authRouter.post('/invite/accept', async c => {
  const body = await c.req.json()
  const { token } = body

  if (!token) {
    return c.json({ error: 'Invitation token is required' }, 400)
  }

  const db = c.get('db')

  // Get invitation details
  const { teamInvitations, tenants } = await import('../../db/schema')
  const invitation = await db
    .select({
      id: teamInvitations.id,
      tenantId: teamInvitations.tenantId,
      email: teamInvitations.email,
      role: teamInvitations.role,
      expiresAt: teamInvitations.expiresAt,
      status: teamInvitations.status,
      tenantName: tenants.name,
    })
    .from(teamInvitations)
    .innerJoin(tenants, eq(teamInvitations.tenantId, tenants.id))
    .where(eq(teamInvitations.id, token))
    .limit(1)

  if (invitation.length === 0) {
    return c.json({ error: 'Invalid invitation token' }, 404)
  }

  const invite = invitation[0]

  // Check if invitation is expired or not pending
  if (invite.status !== 'pending' || new Date() > new Date(invite.expiresAt)) {
    return c.json({ error: 'Invitation has expired or is no longer valid' }, 400)
  }

  // Check if user is already authenticated
  const sessionId = getCookie(c, 'sessionId')
  if (sessionId) {
    const { user, session } = await validateSession(db, sessionId)

    if (user && session) {
      // User is authenticated, check if invitation email matches
      if (user.email !== invite.email) {
        return c.json(
          {
            error: `This invitation is for ${invite.email}, but you are logged in as ${user.email}. Please logout and login with the correct account.`,
          },
          400
        )
      }

      // Accept the invitation
      await db
        .update(teamInvitations)
        .set({
          status: 'accepted',
          acceptedAt: new Date(),
        })
        .where(eq(teamInvitations.id, token))

      // Add user to tenant
      await db.insert(tenantUsers).values({
        tenantId: invite.tenantId,
        userId: user.id,
        role: invite.role as 'admin' | 'member',
      })

      // Automatically switch the user's session to the newly joined tenant
      const sessionId = getCookie(c, 'sessionId')
      if (sessionId) {
        await updateSelectedTenant(db, sessionId, invite.tenantId)
      }

      return c.json({
        success: true,
        message: `Successfully joined ${invite.tenantName}`,
        redirectUrl: '/?invitation-accepted=true',
      })
    }
  }

  // User not authenticated - they need to login first
  // Store the invitation token in a cookie so it can be processed after login
  setCookie(c, 'pending_invitation', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'Lax',
    maxAge: 600, // 10 minutes
  })

  return c.json({
    success: false,
    requiresAuth: true,
    message: 'Please login with GitHub to accept this invitation',
    loginUrl: '/auth/github',
  })
})

// Accept team invitation (HTML page - deprecated, keeping for compatibility)
authRouter.get('/invite/accept', async c => {
  const token = c.req.query('token')

  if (!token) {
    return c.json({ error: 'Invitation token is required' }, 400)
  }

  const db = c.get('db')

  // Get invitation details
  const { teamInvitations, tenants } = await import('../../db/schema')
  const invitation = await db
    .select({
      id: teamInvitations.id,
      tenantId: teamInvitations.tenantId,
      email: teamInvitations.email,
      role: teamInvitations.role,
      expiresAt: teamInvitations.expiresAt,
      status: teamInvitations.status,
      tenantName: tenants.name,
    })
    .from(teamInvitations)
    .innerJoin(tenants, eq(teamInvitations.tenantId, tenants.id))
    .where(eq(teamInvitations.id, token))
    .limit(1)

  if (invitation.length === 0) {
    return c.json({ error: 'Invalid invitation token' }, 404)
  }

  const invite = invitation[0]

  // Check if invitation is expired
  if (invite.status !== 'pending' || new Date() > new Date(invite.expiresAt)) {
    return c.json({ error: 'Invitation has expired' }, 400)
  }

  // Check if user is already authenticated
  const sessionId = getCookie(c, 'sessionId')
  if (sessionId) {
    const { user, session } = await validateSession(db, sessionId)

    if (user && session) {
      // User is authenticated, check if invitation email matches
      if (user.email !== invite.email) {
        // Store invitation token and redirect to login with different account message
        setCookie(c, 'pending_invitation', token, {
          httpOnly: true,
          secure: isProduction,
          sameSite: 'Lax',
          maxAge: 600, // 10 minutes
        })

        return c.html(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Entente - Email Mismatch</title>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <style>
                body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 40px 20px; background: #f8fafc; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
                .container { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); text-align: center; max-width: 500px; width: 100%; }
                h1 { color: #1f2937; margin-bottom: 16px; font-size: 24px; font-weight: 600; }
                p { color: #6b7280; margin-bottom: 24px; line-height: 1.5; }
                .btn { background: #1f2937; color: white; padding: 12px 24px; border: none; border-radius: 8px; font-size: 16px; font-weight: 500; cursor: pointer; text-decoration: none; display: inline-block; margin: 8px; transition: background-color 0.2s; }
                .btn:hover { background: #374151; }
                .btn-secondary { background: #6b7280; }
                .btn-secondary:hover { background: #4b5563; }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>Email Address Mismatch</h1>
                <p>This invitation was sent to <strong>${invite.email}</strong>, but you're currently logged in as <strong>${user.email}</strong>.</p>
                <p>To accept this invitation to <strong>${invite.tenantName}</strong>, you need to:</p>
                <a href="/auth/logout" class="btn">Logout & Login with ${invite.email}</a>
                <a href="/" class="btn btn-secondary">Continue as ${user.email}</a>
              </div>
            </body>
          </html>
        `)
      }

      // Accept the invitation
      await db
        .update(teamInvitations)
        .set({
          status: 'accepted',
          acceptedAt: new Date(),
        })
        .where(eq(teamInvitations.id, token))

      // Add user to tenant
      await db.insert(tenantUsers).values({
        tenantId: invite.tenantId,
        userId: user.id,
        role: invite.role as 'admin' | 'member',
      })

      // Redirect to success page or dashboard
      return c.redirect('/?invitation-accepted=true')
    }
  }

  // User not authenticated, show login page with invitation context
  setCookie(c, 'pending_invitation', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'Lax',
    maxAge: 600, // 10 minutes
  })

  return c.html(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Entente - Accept Invitation</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 40px 20px; background: #f8fafc; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
          .container { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); text-align: center; max-width: 500px; width: 100%; }
          h1 { color: #1f2937; margin-bottom: 16px; font-size: 24px; font-weight: 600; }
          p { color: #6b7280; margin-bottom: 24px; line-height: 1.5; }
          .btn { background: #3b82f6; color: white; padding: 12px 24px; border: none; border-radius: 8px; font-size: 16px; font-weight: 500; cursor: pointer; text-decoration: none; display: inline-block; transition: background-color 0.2s; }
          .btn:hover { background: #2563eb; }
          .invite-info { background: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 24px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🎉 You're Invited!</h1>
          <div class="invite-info">
            <p><strong>Team:</strong> ${invite.tenantName}</p>
            <p><strong>Role:</strong> ${invite.role}</p>
            <p><strong>Email:</strong> ${invite.email}</p>
          </div>
            <p>To accept this invitation, please sign in with your GitHub account:</p>
          <a href="/auth/github" class="btn">Sign in with GitHub</a>
        </div>
      </body>
    </html>
  `)
})

export { authRouter }
