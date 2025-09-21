import { Link } from 'react-router-dom'

interface VersionBadgeProps {
  version: string
  serviceName?: string
  serviceVersionId?: string
  className?: string
  isClickable?: boolean
  size?: string
}

function VersionBadge({
  version,
  serviceName,
  serviceVersionId,
  className = '',
  isClickable = true,
  size = 'md',
}: VersionBadgeProps) {
  const badgeContent = `v${version}`

  // Apply consistent color coding
  const colorClass = 'bg-gray-100 text-gray-800 border-gray-300'

  // Size classes
  const sizeClasses = {
    xs: 'px-1.5 py-0.5 text-xs',
    sm: 'px-2 py-1 text-xs',
    md: 'px-2 py-1.5 text-xs',
    lg: 'px-3 py-2 text-sm',
  }

  const baseClassName = `${sizeClasses[size as keyof typeof sizeClasses] || sizeClasses.md} font-medium border rounded-md whitespace-nowrap inline-block ${colorClass} ${className}`

  if (!isClickable || (!serviceVersionId && !serviceName)) {
    return <span className={baseClassName}>{badgeContent}</span>
  }

  return (
    <Link
      to={serviceName ? `/services/${serviceName}/versions/${version}` : `/service-versions/${serviceVersionId}`}
      className={`${baseClassName} hover:bg-blue-200 hover:text-blue-900 transition-colors cursor-pointer`}
      title={`View version ${version} details for ${serviceName}`}
    >
      {badgeContent}
    </Link>
  )
}

export default VersionBadge
