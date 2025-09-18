import type { Contract } from '@entente/types'
import { Link } from 'react-router-dom'
import TimestampDisplay from './TimestampDisplay'
import VersionBadge from './VersionBadge'

interface ContractsPanelProps {
  title: string
  contracts?: Contract[]
  isLoading: boolean
  serviceName: string
  serviceType: 'provider' | 'consumer'
  totalInteractions: number
  viewAllUrl: string
  getContractInteractionCount: (contract: Contract) => number
}

function ContractsPanel({
  title,
  contracts,
  isLoading,
  serviceName,
  serviceType,
  totalInteractions,
  viewAllUrl,
  getContractInteractionCount,
}: ContractsPanelProps) {
  const otherServiceType = serviceType === 'provider' ? 'consumer' : 'provider'
  const otherServiceLabel = serviceType === 'provider' ? 'Consumers' : 'Providers'

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <div className="flex justify-between items-center">
          <h2 className="card-title">{title}</h2>
          <Link to={viewAllUrl} className="btn btn-ghost btn-sm">
            View All
            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <div className="skeleton h-16 w-full" />
            <div className="skeleton h-16 w-full" />
          </div>
        ) : contracts && contracts.length > 0 ? (
          <div className="space-y-4">
            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{contracts.length}</div>
                <div className="text-sm text-base-content/70">Active Contracts</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-secondary">
                  {
                    new Set(
                      contracts.map(c =>
                        serviceType === 'provider' ? c.consumerName : c.providerName
                      )
                    ).size
                  }
                </div>
                <div className="text-sm text-base-content/70">{otherServiceLabel}</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-accent">{totalInteractions}</div>
                <div className="text-sm text-base-content/70">Total Interactions</div>
              </div>
            </div>

            {/* Recent contracts */}
            <div className="divider">Recent Contracts</div>
            <div className="space-y-3">
              {contracts.slice(0, 5).map(contract => {
                return (
                  <Link
                    key={contract.id}
                    to={`/contracts/${contract.id}`}
                    className="block bg-base-200 rounded-lg p-3 hover:bg-base-300 transition-colors"
                  >
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <div className="font-medium text-sm">{contract.consumerName}</div>
                          <VersionBadge
                            version={contract.consumerVersion}
                            serviceName={contract.consumerName}
                            serviceType="consumer"
                          />
                        </div>
                        <span className="text-base-content/40">→</span>
                        <div className="flex items-center gap-2">
                          <div className="font-medium text-sm">{contract.providerName}</div>
                          <VersionBadge
                            version={contract.providerVersion}
                            serviceName={contract.providerName}
                            serviceType="provider"
                          />
                        </div>
                        <span className="text-xs text-base-content/70">
                          <TimestampDisplay timestamp={contract.lastSeen} />
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="badge badge-primary badge-sm px-2">
                          {getContractInteractionCount(contract)} interactions
                        </div>
                        <div
                          className={`badge badge-sm px-2 ${
                            contract.status === 'active'
                              ? 'badge-success'
                              : contract.status === 'deprecated' || contract.status === 'archived'
                                ? 'badge-warning'
                                : 'badge-error'
                          }`}
                        >
                          {contract.status}
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-base-content/70">
            <svg
              className="w-12 h-12 mx-auto mb-3 text-base-content/30"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <div className="font-medium">
              {serviceType === 'provider' ? 'No consumer contracts' : 'No provider contracts'}
            </div>
            <div className="text-sm">
              {serviceType === 'provider'
                ? 'No consumers have established contracts with this provider yet'
                : "This consumer hasn't established any contracts yet"}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ContractsPanel
