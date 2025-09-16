import type {
  GitHubAppInstallation,
  GitHubAppInstallationUpdate,
  InviteTeamMemberRequest,
  TeamInvitation,
  TeamMember,
  TenantSettings,
  TenantSettingsUpdate,
  UpdateTeamMemberRoleRequest,
} from '@entente/types'
import { zValidator } from '@hono/zod-validator'
import { and, eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import type { Env } from '..'
import {
  githubAppInstallations,
  teamInvitations,
  tenantSettings,
  tenantUsers,
  tenants,
  users,
} from '../../db/schema'
import { getEnv } from '../middleware/env'
import { createInvitationEmailTemplate, sendEmail } from '../services/email'

const settings = new Hono<Env>()

// Get tenant settings
settings.get('/', async c => {
  const { tenantId } = c.get('session')
  const { user } = c.get('auth')
  const db = c.get('db')

  // Get tenant name
  const tenant = await db
    .select({ name: tenants.name })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1)

  const tenantName = tenant[0]?.name || 'Unnamed Tenant'

  const result = await db
    .select()
    .from(tenantSettings)
    .where(eq(tenantSettings.tenantId, tenantId))
    .limit(1)

  const settingsData = result[0]

  // Return default settings if none exist
  if (!settingsData) {
    return c.json<TenantSettings>({
      id: '',
      tenantId: tenantId,
      tenantName: tenantName,
      autoCleanupEnabled: false,
      autoCleanupDays: 30,
      dataRetentionDays: 90,
      notificationsEnabled: true,
      updatedAt: new Date(),
      updatedBy: user.id,
    })
  }

  return c.json<TenantSettings>({
    id: settingsData.id,
    tenantId: settingsData.tenantId,
    tenantName: tenantName,
    autoCleanupEnabled: settingsData.autoCleanupEnabled,
    autoCleanupDays: settingsData.autoCleanupDays,
    dataRetentionDays: settingsData.dataRetentionDays,
    notificationsEnabled: settingsData.notificationsEnabled,
    updatedAt: settingsData.updatedAt,
    updatedBy: settingsData.updatedBy,
  })
})

// Update tenant settings
const updateSettingsSchema = z.object({
  tenantName: z.string().min(1).max(255).optional(),
  autoCleanupEnabled: z.boolean().optional(),
  autoCleanupDays: z.number().min(1).max(365).optional(),
  dataRetentionDays: z.number().min(7).max(1095).optional(), // 3 years max
  notificationsEnabled: z.boolean().optional(),
})

settings.patch('/', zValidator('json', updateSettingsSchema), async c => {
  const { tenantId } = c.get('session')
  const { user } = c.get('auth')
  const db = c.get('db')
  const updates = c.req.valid('json') as TenantSettingsUpdate

  // If tenant name is being updated, update the tenant table
  if (updates.tenantName) {
    await db
      .update(tenants)
      .set({
        name: updates.tenantName,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenantId))
  }

  // Get current tenant name
  const tenant = await db
    .select({ name: tenants.name })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1)

  const tenantName = tenant[0]?.name || 'Unnamed Tenant'

  // Check if settings exist
  const existingSettings = await db
    .select()
    .from(tenantSettings)
    .where(eq(tenantSettings.tenantId, tenantId))
    .limit(1)

  // Remove tenantName from settings updates since it's handled separately
  const { tenantName: _, ...settingsUpdates } = updates

  if (existingSettings.length === 0) {
    // Create new settings record
    const newSettings = await db
      .insert(tenantSettings)
      .values({
        tenantId: tenantId,
        autoCleanupEnabled: settingsUpdates.autoCleanupEnabled ?? false,
        autoCleanupDays: settingsUpdates.autoCleanupDays ?? 30,
        dataRetentionDays: settingsUpdates.dataRetentionDays ?? 90,
        notificationsEnabled: settingsUpdates.notificationsEnabled ?? true,
        updatedBy: user.id,
        updatedAt: new Date(),
      })
      .returning()

    return c.json<TenantSettings>({
      id: newSettings[0].id,
      tenantId: newSettings[0].tenantId,
      tenantName: tenantName,
      autoCleanupEnabled: newSettings[0].autoCleanupEnabled,
      autoCleanupDays: newSettings[0].autoCleanupDays,
      dataRetentionDays: newSettings[0].dataRetentionDays,
      notificationsEnabled: newSettings[0].notificationsEnabled,
      updatedAt: newSettings[0].updatedAt,
      updatedBy: newSettings[0].updatedBy,
    })
  } else {
    // Update existing settings
    const updatedSettings = await db
      .update(tenantSettings)
      .set({
        ...settingsUpdates,
        updatedBy: user.id,
        updatedAt: new Date(),
      })
      .where(eq(tenantSettings.tenantId, tenantId))
      .returning()

    return c.json<TenantSettings>({
      id: updatedSettings[0].id,
      tenantId: updatedSettings[0].tenantId,
      tenantName: tenantName,
      autoCleanupEnabled: updatedSettings[0].autoCleanupEnabled,
      autoCleanupDays: updatedSettings[0].autoCleanupDays,
      dataRetentionDays: updatedSettings[0].dataRetentionDays,
      notificationsEnabled: updatedSettings[0].notificationsEnabled,
      updatedAt: updatedSettings[0].updatedAt,
      updatedBy: updatedSettings[0].updatedBy,
    })
  }
})

