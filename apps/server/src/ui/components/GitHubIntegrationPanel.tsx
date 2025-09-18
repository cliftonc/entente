import type { GitHubServiceConfig, GitHubWorkflow } from '@entente/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { githubApi } from '../utils/api'
import GitHubWorkflowSelector from './GitHubWorkflowSelector'

interface GitHubIntegrationPanelProps {
  serviceName: string
  serviceType: 'consumer' | 'provider'
  gitRepositoryUrl?: string
  hasGitHubApp: boolean
}

function GitHubIntegrationPanel({
  serviceName,
  serviceType,
  gitRepositoryUrl,
  hasGitHubApp,
}: GitHubIntegrationPanelProps) {
  const queryClient = useQueryClient()
  const [isConfiguring, setIsConfiguring] = useState(false)

  // Fetch GitHub configuration for this service
  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['github-config', serviceName, serviceType],
    queryFn: () => githubApi.getServiceConfig(serviceName, serviceType),
    enabled: hasGitHubApp,
  })

  // Fetch workflows to get badge URL for the configured workflow
  const { data: workflows } = useQuery({
    queryKey: ['github-workflows', serviceName, serviceType],
    queryFn: () => githubApi.getWorkflows(serviceName, serviceType),
    enabled: hasGitHubApp && !!config?.repositoryOwner && !!config?.repositoryName,
  })

  // Find the current workflow to get its badge
  const currentWorkflow = workflows?.find(w => w.id.toString() === config?.verifyWorkflowId)

  // Trigger workflow mutation
  const triggerWorkflowMutation = useMutation({
    mutationFn: () => githubApi.triggerWorkflow(serviceName, serviceType, { ref: 'main' }),
    onSuccess: () => {
      // Could show a success toast here
      console.log('Workflow triggered successfully')
    },
    onError: error => {
      console.error('Failed to trigger workflow:', error)
      // Could show an error toast here
    },
  })

  // Update configuration mutation
  const updateConfigMutation = useMutation({
    mutationFn: (newConfig: {
      verifyWorkflowId?: string
      verifyWorkflowName?: string
      verifyWorkflowPath?: string
    }) => githubApi.updateServiceConfig(serviceName, serviceType, newConfig),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['github-config', serviceName, serviceType] })
      setIsConfiguring(false)
    },
    onError: error => {
      console.error('Failed to update GitHub config:', error)
    },
  })

  // Clear configuration mutation
  const clearConfigMutation = useMutation({
    mutationFn: () => githubApi.clearServiceConfig(serviceName, serviceType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['github-config', serviceName, serviceType] })
    },
    onError: error => {
      console.error('Failed to clear GitHub config:', error)
    },
  })

  const handleWorkflowSelect = (workflow: GitHubWorkflow) => {
    updateConfigMutation.mutate({
      verifyWorkflowId: workflow.id.toString(),
      verifyWorkflowName: workflow.name,
      verifyWorkflowPath: workflow.path,
    })
  }

  if (!hasGitHubApp) {
    return (
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h3 className="card-title text-lg">GitHub Integration</h3>
          <div className="text-center py-4">
            <svg
              className="w-12 h-12 mx-auto mb-3 text-base-content/40"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                fillRule="evenodd"
                d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"
                clipRule="evenodd"
              />
            </svg>
            <div className="text-sm font-medium text-base-content">GitHub App Required</div>
            <div className="text-xs text-base-content/70 mb-3">
              Install the GitHub app to enable verification automation
            </div>
            <a href="/settings" className="btn btn-primary btn-sm">
              Install GitHub App
            </a>
          </div>
        </div>
      </div>
    )
  }

  if (configLoading) {
    return (
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <div className="skeleton h-6 w-48 mb-4" />
          <div className="skeleton h-20 w-full" />
        </div>
      </div>
    )
  }

  const hasRepository = config?.repositoryOwner && config?.repositoryName
  const hasWorkflow = config?.verifyWorkflowId && config?.verifyWorkflowName
  const repositoryUrl = hasRepository
    ? `https://github.com/${config.repositoryOwner}/${config.repositoryName}`
    : gitRepositoryUrl

  // If no repository is configured, show re-registration prompt
  if (!hasRepository && !gitRepositoryUrl) {
    return (
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h3 className="card-title text-lg">GitHub Integration</h3>
          <div className="text-center py-6">
            <svg
              className="w-12 h-12 mx-auto mb-3 text-base-content/40"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                fillRule="evenodd"
                d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"
                clipRule="evenodd"
              />
            </svg>
            <div className="text-sm font-medium text-base-content mb-2">
              No Repository Configured
            </div>
            <div className="text-xs text-base-content/70 mb-4">
              Please re-register this provider to match the repository.
            </div>
            <div className="bg-base-200 rounded-lg p-3 text-left">
              <div className="text-xs font-medium text-base-content mb-1">
                To enable GitHub integration:
              </div>
              <div className="text-xs text-base-content/70">
                1. Include the <code className="bg-base-300 px-1 rounded">gitRepositoryUrl</code>{' '}
                field when registering
                <br />
                2. The system will automatically link to your GitHub repository
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <div className="flex justify-between items-center">
          <h3 className="card-title text-lg">GitHub Integration</h3>
          {hasRepository && (
            <div className="dropdown dropdown-end">
              <div tabIndex={0} role="button" className="btn btn-ghost btn-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                  />
                </svg>
              </div>
              <ul
                tabIndex={0}
                className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52"
              >
                <li>
                  <button onClick={() => setIsConfiguring(true)}>Configure Workflow</button>
                </li>
                <li>
                  <button
                    onClick={() => clearConfigMutation.mutate()}
                    className="text-error"
                    disabled={clearConfigMutation.isPending}
                  >
                    {clearConfigMutation.isPending ? 'Clearing...' : 'Clear Configuration'}
                  </button>
                </li>
              </ul>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Repository Link */}
          {repositoryUrl && (
            <div>
              <label className="label">
                <span className="label-text">Repository</span>
              </label>
              <a
                href={repositoryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-primary hover:underline"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path
                    fillRule="evenodd"
                    d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"
                    clipRule="evenodd"
                  />
                </svg>
                {hasRepository
                  ? `${config.repositoryOwner}/${config.repositoryName}`
                  : 'View Repository'}
              </a>
            </div>
          )}

          {/* Verification Workflow */}
          {hasRepository && (
            <div>
              <label className="label">
                <span className="label-text">Verification Workflow</span>
              </label>
              {hasWorkflow ? (
                <div className="space-y-3">
                  <div className="bg-base-200 px-3 py-2 rounded-lg">
                    <div className="font-mono text-sm mb-2">{config.verifyWorkflowName}</div>
                    {currentWorkflow?.badge_url && (
                      <img
                        src={currentWorkflow.badge_url}
                        alt={`${config.verifyWorkflowName} status`}
                        className="h-5"
                      />
                    )}
                  </div>
                  <button
                    className="btn btn-primary w-full"
                    onClick={() => triggerWorkflowMutation.mutate()}
                    disabled={triggerWorkflowMutation.isPending}
                  >
                    {triggerWorkflowMutation.isPending ? (
                      <>
                        <div className="loading loading-spinner loading-sm" />
                        Triggering...
                      </>
                    ) : (
                      <>
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h1m4 0h1m6-10V4a2 2 0 00-2-2H5a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V6z"
                          />
                        </svg>
                        Trigger Verification
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-base-content/70 text-sm">No workflow configured</div>
                  <button className="btn btn-outline w-full" onClick={() => setIsConfiguring(true)}>
                    Configure Workflow
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Configuration Status */}
        {config?.configuredAt && (
          <div className="text-xs text-base-content/60">
            Configured {new Date(config.configuredAt).toLocaleDateString()}
          </div>
        )}

        {/* Configuration Modal */}
        {isConfiguring && hasRepository && (
          <GitHubWorkflowSelector
            serviceName={serviceName}
            serviceType={serviceType}
            repositoryOwner={config.repositoryOwner!}
            repositoryName={config.repositoryName!}
            currentWorkflowId={config?.verifyWorkflowId}
            onWorkflowSelect={handleWorkflowSelect}
            onCancel={() => setIsConfiguring(false)}
            isUpdating={updateConfigMutation.isPending}
          />
        )}
      </div>
    </div>
  )
}

export default GitHubIntegrationPanel
