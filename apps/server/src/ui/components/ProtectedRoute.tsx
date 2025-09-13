import { ReactNode } from 'react'
import { useAuth } from '../hooks/useAuth'
import Login from '../pages/Login'

interface ProtectedRouteProps {
  children: ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { authenticated, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <div className="text-center">
          <span className="loading loading-spinner loading-lg text-primary"></span>
          <p className="mt-4 text-base-content/70">Loading...</p>
        </div>
      </div>
    )
  }

  if (!authenticated) {
    return <Login />
  }

  return <>{children}</>
}