import type { SpecType } from '@entente/types'
import {
  BoltIcon,
  CodeBracketIcon,
  DocumentTextIcon,
  EnvelopeIcon,
  ShareIcon,
} from '@heroicons/react/24/outline'

interface SpecBadgeProps {
  specType: SpecType
  size?: 'sm' | 'md'
  showIcon?: boolean
  className?: string
}

const specConfig = {
  openapi: {
    label: 'OpenAPI',
    color: 'bg-orange-100 text-orange-800 border-orange-300',
    icon: DocumentTextIcon,
  },
  graphql: {
    label: 'GraphQL',
    color: 'bg-pink-100 text-pink-800 border-pink-300',
    icon: ShareIcon,
  },
  asyncapi: {
    label: 'AsyncAPI',
    color: 'bg-teal-100 text-teal-800 border-teal-300',
    icon: BoltIcon,
  },
  grpc: {
    label: 'gRPC',
    color: 'bg-blue-100 text-blue-800 border-blue-300',
    icon: CodeBracketIcon,
  },
  soap: {
    label: 'SOAP',
    color: 'bg-gray-100 text-gray-800 border-gray-300',
    icon: EnvelopeIcon,
  },
} as const

function SpecBadge({ specType, size = 'sm', showIcon = true, className = '' }: SpecBadgeProps) {
  const config = specConfig[specType]

  if (!config) {
    return (
      <span
        className={`px-2 py-1 text-xs font-medium border rounded-md bg-gray-100 text-gray-600 border-gray-300 ${className}`}
        title="Unknown spec type"
      >
        Unknown
      </span>
    )
  }

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
  }

  const iconSizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
  }

  const IconComponent = config.icon

  return (
    <span
      className={`${sizeClasses[size]} font-medium border rounded-md whitespace-nowrap inline-flex items-center gap-1 ${config.color} ${className}`}
      title={`${config.label} specification`}
    >
      {showIcon && <IconComponent className={iconSizeClasses[size]} />}
      {config.label}
    </span>
  )
}

export default SpecBadge
