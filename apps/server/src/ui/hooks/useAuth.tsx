import { useState, useEffect, createContext, useContext, ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'

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
  loading: boolean
  error: string | null
}

interface AuthContextType extends AuthState {
  login: () => void
  logout: () => Promise<void>
  refresh: () => Promise<void>
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
          loading: false,
          error: null,
        })
      } else {
        setAuthState({
          authenticated: false,
          user: null,
          tenants: [],
          loading: false,
          error: null,
        })
      }
    } catch (error) {
      setAuthState({
        authenticated: false,
        user: null,
        tenants: [],
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

  useEffect(() => {
    checkSession()
  }, [])

  const contextValue: AuthContextType = {
    ...authState,
    login,
    logout,
    refresh,
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
}