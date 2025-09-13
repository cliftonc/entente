import { Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { AuthProvider } from './hooks/useAuth'
import ProtectedRoute from './components/ProtectedRoute'
import AdminLayout from './components/AdminLayout'
import Dashboard from './pages/Dashboard'
import Services from './pages/Services'
import Interactions from './pages/Interactions'
import Fixtures from './pages/Fixtures'
import Deployments from './pages/Deployments'
import Verification from './pages/Verification'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ProtectedRoute>
          <AdminLayout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/services" element={<Services />} />
              <Route path="/interactions" element={<Interactions />} />
              <Route path="/fixtures" element={<Fixtures />} />
              <Route path="/deployments" element={<Deployments />} />
              <Route path="/verification" element={<Verification />} />
            </Routes>
          </AdminLayout>
        </ProtectedRoute>
      </AuthProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}

export default App