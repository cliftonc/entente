import type { Context, Next } from 'hono'

// Middleware to restrict demo users from accessing certain endpoints
export async function demoRestrictionsMiddleware(c: Context, next: Next) {
  const auth = c.get('auth')

  // Check if user is a demo user (negative GitHub ID)
  if (auth?.user?.githubId && auth.user.githubId < 0) {
    const path = c.req.path

    // List of restricted paths for demo users
    const restrictedPaths = [
      '/api/settings',
      '/settings',
      '/api/keys',
      '/keys',
      '/admin'
    ]

    // Check if current path starts with any restricted path
    const isRestricted = restrictedPaths.some(restrictedPath =>
      path.startsWith(restrictedPath)
    )

    if (isRestricted) {
      return c.json({
        error: 'Demo users cannot access this feature',
        message: 'This is a demo account with limited access. Sign up with GitHub for full access.'
      }, 403)
    }
  }

  await next()
}

// Helper function to check if a user is a demo user
export function isDemoUser(user: any): boolean {
  return user?.githubId && user.githubId < 0
}