import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Route, Routes } from 'react-router-dom'
import AdminLayout from './components/AdminLayout'
import ProtectedRoute from './components/ProtectedRoute'
import { AuthProvider } from './hooks/useAuth'
import ConsumerDetail from './pages/ConsumerDetail'
import ContractDetail from './pages/ContractDetail'
import Contracts from './pages/Contracts'
import Dashboard from './pages/Dashboard'
import Deployments from './pages/Deployments'
import FixtureDetails from './pages/FixtureDetails'
import Fixtures from './pages/Fixtures'
import GitHubEmailRequired from './pages/GitHubEmailRequired'
import InviteAccept from './pages/InviteAccept'
import InteractionDetails from './pages/InteractionDetails'
import ProviderDetail from './pages/ProviderDetail'
import Services from './pages/Services'
import Settings from './pages/Settings'
import Verification from './pages/Verification'
import VerificationDetail from './pages/VerificationDetail'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30 seconds - fresher data, faster perceived performance
      gcTime: 1000 * 60 * 10, // 10 minutes - shorter garbage collection
      retry: 1, // Fail faster instead of long retries
      retryDelay: 1000, // 1 second between retries
      refetchOnWindowFocus: false, // Avoid unnecessary refetches
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/invite/accept" element={<InviteAccept />} />
          <Route path="/github-email-required" element={<GitHubEmailRequired />} />

          {/* Protected routes */}
          <Route path="/*" element={
            <ProtectedRoute>
              <AdminLayout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/services" element={<Services />} />
                  <Route path="/services/provider/:name" element={<ProviderDetail />} />
                  <Route path="/services/consumer/:name" element={<ConsumerDetail />} />
                  <Route path="/contracts" element={<Contracts />} />
                  <Route path="/contracts/:id" element={<ContractDetail />} />
                  <Route path="/interactions/:id" element={<InteractionDetails />} />
                  <Route path="/fixtures" element={<Fixtures />} />
                  <Route path="/fixtures/:id" element={<FixtureDetails />} />
                  <Route path="/deployments" element={<Deployments />} />
                  <Route path="/verification" element={<Verification />} />
                  <Route path="/verification/:id" element={<VerificationDetail />} />
                  <Route path="/settings/*" element={<Settings />} />
                </Routes>
              </AdminLayout>
            </ProtectedRoute>
          } />
        </Routes>
      </AuthProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}

export default App
