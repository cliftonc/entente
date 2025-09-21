import { Link } from 'react-router-dom'
import VersionBadge from './VersionBadge'

interface ServiceVersion {
  id: string
  version: string
  serviceName: string
  serviceType: 'consumer' | 'provider'
}

interface VersionBadgeListProps {
  versions: ServiceVersion[]
  maxDisplay?: number
  showMoreUrl?: string
  className?: string
}

function VersionBadgeList({
  versions,
  maxDisplay = 5,
  showMoreUrl,
  className = '',
}: VersionBadgeListProps) {
  const displayedVersions = versions.slice(0, maxDisplay)
  const remainingCount = Math.max(0, versions.length - maxDisplay)

  if (versions.length === 0) {
    return (
      <div className="text-center py-4 text-base-content/70">
        <div className="text-sm font-medium">No versions found</div>
      </div>
    )
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex flex-wrap gap-2">
        {displayedVersions.map(version => (
          <VersionBadge
            key={version.id}
            version={version.version}
            serviceName={version.serviceName}
            serviceVersionId={version.id}
          />
        ))}
      </div>

      {remainingCount > 0 && showMoreUrl && (
        <div className="text-center">
          <Link to={showMoreUrl} className="text-xs text-primary hover:underline">
            Show {remainingCount} more version{remainingCount > 1 ? 's' : ''}
          </Link>
        </div>
      )}
    </div>
  )
}

export default VersionBadgeList
