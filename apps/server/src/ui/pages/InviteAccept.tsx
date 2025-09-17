import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useInvitationDetails, useAcceptInvitation } from '../hooks/useInvitations'

interface InvitationDetails {
  id: string
  tenantId: string
  email: string
  role: string
  expiresAt: string
  status: string
  tenantName: string
}

function InviteAccept() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')
  const [error, setError] = useState<string | null>(null)
  const { authenticated, user, loading: authLoading, refresh } = useAuth()
  const [hasTriedAutoAccept, setHasTriedAutoAccept] = useState(false)

  // Check for auth error in URL params
  useEffect(() => {
    const authError = searchParams.get('error')
    if (authError === 'auth_failed') {
      setError('Authentication failed. Please try again.')
    }
  }, [searchParams])

  // Fetch invitation details
  const {
    data: invitationData,
    isLoading,
    error: fetchError,
  } = useInvitationDetails(token || '', { enabled: !!token })

  const invitation = invitationData?.invitation

  // Accept invitation mutation
  const acceptMutation = useAcceptInvitation({
    onSuccess: data => {
      if (data.success) {
        // Successfully accepted, refresh auth state and redirect to dashboard
        refresh().then(() => {
          navigate('/?invitation-accepted=true')
        })
      } else if (data.requiresAuth) {
        // User needs to authenticate - redirect to GitHub login
        const loginUrl = data.loginUrl || '/auth/github'
        window.location.href = loginUrl
      }
    },
    onError: (error: any) => {
      setError(error.message || 'An error occurred')
    },
  })

  useEffect(() => {
    if (fetchError) {
      setError(fetchError.message)
    }
  }, [fetchError])

  // Auto-accept invitation when user becomes authenticated
  useEffect(() => {
    console.log('🔍 Auto-accept check:', {
      authenticated,
      token: !!token,
      invitation: !!invitation,
      hasTriedAutoAccept,
      isPending: acceptMutation.isLoading,
      invitationStatus: invitation?.status,
      invitationEmail: invitation?.email,
      userEmail: user?.email,
      expiresAt: invitation?.expiresAt,
      isExpired: invitation ? new Date() > new Date(invitation.expiresAt) : null,
    })

    if (authenticated && token && invitation && !hasTriedAutoAccept && !acceptMutation.isLoading) {
      console.log('✅ Prerequisites met for auto-acceptance')
      // Check if invitation is valid and for the correct user
      if (
        invitation.status === 'pending' &&
        new Date() <= new Date(invitation.expiresAt) &&
        user?.email === invitation.email
      ) {
        console.log('🚀 Auto-accepting invitation!')
        setHasTriedAutoAccept(true)
        acceptMutation.mutate(token || '')
      } else {
        console.log('❌ Invitation validation failed:', {
          statusPending: invitation.status === 'pending',
          notExpired: new Date() <= new Date(invitation.expiresAt),
          emailMatch: user?.email === invitation.email,
        })
      }
    } else {
      console.log('❌ Prerequisites not met for auto-acceptance')
    }
  }, [authenticated, token, invitation, hasTriedAutoAccept, acceptMutation, user?.email])

  // Auto-redirect when invitation is accepted and user is authenticated
  useEffect(() => {
    if (authenticated && invitation && invitation.status === 'accepted') {
      const timer = setTimeout(() => {
        navigate('/?invitation-accepted=true')
      }, 2000) // Give user 2 seconds to see the success message
      return () => clearTimeout(timer)
    }
  }, [authenticated, invitation, navigate])

  if (!token) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <div className="card w-full max-w-md bg-base-100 shadow-xl">
          <div className="card-body text-center">
            <div className="text-error text-6xl mb-4">⚠️</div>
            <h1 className="card-title text-2xl justify-center text-error">Invalid Invitation</h1>
            <p className="text-base-content/70">No invitation token provided in the URL.</p>
            <div className="card-actions justify-center mt-6">
              <button className="btn btn-primary" onClick={() => navigate('/')}>
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (isLoading || authLoading) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <div className="card w-full max-w-md bg-base-100 shadow-xl">
          <div className="card-body text-center">
            <div className="loading loading-spinner loading-lg text-primary"></div>
            <h1 className="card-title text-2xl justify-center">Loading Invitation...</h1>
            <p className="text-base-content/70">Please wait while we verify your invitation.</p>
          </div>
        </div>
      </div>
    )
  }

  // Show accepting state if user is authenticated and we're auto-accepting
  if (authenticated && hasTriedAutoAccept && acceptMutation.isLoading) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <div className="card w-full max-w-md bg-base-100 shadow-xl">
          <div className="card-body text-center">
            <div className="loading loading-spinner loading-lg text-success"></div>
            <h1 className="card-title text-2xl justify-center">Accepting Invitation...</h1>
            <p className="text-base-content/70">
              You've been successfully authenticated. Accepting your invitation now.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <div className="card w-full max-w-md bg-base-100 shadow-xl">
          <div className="card-body text-center">
            <div className="text-error text-6xl mb-4">❌</div>
            <h1 className="card-title text-2xl justify-center text-error">Invitation Error</h1>
            <p className="text-base-content/70 mb-4">{error}</p>
            <div className="card-actions justify-center">
              <button className="btn btn-primary" onClick={() => navigate('/')}>
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!invitation) {
    return null
  }

  // Check if invitation is expired
  const isExpired = new Date() > new Date(invitation.expiresAt)
  const isAccepted = invitation.status === 'accepted'

  if (isExpired) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <div className="card w-full max-w-md bg-base-100 shadow-xl">
          <div className="card-body text-center">
            <div className="text-warning text-6xl mb-4">⏰</div>
            <h1 className="card-title text-2xl justify-center text-warning">Invitation Expired</h1>
            <p className="text-base-content/70">
              This invitation to join <strong>{invitation.tenantName}</strong> has expired.
            </p>
            <p className="text-sm text-base-content/50 mt-2">
              Expired on {new Date(invitation.expiresAt).toLocaleDateString()}
            </p>
            <div className="card-actions justify-center mt-6">
              <button className="btn btn-primary" onClick={() => navigate('/')}>
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (isAccepted) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <div className="card w-full max-w-md bg-base-100 shadow-xl">
          <div className="card-body text-center">
            <div className="text-success text-6xl mb-4">✅</div>
            <h1 className="card-title text-2xl justify-center text-success">
              Invitation Accepted!
            </h1>
            <p className="text-base-content/70">
              You have successfully joined <strong>{invitation.tenantName}</strong>.
            </p>
            {authenticated ? (
              <p className="text-sm text-base-content/60 mt-2">Redirecting to dashboard...</p>
            ) : (
              <div className="card-actions justify-center mt-6">
                <button className="btn btn-primary" onClick={() => navigate('/')}>
                  Go to Dashboard
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center">
      <div className="card w-full max-w-md bg-base-100 shadow-xl">
        <div className="card-body text-center">
          <div className="text-primary text-6xl mb-4">🎉</div>
          <h1 className="card-title text-2xl justify-center">You're Invited!</h1>

          <div className="bg-base-200 rounded-lg p-4 my-6">
            <div className="text-sm text-base-content/70 mb-2">You've been invited to join</div>
            <div className="text-lg font-semibold text-base-content">{invitation.tenantName}</div>
            <div className="text-sm text-base-content/70 mt-2">
              as a <span className="badge badge-neutral capitalize">{invitation.role}</span>
            </div>
          </div>

          <div className="text-sm text-base-content/60 mb-6">
            <div>
              Invitation for: <strong>{invitation.email}</strong>
            </div>
            <div>Expires: {new Date(invitation.expiresAt).toLocaleDateString()}</div>
          </div>

          {acceptMutation.error && (
            <div className="alert alert-error mb-4">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>{acceptMutation.error.message}</span>
            </div>
          )}

          <div className="card-actions justify-center gap-3">
            {authenticated && user?.email !== invitation.email ? (
              <div className="alert alert-warning mb-4">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
                <div>
                  <div className="font-bold">Email Mismatch</div>
                  <div className="text-sm">
                    This invitation is for {invitation.email}, but you're logged in as {user?.email}.
                  </div>
                </div>
              </div>
            ) : null}
            <button
              className="btn btn-primary"
              onClick={() => acceptMutation.mutate(token || '')}
              disabled={acceptMutation.isLoading}
            >
              {acceptMutation.isLoading ? (
                <>
                  <div className="loading loading-spinner loading-sm"></div>
                  Accepting...
                </>
              ) : (
                'Accept Invitation'
              )}
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => navigate('/')}
              disabled={acceptMutation.isLoading}
            >
              Cancel
            </button>
          </div>

          <p className="text-xs text-base-content/50 mt-4">
            By accepting this invitation, you'll be able to access {invitation.tenantName} and
            collaborate with the team.
          </p>
        </div>
      </div>
    </div>
  )
}

export default InviteAccept
