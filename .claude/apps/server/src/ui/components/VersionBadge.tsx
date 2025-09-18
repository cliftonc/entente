import { Link } from 'react-router-dom'

interface VersionBadgeProps {
  version: string
  serviceName: string
  serviceType: 'consumer' | 'provider'
  serviceVersionId?: string
  className?: string
  isClickable?: boolean
}

function VersionBadge({
  version,
  serviceName,
  serviceType,
  serviceVersionId,
  className = '',
  isClickable = true,
}: VersionBadgeProps) {
  const badgeContent = `v${version}`

  // Apply color coding based on service type - lighter colors with grey border and rounded square look
  const colorClass =
    serviceType === 'consumer'
      ? 'bg-blue-100 text-blue-800 border-gray-300' // lighter blue for consumer
      : 'bg-green-100 text-green-800 border-gray-300' // lighter green for provider

  const baseClassName = `px-2 py-1.5 text-xs font-medium border rounded-md whitespace-nowrap inline-block ${colorClass} ${className}`

  if (!isClickable || !serviceVersionId) {
    return <span className={baseClassName}>{badgeContent}</span>
  }

  return (
    <Link
      to={`/service-versions/${serviceVersionId}`}
      className={`${baseClassName} hover:bg-blue-200 hover:text-blue-900 transition-colors cursor-pointer`}
      title={`View version ${version} details for ${serviceName}`}
    >
      {badgeContent}
    </Link>
  )
}

export default VersionBadge
