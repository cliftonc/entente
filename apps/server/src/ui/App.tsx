import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Route, Routes } from 'react-router-dom'
import AdminLayout from './components/AdminLayout'
import ProtectedRoute from './components/ProtectedRoute'
import { WebSocketProvider } from './components/WebSocketProvider'
import { AuthProvider } from './hooks/useAuth'
import { initializeQueryClient } from './lib/queryClient'
import ContractDetail from './pages/ContractDetail'
import Contracts from './pages/Contracts'
import Dashboard from './pages/Dashboard'
import Deployments from './pages/Deployments'
import FixtureDetails from './pages/FixtureDetails'
import Fixtures from './pages/Fixtures'
import GitHubEmailRequired from './pages/GitHubEmailRequired'
import GraphQLPlayground from './pages/GraphQLPlayground'
import InteractionDetails from './pages/InteractionDetails'
import InviteAccept from './pages/InviteAccept'
import OpenAPIViewer from './pages/OpenAPIViewer'
import ServiceVersionDetail from './pages/ServiceVersionDetail'
import ServiceVersions from './pages/ServiceVersions'
import ServiceDetail from './pages/ServiceDetail'
import Services from './pages/Services'
import Settings from './pages/Settings'
import SystemView from './pages/SystemView'
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
                      {/* Unified service route - ServiceDetail page handles both consumer and provider roles */}
                      <Route path="/services/:name" element={<ServiceDetail />} />
                      <Route path="/services/:serviceName/versions" element={<ServiceVersions />} />
                      <Route path="/services/:serviceName/versions/:version" element={<ServiceVersionDetail />} />
                      <Route path="/service-versions/:id" element={<ServiceVersionDetail />} />
                      <Route path="/contracts" element={<Contracts />} />
                      <Route path="/contracts/:id" element={<ContractDetail />} />
                      <Route path="/interactions/:id" element={<InteractionDetails />} />
                      <Route path="/fixtures" element={<Fixtures />} />
                      <Route path="/fixtures/:id" element={<FixtureDetails />} />
                      <Route path="/deployments" element={<Deployments />} />
                      <Route path="/system-view" element={<SystemView />} />
                      <Route path="/verification" element={<Verification />} />
                      <Route path="/verification/:id" element={<VerificationDetail />} />
                      <Route path="/openapi/service/:serviceName" element={<OpenAPIViewer />} />
                      <Route
                        path="/graphql/service/:serviceName/:version"
                        element={<GraphQLPlayground />}
                      />
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
