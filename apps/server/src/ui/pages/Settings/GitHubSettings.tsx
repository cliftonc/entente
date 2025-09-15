import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { GitHubAppInstallation, GitHubAppInstallationUpdate } from '@entente/types'

function GitHubSettings() {
  const queryClient = useQueryClient()
  const [githubAppName, setGithubAppName] = useState('')

  // Fetch GitHub app name from backend
  useEffect(() => {
    fetch('/api/github/app-name')
      .then(res => res.json())
      .then(data => setGithubAppName(data.appName))
      .catch(() => setGithubAppName('entente-dev')) // fallback
  }, [])

  const { data: installation, isLoading } = useQuery({
    queryKey: ['github-installation'],
    queryFn: async (): Promise<GitHubAppInstallation | null> => {
      const response = await fetch('/api/settings/github')
      if (!response.ok) {
        throw new Error('Failed to fetch GitHub installation')
      }
      const data = await response.json()
      return data || null
    },
  })

  const { data: manageInfo } = useQuery({
    queryKey: ['github-manage-url'],
    queryFn: async () => {
      const response = await fetch('/api/settings/github/manage-url')
      if (!response.ok) {
        throw new Error('Failed to fetch GitHub manage URL')
      }
      return response.json()
    },
    enabled: !!installation, // Only fetch if installation exists
  })

  const updateMutation = useMutation({
    mutationFn: async (updates: GitHubAppInstallationUpdate) => {
      const response = await fetch('/api/settings/github', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      })
      if (!response.ok) {
        throw new Error('Failed to update GitHub installation')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['github-installation'] })
    },
  })

  const uninstallMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/settings/github', {
        method: 'DELETE',
      })
      if (!response.ok) {
        throw new Error('Failed to uninstall GitHub app')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['github-installation'] })
    },
  })

  if (isLoading) {
    return (
      <div className="bg-base-100 rounded-lg border border-base-300 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-base-200 rounded w-48"></div>
          <div className="h-4 bg-base-200 rounded w-full"></div>
          <div className="h-20 bg-base-200 rounded"></div>
        </div>
      </div>
    )
  }

  const handleInstall = () => {
    // Redirect to GitHub's app installation flow
    const appName = githubAppName || 'entente-dev'
    window.open(`https://github.com/apps/${appName}/installations/new`, '_blank')
  }

  const handleUninstall = () => {
    if (window.confirm('Are you sure you want to uninstall the GitHub app? This will remove all repository access.')) {
      uninstallMutation.mutate()
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-base-100 rounded-lg border border-base-300 p-6">
        <h2 className="text-xl font-semibold text-base-content mb-6">GitHub Integration</h2>

        {!installation ? (
          <div className="text-center py-8">
            <svg className="w-16 h-16 mx-auto mb-4 text-base-content/40" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" clipRule="evenodd" />
            </svg>
            <h3 className="text-lg font-medium text-base-content mb-2">
              GitHub App Not Installed
            </h3>
            <p className="text-base-content/60 mb-6">
              Install the Entente GitHub app to automatically sync your repositories and enable CI/CD integration.
            </p>
            <button
              className="btn btn-primary"
              onClick={handleInstall}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" clipRule="evenodd" />
              </svg>
              Install GitHub App
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Installation Status */}
            <div className="flex items-center justify-between p-4 bg-success/10 border border-success/20 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-success rounded-full"></div>
                <div>
                  <h3 className="font-medium text-base-content">
                    Connected to @{installation.accountLogin}
                  </h3>
                  <p className="text-sm text-base-content/60">
                    Installed on {new Date(installation.installedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                {manageInfo && (
                  <a
                    href={manageInfo.manageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-outline btn-sm"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path fillRule="evenodd" d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" clipRule="evenodd" />
                    </svg>
                    Manage on GitHub
                  </a>
                )}
                <button
                  className="btn btn-error btn-sm"
                  onClick={handleUninstall}
                  disabled={uninstallMutation.isPending}
                >
                  {uninstallMutation.isPending ? (
                    <>
                      <div className="loading loading-spinner loading-sm"></div>
                      Uninstalling...
                    </>
                  ) : (
                    'Uninstall'
                  )}
                </button>
              </div>
            </div>

            {/* Repository Access */}
            <div>
              <h3 className="font-medium text-base-content mb-3">Repository Access</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-base-content">Repository Selection</span>
                  <select
                    className="select select-sm"
                    value={installation.repositorySelection}
                    onChange={(e) => updateMutation.mutate({
                      repositorySelection: e.target.value as 'all' | 'selected'
                    })}
                    disabled={updateMutation.isPending}
                  >
                    <option value="selected">Selected repositories</option>
                    <option value="all">All repositories</option>
                  </select>
                </div>

                {installation.repositorySelection === 'selected' && (
                  <div className="bg-base-50 p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-base-content mb-2">
                      Selected Repositories ({installation.selectedRepositories.length})
                    </h4>
                    <div className="space-y-2">
                      {installation.selectedRepositories.map((repo) => (
                        <div key={repo.id} className="flex items-center gap-3">
                          <svg className="w-4 h-4 text-base-content/60" fill="currentColor" viewBox="0 0 24 24">
                            <path fillRule="evenodd" d="M3 2.75A.75.75 0 0 1 3.75 2h.5a.75.75 0 0 1 .75.75v.5c0 .414.336.75.75.75H6a.75.75 0 0 1 .75.75v.5A.75.75 0 0 1 6 5.5h-.25A.75.75 0 0 1 5 4.75V4a.25.25 0 0 0-.25-.25h-.5a.25.25 0 0 0-.25.25v.75A.75.75 0 0 1 3 5.5v-.75ZM3.75 7a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h16.5a.75.75 0 0 0 .75-.75v-8.5a.75.75 0 0 0-.75-.75H3.75Z" clipRule="evenodd" />
                          </svg>
                          <span className="text-sm text-base-content">
                            {repo.fullName}
                            {repo.private && (
                              <span className="ml-2 badge badge-neutral badge-xs">private</span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-base-content/60 mt-3">
                      To modify repository selection, visit the{' '}
                      <a
                        href={`https://github.com/settings/installations/${installation.installationId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="link link-primary"
                      >
                        GitHub settings page
                      </a>
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Permissions */}
            <div>
              <h3 className="font-medium text-base-content mb-3">Permissions</h3>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(installation.permissions).map(([permission, level]) => (
                  <div key={permission} className="flex justify-between text-sm">
                    <span className="text-base-content capitalize">
                      {permission.replace('_', ' ')}
                    </span>
                    <span className="text-base-content/60 capitalize">{level}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Features */}
      <div className="bg-base-100 rounded-lg border border-base-300 p-6">
        <h2 className="text-xl font-semibold text-base-content mb-6">Features</h2>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${installation ? 'bg-success' : 'bg-base-300'}`}></div>
            <div>
              <span className="font-medium text-base-content">Automatic CI Integration</span>
              <p className="text-sm text-base-content/60">
                Automatically record interactions and verify contracts in CI
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${installation ? 'bg-success' : 'bg-base-300'}`}></div>
            <div>
              <span className="font-medium text-base-content">Deployment Tracking</span>
              <p className="text-sm text-base-content/60">
                Track deployments and versions automatically from GitHub releases
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${installation ? 'bg-success' : 'bg-base-300'}`}></div>
            <div>
              <span className="font-medium text-base-content">Pull Request Checks</span>
              <p className="text-sm text-base-content/60">
                Validate contract compatibility before merging PRs
              </p>
            </div>
          </div>
        </div>
      </div>

      {updateMutation.isError && (
        <div className="alert alert-error">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{updateMutation.error?.message}</span>
        </div>
      )}
    </div>
  )
}

export default GitHubSettings