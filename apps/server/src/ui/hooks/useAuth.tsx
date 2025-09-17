import { useQueryClient } from '@tanstack/react-query'
import { type ReactNode, createContext, useContext, useEffect, useState } from 'react'

interface User {
  id: string
  githubId: number
  username: string
  email: string
  name: string
  avatarUrl: string | null
}

interface Tenant {
  tenant: {
    id: string
    name: string
    slug: string
    createdAt: string
    updatedAt: string
  }
  role: string
  joinedAt: string
}

interface AuthState {
  authenticated: boolean
  user: User | null
  tenants: Tenant[]
  currentTenantId: string | null
  loading: boolean
  error: string | null
}

interface AuthContextType extends AuthState {
  login: () => void
  logout: () => Promise<void>
  refresh: () => Promise<void>
  selectTenant: (tenantId: string) => Promise<boolean>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [authState, setAuthState] = useState<AuthState>({
    authenticated: false,
    user: null,
    tenants: [],
    currentTenantId: null,
    loading: true,
    error: null,
  })

  const checkSession = async () => {
    try {
      const response = await fetch('/auth/session', {
        credentials: 'include',
      })
      const data = await response.json()

      if (data.authenticated) {
        setAuthState({
          authenticated: true,
          user: data.user,
          tenants: data.tenants,
          currentTenantId: data.currentTenantId,
          loading: false,
          error: null,
        })
      } else {
        setAuthState({
          authenticated: false,
          user: null,
          tenants: [],
          currentTenantId: null,
          loading: false,
          error: null,
        })
      }
    } catch (_error) {
      setAuthState({
        authenticated: false,
        user: null,
        tenants: [],
        currentTenantId: null,
        loading: false,
        error: 'Failed to check authentication',
      })
    }
  }

  const login = () => {
    window.location.href = '/auth/github'
  }

  const logout = async () => {
    try {
      await fetch('/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })
      setAuthState({
        authenticated: false,
        user: null,
        tenants: [],
        currentTenantId: null,
        loading: false,
        error: null,
      })
      // Clear all cached queries on logout
      queryClient.clear()
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const refresh = async () => {
    setAuthState(prev => ({ ...prev, loading: true }))
    await checkSession()
  }

  const selectTenant = async (tenantId: string): Promise<boolean> => {
    try {
      const response = await fetch('/auth/select-tenant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ tenantId }),
      })

      if (response.ok) {
        const data = await response.json()

        // Store in localStorage as backup for better UX
        localStorage.setItem('selectedTenantId', tenantId)

        // Hard refresh to dashboard to ensure completely clean state
        window.location.href = '/'

        return true
      } else {
        console.error('Failed to select tenant')
        return false
      }
    } catch (error) {
      console.error('Error selecting tenant:', error)
      return false
    }
  }

  useEffect(() => {
    // Reduce initial loading time by checking session faster
    const checkSessionFast = async () => {
      try {
        // Use a shorter timeout for the auth check
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 3000) // 3s timeout

        const response = await fetch('/auth/session', {
          credentials: 'include',
          signal: controller.signal,
        })
        clearTimeout(timeoutId)

        const data = await response.json()

        if (data.authenticated) {
          setAuthState({
            authenticated: true,
            user: data.user,
            tenants: data.tenants,
            currentTenantId: data.currentTenantId,
            loading: false,
            error: null,
          })
        } else {
          setAuthState({
            authenticated: false,
            user: null,
            tenants: [],
            currentTenantId: null,
            loading: false,
            error: null,
          })
        }
      } catch (_error) {
        // If auth check fails or times out, assume not authenticated
        setAuthState({
          authenticated: false,
          user: null,
          tenants: [],
          currentTenantId: null,
          loading: false,
          error: null,
        })
      }
    }

    // Listen for auth refresh events from settings updates
    const handleAuthRefresh = (event: CustomEvent) => {
      const data = event.detail
      if (data.authenticated) {
        setAuthState({
          authenticated: true,
          user: data.user,
          tenants: data.tenants,
          currentTenantId: data.currentTenantId,
          loading: false,
          error: null,
        })
      }
    }

    checkSessionFast()

    // Add event listener for auth refresh
    window.addEventListener('auth-refresh', handleAuthRefresh as EventListener)

    // Cleanup event listener
    return () => {
      window.removeEventListener('auth-refresh', handleAuthRefresh as EventListener)
    }
  }, [])

  const contextValue: AuthContextType = {
    ...authState,
    login,
    logout,
    refresh,
    selectTenant,
  }

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
}
