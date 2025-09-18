import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Route, Routes } from 'react-router-dom'
import AdminLayout from './components/AdminLayout'
import ProtectedRoute from './components/ProtectedRoute'
import { WebSocketProvider } from './components/WebSocketProvider'
import { AuthProvider } from './hooks/useAuth'
import { initializeQueryClient } from './lib/queryClient'
import ConsumerDetail from './pages/ConsumerDetail'
import ContractDetail from './pages/ContractDetail'
import Contracts from './pages/Contracts'
import Dashboard from './pages/Dashboard'
import Deployments from './pages/Deployments'
import FixtureDetails from './pages/FixtureDetails'
import Fixtures from './pages/Fixtures'
import GitHubEmailRequired from './pages/GitHubEmailRequired'
import InteractionDetails from './pages/InteractionDetails'
import InviteAccept from './pages/InviteAccept'
import OpenAPIViewer from './pages/OpenAPIViewer'
import ProviderDetail from './pages/ProviderDetail'
import ServiceVersionDetail from './pages/ServiceVersionDetail'
import ServiceVersions from './pages/ServiceVersions'
import Services from './pages/Services'
import Settings from './pages/Settings'
import Verification from './pages/Verification'
import VerificationDetail from './pages/VerificationDetail'

const queryClient = initializeQueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/invite/accept" element={<InviteAccept />} />
          <Route path="/github-email-required" element={<GitHubEmailRequired />} />

          {/* Protected routes */}
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <WebSocketProvider>
                  <AdminLayout>
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/services" element={<Services />} />
                      <Route path="/services/provider/:name" element={<ProviderDetail />} />
                      <Route path="/services/consumer/:name" element={<ConsumerDetail />} />
                      <Route path="/services/:serviceName/versions" element={<ServiceVersions />} />
                      <Route path="/service-versions/:id" element={<ServiceVersionDetail />} />
                      <Route path="/contracts" element={<Contracts />} />
                      <Route path="/contracts/:id" element={<ContractDetail />} />
                      <Route path="/interactions/:id" element={<InteractionDetails />} />
                      <Route path="/fixtures" element={<Fixtures />} />
                      <Route path="/fixtures/:id" element={<FixtureDetails />} />
                      <Route path="/deployments" element={<Deployments />} />
                      <Route path="/verification" element={<Verification />} />
                      <Route path="/verification/:id" element={<VerificationDetail />} />
                      <Route path="/openapi/service/:serviceName" element={<OpenAPIViewer />} />
                      <Route path="/settings/*" element={<Settings />} />
                    </Routes>
                  </AdminLayout>
                </WebSocketProvider>
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}

export default App
