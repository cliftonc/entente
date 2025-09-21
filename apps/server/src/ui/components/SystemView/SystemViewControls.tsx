import { memo } from 'react'

interface SystemViewFilters {
  environment?: string
  status?: 'active' | 'archived' | 'deprecated' | 'all'
  viewMode: 'simple' | 'detailed'
}

interface SystemViewControlsProps {
  filters: SystemViewFilters
  onFilterChange: (filters: Partial<SystemViewFilters>) => void
  environments: string[]
}

function SystemViewControls({ filters, onFilterChange, environments }: SystemViewControlsProps) {
  return (
    <div className="flex items-center gap-4 flex-wrap">
      {/* View Mode Toggle */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-base-content">View:</span>
        <div className="join">
          <button
            type="button"
            className={`btn btn-sm join-item ${
              filters.viewMode === 'simple' ? 'btn-primary' : 'btn-outline'
            }`}
            onClick={() => onFilterChange({ viewMode: 'simple' })}
          >
            Simple
          </button>
          <button
            type="button"
            className={`btn btn-sm join-item ${
              filters.viewMode === 'detailed' ? 'btn-primary' : 'btn-outline'
            }`}
            onClick={() => onFilterChange({ viewMode: 'detailed' })}
          >
            Detailed
          </button>
        </div>
      </div>

      {/* Environment Filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-base-content">Environment:</span>
        <select
          className="select select-sm select-bordered w-32"
          value={filters.environment || 'all'}
          onChange={(e) => onFilterChange({
            environment: e.target.value === 'all' ? undefined : e.target.value
          })}
        >
          <option value="all">All</option>
          {environments.map(env => (
            <option key={env} value={env}>
              {env}
            </option>
          ))}
        </select>
      </div>


      {/* Status Filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-base-content">Status:</span>
        <select
          className="select select-sm select-bordered w-32"
          value={filters.status || 'all'}
          onChange={(e) => onFilterChange({
            status: e.target.value as 'active' | 'archived' | 'deprecated' | 'all'
          })}
        >
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
          <option value="deprecated">Deprecated</option>
        </select>
      </div>

      {/* Reset Filters */}
      <button
        type="button"
        className="btn btn-sm btn-ghost"
        onClick={() => onFilterChange({
          environment: undefined,
          status: 'all',
          viewMode: 'simple'
        })}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Reset
      </button>
    </div>
  )
}

export default memo(SystemViewControls)