// Get team members
settings.get('/team', async c => {
  const { tenantId } = c.get('session')
  const db = c.get('db')

  const members = await db
    .select({
      id: tenantUsers.userId,
      tenantId: tenantUsers.tenantId,
      userId: tenantUsers.userId,
      username: users.username,
      name: users.name,
      email: users.email,
      avatarUrl: users.avatarUrl,
      role: tenantUsers.role,
      joinedAt: tenantUsers.joinedAt,
      status: sql<'active'>`'active'`,
    })
    .from(tenantUsers)
    .innerJoin(users, eq(tenantUsers.userId, users.id))
    .where(eq(tenantUsers.tenantId, tenantId))

  // Get pending invitations
  const invitations = await db
    .select({
      id: teamInvitations.email, // Use email as temporary ID for pending
      tenantId: teamInvitations.tenantId,
      userId: teamInvitations.email, // Use email as userId for pending
      username: sql<string>`''`, // Empty username for pending
      name: teamInvitations.email, // Just the email as name for pending
      email: teamInvitations.email,
      avatarUrl: sql<string | null>`null`,
      role: teamInvitations.role,
      joinedAt: teamInvitations.invitedAt,
      status: sql<'pending'>`'pending'`,
    })
    .from(teamInvitations)
    .where(and(eq(teamInvitations.tenantId, tenantId), eq(teamInvitations.status, 'pending')))

  const allMembers: TeamMember[] = [
    ...members.map(member => ({
      ...member,
      role: member.role as 'owner' | 'admin' | 'member',
      status: 'active' as const,
    })),
    ...invitations.map(invitation => ({
      ...invitation,
      role: invitation.role as 'admin' | 'member',
      status: 'pending' as const,
    })),
  ]

  return c.json(allMembers)
})

// Invite team member
const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member']),
})

settings.post('/team/invite', zValidator('json', inviteSchema), async c => {
  const { tenantId } = c.get('session')
  const { user } = c.get('auth')
  const db = c.get('db')
  const { email, role } = c.req.valid('json') as InviteTeamMemberRequest

  // Check if user is already a member
  const existingMember = await db
    .select()
    .from(users)
    .innerJoin(tenantUsers, eq(users.id, tenantUsers.userId))
    .where(and(eq(users.email, email), eq(tenantUsers.tenantId, tenantId)))
    .limit(1)

  if (existingMember.length > 0) {
    return c.json({ error: 'User is already a member of this tenant' }, 400)
  }

  // Check if invitation already exists
  const existingInvitation = await db
    .select()
    .from(teamInvitations)
    .where(
      and(
        eq(teamInvitations.email, email),
        eq(teamInvitations.tenantId, tenantId),
        eq(teamInvitations.status, 'pending')
      )
    )
    .limit(1)

  if (existingInvitation.length > 0) {
    return c.json({ error: 'Invitation already sent to this email' }, 400)
  }

  // Create invitation (expires in 7 days)
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7)

  const invitation = await db
    .insert(teamInvitations)
    .values({
      tenantId: tenantId,
      email,
      role,
      invitedBy: user.id,
      expiresAt,
    })
    .returning()

  // Get tenant information for email
  const tenant = await db
    .select({ name: tenants.name })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1)

  // Send invitation email
  try {
    const env = c.get('env')
    const appUrl = getEnv(env, 'APP_URL') || 'https://entente.dev'
    const inviteUrl = `${appUrl}/invite/accept?token=${invitation[0].id}`

    const tenantName = tenant[0]?.name || 'the team'
    const inviterName = user.name || user.username

    const emailTemplate = createInvitationEmailTemplate(tenantName, inviterName, inviteUrl)

    await sendEmail(
      env,
      email,
      `You've been invited to join ${tenantName} on Entente`,
      emailTemplate
    )
  } catch (error) {
    console.error('Failed to send invitation email:', error)
    // Don't fail the invitation creation if email fails
  }

  const teamInvitation: TeamInvitation = {
    id: invitation[0].id,
    tenantId: invitation[0].tenantId,
    email: invitation[0].email,
    role: invitation[0].role as 'admin' | 'member',
    invitedBy: invitation[0].invitedBy,
    invitedAt: invitation[0].invitedAt,
    expiresAt: invitation[0].expiresAt,
    acceptedAt: invitation[0].acceptedAt || undefined,
    status: invitation[0].status as 'pending' | 'accepted' | 'expired',
  }

  return c.json(teamInvitation, 201)
})

