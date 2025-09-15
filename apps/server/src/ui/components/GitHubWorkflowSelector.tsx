import { useQuery } from '@tanstack/react-query'
import type { GitHubWorkflow } from '@entente/types'
import { githubApi } from '../utils/api'

interface GitHubWorkflowSelectorProps {
  serviceName: string
  serviceType: 'consumer' | 'provider'
  repositoryOwner: string
  repositoryName: string
  currentWorkflowId?: string
  onWorkflowSelect: (workflow: GitHubWorkflow) => void
  onCancel: () => void
  isUpdating: boolean
}

function GitHubWorkflowSelector({
  serviceName,
  serviceType,
  repositoryOwner,
  repositoryName,
  currentWorkflowId,
  onWorkflowSelect,
  onCancel,
  isUpdating,
}: GitHubWorkflowSelectorProps) {
  // Fetch available workflows
  const { data: workflows, isLoading, error } = useQuery({
    queryKey: ['github-workflows', serviceName, serviceType],
    queryFn: () => githubApi.getWorkflows(serviceName, serviceType),
  })

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-2xl">
        <h3 className="font-bold text-lg mb-4">Select Verification Workflow</h3>

        <div className="mb-4">
          <div className="text-sm text-base-content/70">
            Repository: {repositoryOwner}/{repositoryName}
          </div>
        </div>

        {isLoading && (
          <div className="flex justify-center py-8">
            <div className="loading loading-spinner loading-lg" />
          </div>
        )}

        {error && (
          <div className="alert alert-error mb-4">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Failed to load workflows. Please check your GitHub app permissions.</span>
          </div>
        )}

        {workflows && workflows.length === 0 && (
          <div className="text-center py-8">
            <svg className="w-12 h-12 mx-auto mb-3 text-base-content/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <div className="text-sm font-medium text-base-content">No Workflows Found</div>
            <div className="text-xs text-base-content/70 mb-3">
              No GitHub Actions workflows found in this repository
            </div>
            <a
              href={`https://github.com/${repositoryOwner}/${repositoryName}/actions`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline btn-sm"
            >
              View Actions on GitHub
            </a>
          </div>
        )}

        {workflows && workflows.length > 0 && (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {workflows.map((workflow) => (
              <div
                key={workflow.id}
                className={`card bg-base-200 cursor-pointer transition-all hover:bg-base-300 ${
                  workflow.id.toString() === currentWorkflowId ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => !isUpdating && onWorkflowSelect(workflow)}
              >
                <div className="card-body p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-base-content truncate">
                          {workflow.name}
                        </span>
                        <div
                          className={`badge badge-sm ${
                            workflow.state === 'active'
                              ? 'badge-success'
                              : workflow.state === 'disabled_manually'
                                ? 'badge-warning'
                                : 'badge-error'
                          }`}
                        >
                          {workflow.state}
                        </div>
                        {workflow.id.toString() === currentWorkflowId && (
                          <div className="badge badge-primary badge-sm">current</div>
                        )}
                      </div>
                      <div className="text-xs text-base-content/70 font-mono">
                        {workflow.path}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={workflow.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-ghost btn-sm"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>

                      {workflow.badge_url && (
                        <img
                          src={workflow.badge_url}
                          alt={`${workflow.name} status`}
                          className="h-5"
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="modal-action">
          <button
            className="btn btn-ghost"
            onClick={onCancel}
            disabled={isUpdating}
          >
            Cancel
          </button>
        </div>

        {isUpdating && (
          <div className="absolute inset-0 bg-base-100/50 flex items-center justify-center rounded-lg">
            <div className="flex items-center gap-2">
              <div className="loading loading-spinner loading-md" />
              <span>Updating configuration...</span>
            </div>
          </div>
        )}
      </div>
      <div className="modal-backdrop" onClick={onCancel} />
    </div>
  )
}

export default GitHubWorkflowSelector