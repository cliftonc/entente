import type { VerificationResults, VerificationTask } from '@entente/types'
import { Link } from 'react-router-dom'
import TimestampDisplay from './TimestampDisplay'
import VersionBadge from './VersionBadge'

interface VerificationPanelProps {
  title: string
  verificationResults?: VerificationResults[]
  pendingTasks?: VerificationTask[]
  isLoading: boolean
  serviceName: string
  serviceType: 'provider' | 'consumer'
  viewAllUrl: string
  isPending?: boolean
}

function VerificationPanel({
  title,
  verificationResults,
  pendingTasks,
  isLoading,
  serviceName,
  serviceType,
  viewAllUrl,
  isPending = false,
}: VerificationPanelProps) {
  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <div className="flex justify-between items-center">
          <h2 className={`card-title ${isPending ? 'text-warning' : ''}`}>{title}</h2>
          <Link to={viewAllUrl} className="btn btn-ghost btn-sm">
            View All
            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        {isLoading ? (
          <div className="skeleton h-16 w-full" />
        ) : isPending && pendingTasks && pendingTasks.length > 0 ? (
          <div className="space-y-3">
            {pendingTasks.slice(0, 3).map(task => (
              <div key={task.id} className="bg-base-200 rounded-lg p-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="badge badge-warning">pending</div>
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-medium">
                        {serviceType === 'consumer' ? serviceName : task.consumer}
                      </span>
                      <VersionBadge
                        version={task.consumerVersion}
                        serviceName={serviceType === 'consumer' ? serviceName : task.consumer}
                        serviceType="consumer"

                      />
                    </div>
                    <span className="text-sm text-base-content/80">→</span>
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-medium">{task.provider}</span>
                      <VersionBadge
                        version={task.providerVersion}
                        serviceName={task.provider}
                        serviceType="provider"

                      />
                    </div>
                    <span className="text-xs text-base-content/70">
                      <TimestampDisplay timestamp={task.createdAt} />
                    </span>
                  </div>
                  <span className="text-sm font-medium">
                    {task.interactions?.length || 0} interactions
                  </span>
                </div>
              </div>
            ))}
            {pendingTasks.length > 3 && (
              <div className="text-center">
                <Link to={viewAllUrl} className="text-sm text-primary hover:underline">
                  View {pendingTasks.length - 3} more pending tasks
                </Link>
              </div>
            )}
          </div>
        ) : verificationResults && verificationResults.length > 0 ? (
          <div className="space-y-3">
            {verificationResults.slice(0, 3).map(verification => (
              <Link
                key={verification.id}
                to={`/verification/${verification.id}`}
                className="block bg-base-200 rounded-lg p-3 hover:bg-base-300 transition-colors cursor-pointer"
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div
                      className={`badge ${
                        verification.summary &&
                        verification.summary.passed === verification.summary.total
                          ? 'badge-success'
                          : verification.summary && verification.summary.failed > 0
                            ? 'badge-error'
                            : 'badge-warning'
                      }`}
                    >
                      {verification.summary &&
                      verification.summary.passed === verification.summary.total
                        ? 'passed'
                        : verification.summary && verification.summary.failed > 0
                          ? 'failed'
                          : 'pending'}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-medium">
                        {serviceType === 'consumer'
                          ? serviceName
                          : verification.consumer || 'Unknown'}
                      </span>
                      <VersionBadge
                        version={verification.consumerVersion || 'latest'}
                        serviceName={serviceType === 'consumer'
                          ? serviceName
                          : verification.consumer || 'Unknown'}
                        serviceType="consumer"

                      />
                    </div>
                    <span className="text-sm text-base-content/80">→</span>
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-medium">
                        {verification.provider || 'Unknown'}
                      </span>
                      <VersionBadge
                        version={verification.providerVersion || 'latest'}
                        serviceName={verification.provider || 'Unknown'}
                        serviceType="provider"

                      />
                    </div>
                    <span className="text-xs text-base-content/70">
                      <TimestampDisplay timestamp={verification.submittedAt} />
                    </span>
                  </div>
                  <span className="text-sm font-medium">
                    {verification.summary?.passed || 0}/{verification.summary?.total || 0} tests
                  </span>
                </div>
              </Link>
            ))}
            {verificationResults.length > 3 && (
              <div className="text-center">
                <Link to={viewAllUrl} className="text-sm text-primary hover:underline">
                  View {verificationResults.length - 3} more results
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-base-content/70">
            <svg
              className={`w-12 h-12 mx-auto mb-3 ${isPending ? 'text-success/50' : 'text-base-content/30'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="font-medium">
              {isPending
                ? 'No pending verifications'
                : serviceType === 'provider'
                  ? 'No verification results'
                  : 'No test results'}
            </div>
            <div className="text-sm">
              {isPending
                ? 'All verification tasks have been completed'
                : serviceType === 'provider'
                  ? 'Run verification to see test results'
                  : 'Run contract tests to see test results'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default VerificationPanel