// Resend invitation
settings.post('/team/resend/:email', async c => {
  const { tenantId } = c.get('session')
  const { user } = c.get('auth')
  const db = c.get('db')
  const email = c.req.param('email')

  // Check if invitation exists and is pending
  const invitation = await db
    .select()
    .from(teamInvitations)
    .where(
      and(
        eq(teamInvitations.email, email),
        eq(teamInvitations.tenantId, tenantId),
        eq(teamInvitations.status, 'pending')
      )
    )
    .limit(1)

  if (invitation.length === 0) {
    return c.json({ error: 'No pending invitation found for this email' }, 404)
  }

  // Get tenant information for email
  const tenant = await db
    .select({ name: tenants.name })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1)

  // Resend invitation email
  try {
    const env = c.get('env')
    const appUrl = getEnv(env, 'APP_URL') || 'https://entente.dev'
    const inviteUrl = `${appUrl}/invite/accept?token=${invitation[0].id}`

    const tenantName = tenant[0]?.name || 'the team'
    const inviterName = user.name || user.username

    const emailTemplate = createInvitationEmailTemplate(tenantName, inviterName, inviteUrl)

    await sendEmail(
      env,
      email,
      `You've been invited to join ${tenantName} on Entente`,
      emailTemplate
    )

    return c.json({ success: true, message: 'Invitation resent successfully' })
  } catch (error) {
    console.error('Failed to resend invitation email:', error)
    return c.json({ error: 'Failed to resend invitation email' }, 500)
  }
})

// Update team member role
const updateRoleSchema = z.object({
  role: z.enum(['admin', 'member']),
})

settings.patch('/team/:userId/role', zValidator('json', updateRoleSchema), async c => {
  const { tenantId } = c.get('session')
  const { user } = c.get('auth')
  const db = c.get('db')
  const userId = c.req.param('userId')
  const { role } = c.req.valid('json') as UpdateTeamMemberRoleRequest

  // Check if user is member of tenant
  const member = await db
    .select()
    .from(tenantUsers)
    .where(and(eq(tenantUsers.userId, userId), eq(tenantUsers.tenantId, tenantId)))
    .limit(1)

  if (member.length === 0) {
    return c.json({ error: 'User is not a member of this tenant' }, 404)
  }

  // Cannot change owner role
  if (member[0].role === 'owner') {
    return c.json({ error: 'Cannot change owner role' }, 400)
  }

  // Update role
  await db
    .update(tenantUsers)
    .set({ role })
    .where(and(eq(tenantUsers.userId, userId), eq(tenantUsers.tenantId, tenantId)))

  return c.json({ success: true })
})

// Remove team member
settings.delete('/team/:userIdentifier', async c => {
  const { tenantId } = c.get('session')
  const { user } = c.get('auth')
  const db = c.get('db')
  const userIdentifier = c.req.param('userIdentifier')

  // Check if userIdentifier is an email (for pending invitations) or userId
  const isEmail = userIdentifier.includes('@')

  if (isEmail) {
    // Remove pending invitation
    const invitation = await db
      .select()
      .from(teamInvitations)
      .where(
        and(
          eq(teamInvitations.email, userIdentifier),
          eq(teamInvitations.tenantId, tenantId),
          eq(teamInvitations.status, 'pending')
        )
      )
      .limit(1)

    if (invitation.length === 0) {
      return c.json({ error: 'Invitation not found' }, 404)
    }

    // Delete the invitation
    await db
      .delete(teamInvitations)
      .where(
        and(
          eq(teamInvitations.email, userIdentifier),
          eq(teamInvitations.tenantId, tenantId),
          eq(teamInvitations.status, 'pending')
        )
      )

    return c.json({ success: true })
  } else {
    // Remove existing team member
    const member = await db
      .select()
      .from(tenantUsers)
      .where(and(eq(tenantUsers.userId, userIdentifier), eq(tenantUsers.tenantId, tenantId)))
      .limit(1)

    if (member.length === 0) {
      return c.json({ error: 'User is not a member of this tenant' }, 404)
    }

    // Cannot remove owner
    if (member[0].role === 'owner') {
      return c.json({ error: 'Cannot remove tenant owner' }, 400)
    }

    // Remove from tenant
    await db
      .delete(tenantUsers)
      .where(and(eq(tenantUsers.userId, userIdentifier), eq(tenantUsers.tenantId, tenantId)))

    return c.json({ success: true })
  }
})

