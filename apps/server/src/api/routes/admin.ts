import { zValidator } from '@hono/zod-validator'
import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { tenantUsers, tenants, users } from '../../db/schema'
import { getEnv, getRequiredEnv } from '../middleware/env'

const adminRouter = new Hono()

// Secret admin middleware - protects admin endpoints with a secret key
const adminSecretMiddleware = async (c: any, next: any) => {
  const env = c.get('env')
  const adminSecret = getEnv(env, 'ADMIN_SECRET')

  console.log('Admin secret check:', {
    adminSecret: adminSecret ? 'SET' : 'NOT_SET',
    authHeader: c.req.header('Authorization') ? 'PROVIDED' : 'MISSING'
  })

  if (!adminSecret) {
    return c.json({ error: 'Admin endpoints not configured' }, 503)
  }

  const authHeader = c.req.header('Authorization')
  const providedSecret = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null

  if (!providedSecret || providedSecret !== adminSecret) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  await next()
}

// Apply admin secret middleware to all routes
adminRouter.use('*', adminSecretMiddleware)

// Schema for creating demo users
const createDemoUserSchema = z.object({
  email: z.string().email(),
  username: z.string().min(1).max(50),
  name: z.string().min(1).max(255),
  tenantId: z.string().uuid(),
  role: z.enum(['owner', 'admin', 'member']).default('member'),
  avatarUrl: z.string().url().optional(),
})

// Create demo user endpoint
adminRouter.post('/create-demo-user', zValidator('json', createDemoUserSchema), async c => {
  const db = c.get('db')
  const { email, username, name, tenantId, role, avatarUrl } = c.req.valid('json')

  try {
    // Check if user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1)

    if (existingUser.length > 0) {
      return c.json({ error: 'User with this email already exists' }, 400)
    }

    // Check if tenant exists
    const tenant = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1)

    if (tenant.length === 0) {
      return c.json({ error: 'Tenant not found' }, 404)
    }

    // Create user with fake GitHub ID (negative number to avoid conflicts)
    const fakeGithubId = Math.floor(Math.random() * -1000000) // Negative to distinguish from real GitHub IDs

    const newUser = await db
      .insert(users)
      .values({
        githubId: fakeGithubId,
        username,
        email,
        name,
        avatarUrl: avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(username)}`,
      })
      .returning()

    // Add user to tenant
    await db.insert(tenantUsers).values({
      tenantId,
      userId: newUser[0].id,
      role,
    })

    return c.json({
      success: true,
      user: {
        id: newUser[0].id,
        githubId: newUser[0].githubId,
        username: newUser[0].username,
        email: newUser[0].email,
        name: newUser[0].name,
        avatarUrl: newUser[0].avatarUrl,
      },
      tenant: {
        id: tenant[0].id,
        name: tenant[0].name,
        slug: tenant[0].slug,
      },
      role,
      message: `Demo user ${username} created and added to tenant ${tenant[0].name} with role ${role}`,
    })
  } catch (error) {
    console.error('Error creating demo user:', error)
    return c.json({ error: 'Failed to create demo user' }, 500)
  }
})

// Accept invitation as demo user endpoint
const acceptInvitationSchema = z.object({
  invitationId: z.string().uuid(),
  userEmail: z.string().email(),
})

adminRouter.post('/accept-invitation', zValidator('json', acceptInvitationSchema), async c => {
  const db = c.get('db')
  const { invitationId, userEmail } = c.req.valid('json')

  try {
    // Get invitation details
    const { teamInvitations } = await import('../../db/schema')
    const invitation = await db
      .select()
      .from(teamInvitations)
      .where(eq(teamInvitations.id, invitationId))
      .limit(1)

    if (invitation.length === 0) {
      return c.json({ error: 'Invitation not found' }, 404)
    }

    const invite = invitation[0]

    // Check if invitation is expired or not pending
    if (invite.status !== 'pending' || new Date() > new Date(invite.expiresAt)) {
      return c.json({ error: 'Invitation has expired or is no longer valid' }, 400)
    }

    // Find user by email
    const user = await db
      .select()
      .from(users)
      .where(eq(users.email, userEmail))
      .limit(1)

    if (user.length === 0) {
      return c.json({ error: 'User not found' }, 404)
    }

    // Check if user is already a member of this tenant
    const existingMembership = await db
      .select()
      .from(tenantUsers)
      .where(and(eq(tenantUsers.userId, user[0].id), eq(tenantUsers.tenantId, invite.tenantId)))
      .limit(1)

    if (existingMembership.length > 0) {
      return c.json({ error: 'User is already a member of this tenant' }, 400)
    }

    // Accept the invitation
    await db
      .update(teamInvitations)
      .set({
        status: 'accepted',
        acceptedAt: new Date(),
      })
      .where(eq(teamInvitations.id, invitationId))

    // Add user to tenant
    await db.insert(tenantUsers).values({
      tenantId: invite.tenantId,
      userId: user[0].id,
      role: invite.role as 'admin' | 'member',
    })

    // Get tenant info
    const tenant = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, invite.tenantId))
      .limit(1)

    return c.json({
      success: true,
      message: `Successfully accepted invitation for ${user[0].username} to join ${tenant[0]?.name}`,
      user: {
        id: user[0].id,
        username: user[0].username,
        email: user[0].email,
        name: user[0].name,
      },
      tenant: {
        id: tenant[0]?.id,
        name: tenant[0]?.name,
        slug: tenant[0]?.slug,
      },
      role: invite.role,
    })
  } catch (error) {
    console.error('Error accepting invitation:', error)
    return c.json({ error: 'Failed to accept invitation' }, 500)
  }
})

// List all tenants (for reference)
adminRouter.get('/tenants', async c => {
  const db = c.get('db')

  try {
    const allTenants = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        slug: tenants.slug,
        createdAt: tenants.createdAt,
      })
      .from(tenants)

    return c.json(allTenants)
  } catch (error) {
    console.error('Error listing tenants:', error)
    return c.json({ error: 'Failed to list tenants' }, 500)
  }
})

export { adminRouter }