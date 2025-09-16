import type { ReactNode } from 'react'
import { useAuth } from '../hooks/useAuth'
import Login from '../pages/Login'

interface ProtectedRouteProps {
  children: ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { authenticated, loading } = useAuth()

  // Reduce loading screen time - show content faster
  if (loading) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <div className="text-center">
          <span className="loading loading-spinner loading-md text-primary" />
          <p className="mt-2 text-sm text-base-content/70">Checking authentication...</p>
        </div>
      </div>
    )
  }

  if (!authenticated) {
    return <Login />
  }

  return <>{children}</>
}
