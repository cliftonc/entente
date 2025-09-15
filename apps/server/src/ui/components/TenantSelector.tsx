import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'

function TenantSelector() {
  const { tenants, currentTenantId, selectTenant } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const currentTenant = tenants.find(t => t.tenant.id === currentTenantId)

  const handleSelectTenant = async (tenantId: string) => {
    if (tenantId === currentTenantId) {
      setIsOpen(false)
      return
    }

    setIsLoading(true)
    const success = await selectTenant(tenantId)
    setIsLoading(false)

    if (success) {
      setIsOpen(false)
    }
  }

  if (tenants.length <= 1) {
    // Show current tenant name with icon if user only has one tenant
    return (
      <div className="w-full flex items-center gap-2 px-3 py-2 text-sm bg-base-300/50 rounded-lg">
        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          />
        </svg>
        <span className="truncate">
          {currentTenant ? currentTenant.tenant.name : 'Personal'}
        </span>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Tenant dropdown trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm bg-base-300 hover:bg-base-300/80 rounded-lg transition-colors"
        disabled={isLoading}
      >
        <div className="flex items-center gap-2 min-w-0">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </svg>
          <span className="truncate">
            {currentTenant ? currentTenant.tenant.name : 'Select Tenant'}
          </span>
        </div>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu */}
          <div className="absolute top-full left-0 right-0 mt-2 bg-base-100 border border-base-300 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto">
            {tenants.map(({ tenant, role }) => (
              <button
                key={tenant.id}
                onClick={() => handleSelectTenant(tenant.id)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-base-200 transition-colors ${
                  tenant.id === currentTenantId ? 'bg-primary/10 text-primary' : ''
                }`}
                disabled={isLoading}
              >
                <div className="flex flex-col items-start min-w-0">
                  <span className="truncate font-medium">{tenant.name}</span>
                  <span className="text-xs text-base-content/60 capitalize">{role}</span>
                </div>
                {tenant.id === currentTenantId && (
                  <svg className="w-4 h-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default TenantSelector