// Get GitHub app name for frontend (public endpoint)
settings.get('/github/app-name', async c => {
  const env = c.get('env')
  const appName = getEnv(env, 'GITHUB_APP_NAME') || 'entente-dev'

  return c.json({ appName })
})

// Get GitHub app installation
settings.get('/github', async c => {
  const { tenantId } = c.get('session')
  const db = c.get('db')

  const installation = await db
    .select()
    .from(githubAppInstallations)
    .where(eq(githubAppInstallations.tenantId, tenantId))
    .limit(1)

  if (installation.length === 0) {
    return c.json(null)
  }

  const result: GitHubAppInstallation = {
    id: installation[0].id,
    tenantId: installation[0].tenantId,
    installationId: installation[0].installationId,
    accountType: installation[0].accountType as 'user' | 'organization',
    accountLogin: installation[0].accountLogin,
    targetType: installation[0].targetType as 'User' | 'Organization',
    permissions: installation[0].permissions,
    repositorySelection: installation[0].repositorySelection as 'all' | 'selected',
    selectedRepositories: installation[0].selectedRepositories || [],
    suspendedAt: installation[0].suspendedAt || undefined,
    installedAt: installation[0].installedAt,
    updatedAt: installation[0].updatedAt,
  }

  return c.json(result)
})

// Get GitHub installation management URL
settings.get('/github/manage-url', async c => {
  const { tenantId } = c.get('session')
  const db = c.get('db')

  const installation = await db
    .select()
    .from(githubAppInstallations)
    .where(eq(githubAppInstallations.tenantId, tenantId))
    .limit(1)

  if (installation.length === 0) {
    return c.json({ error: 'No GitHub installation found' }, 404)
  }

  const installationId = installation[0].installationId
  const manageUrl = `https://github.com/settings/installations/${installationId}`

  return c.json({
    manageUrl,
    installationId,
    accountLogin: installation[0].accountLogin,
  })
})

// Update GitHub app installation settings
const updateGitHubSchema = z.object({
  repositorySelection: z.enum(['all', 'selected']).optional(),
  selectedRepositories: z
    .array(
      z.object({
        id: z.number(),
        name: z.string(),
        fullName: z.string(),
        private: z.boolean(),
      })
    )
    .optional(),
})

settings.patch('/github', zValidator('json', updateGitHubSchema), async c => {
  const { tenantId } = c.get('session')
  const db = c.get('db')
  const updates = c.req.valid('json') as GitHubAppInstallationUpdate

  const updated = await db
    .update(githubAppInstallations)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(githubAppInstallations.tenantId, tenantId))
    .returning()

  if (updated.length === 0) {
    return c.json({ error: 'GitHub app installation not found' }, 404)
  }

  const result: GitHubAppInstallation = {
    id: updated[0].id,
    tenantId: updated[0].tenantId,
    installationId: updated[0].installationId,
    accountType: updated[0].accountType as 'user' | 'organization',
    accountLogin: updated[0].accountLogin,
    targetType: updated[0].targetType as 'User' | 'Organization',
    permissions: updated[0].permissions,
    repositorySelection: updated[0].repositorySelection as 'all' | 'selected',
    selectedRepositories: updated[0].selectedRepositories || [],
    suspendedAt: updated[0].suspendedAt || undefined,
    installedAt: updated[0].installedAt,
    updatedAt: updated[0].updatedAt,
  }

  return c.json(result)
})

// Delete GitHub app installation
settings.delete('/github', async c => {
  const { tenantId } = c.get('session')
  const db = c.get('db')

  await db.delete(githubAppInstallations).where(eq(githubAppInstallations.tenantId, tenantId))

  return c.json({ success: true })
})

export default settings
