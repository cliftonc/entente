import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Link } from 'react-router-dom'
import type { Service } from '@entente/types'
import {
  ServerIcon,
  CubeTransparentIcon,
  BoltIcon,
  CommandLineIcon,
} from '@heroicons/react/24/outline'

interface ServiceNodeData {
  service: Service & { deployedVersion?: string }
  contractCount: number
  isGroup?: boolean
  hasIncomingEdges?: boolean
  hasOutgoingEdges?: boolean
  hasDeployment?: boolean
}

function ServiceNode({ data }: NodeProps) {
  const { service, contractCount, isGroup, hasIncomingEdges, hasOutgoingEdges, hasDeployment = true } = data as unknown as ServiceNodeData

  // Determine consumer/provider roles based on edge connections
  const isConsumer = hasOutgoingEdges // Services with outgoing edges consume other services
  const isProvider = hasIncomingEdges // Services with incoming edges provide to other services

  const specType = service.specType || 'openapi'

  // Helper function to get spec type icon
  const getSpecTypeIcon = (specType: string, className: string) => {
    switch (specType.toLowerCase()) {
      case 'graphql':
        return <CubeTransparentIcon className={className} />
      case 'asyncapi':
        return <BoltIcon className={className} />
      case 'grpc':
        return <CommandLineIcon className={className} />
      default: // openapi
        return <ServerIcon className={className} />
    }
  }

  // Helper function to get spec type colors (simplified to use only spec type, not consumer/provider)
  const getSpecTypeColors = (specType: string) => {
    const colors = {
      openapi: {
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        hover: 'hover:border-blue-300',
        text: 'text-blue-600',
        badge: 'badge-blue',
        headerBg: 'bg-blue-500',
        headerText: 'text-white'
      },
      graphql: {
        bg: 'bg-purple-50',
        border: 'border-purple-200',
        hover: 'hover:border-purple-300',
        text: 'text-purple-600',
        badge: 'badge-purple',
        headerBg: 'bg-purple-500',
        headerText: 'text-white'
      },
      asyncapi: {
        bg: 'bg-orange-50',
        border: 'border-orange-200',
        hover: 'hover:border-orange-300',
        text: 'text-orange-600',
        badge: 'badge-orange',
        headerBg: 'bg-orange-500',
        headerText: 'text-white'
      },
      grpc: {
        bg: 'bg-cyan-50',
        border: 'border-cyan-200',
        hover: 'hover:border-cyan-300',
        text: 'text-cyan-600',
        badge: 'badge-cyan',
        headerBg: 'bg-cyan-500',
        headerText: 'text-white'
      }
    }

    return colors[specType.toLowerCase() as keyof typeof colors] || colors.openapi
  }

  const colors = getSpecTypeColors(specType)
  const nodeClass = `${colors.bg} ${colors.border} ${colors.hover}`
  const iconClass = colors.text
  const badgeClass = colors.badge

  return (
    <div className={`relative transition-all duration-200 ${
      isGroup
        ? 'w-full h-full overflow-hidden' // For groups, use full size and let React Flow handle background and opacity
        : `bg-white border-2 ${colors.border} ${colors.hover} rounded-xl w-[280px] h-[140px] shadow-sm hover:shadow-lg transform hover:-translate-y-0.5 overflow-hidden ${hasDeployment ? '' : 'opacity-30'}` // For regular nodes, use professional styling with opacity
    }`}>
      {isConsumer && hasOutgoingEdges && (
        <Handle
          type="source"
          position={Position.Right}
          className="w-3 h-3 bg-blue-500 border-2 border-white"
        />
      )}
      {!isConsumer && hasIncomingEdges && (
        <Handle
          type="target"
          position={Position.Left}
          className="w-3 h-3 bg-green-500 border-2 border-white"
        />
      )}


      {isGroup ? (
        /* Group containers just render the header content directly */
        <div className={`${colors.headerText} pt-3 pb-3 px-3 relative h-full flex flex-col`}>
          <Link to={`/services/${service.name}`} className="hover:opacity-90 transition-opacity">
            {/* First line: Service name with icon */}
            <div className="flex items-center gap-2 mb-2">
              <div className="text-white">
                {getSpecTypeIcon(specType, 'w-4 h-4')}
              </div>
              <span className="font-semibold text-sm">
                {service?.name ? String(service.name) : 'Unknown Service'}
              </span>
            </div>
            {/* Second line: Spec type and version badges */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 px-2 py-1 bg-white bg-opacity-20 rounded-md text-xs font-medium">
                {getSpecTypeIcon(specType, 'w-3 h-3')}
                <span>{service.specType || 'openapi'}</span>
              </div>
              {service.deployedVersion && (
                <div className="flex items-center px-2 py-1 bg-white bg-opacity-20 rounded-md text-xs font-medium">
                  v{String(service.deployedVersion)}
                </div>
              )}
            </div>
          </Link>
          {/* This creates space for the operations to be positioned within */}
          <div className="flex-1 relative mt-4"></div>
        </div>
      ) : (
        /* Redesigned layout with solid colored header */
        <div className="h-full flex flex-col">
          {/* Solid colored header section */}
          <div className={`${colors.headerBg} ${colors.headerText} pt-3 pb-3 px-3 relative`}>
            <Link
              to={`/services/${service.name}`}
              className="block group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="text-white">
                    {getSpecTypeIcon(specType, 'w-4 h-4')}
                  </div>
                  <span className="font-semibold text-sm group-hover:opacity-90 transition-opacity truncate">
                    {service?.name ? String(service.name) : 'Unknown Service'}
                  </span>
                </div>
                <div className="flex items-center gap-1 px-2 py-1 bg-white bg-opacity-20 rounded-md text-xs font-medium ml-2">
                  {getSpecTypeIcon(specType, 'w-3 h-3')}
                  <span>{service.specType || 'openapi'}</span>
                </div>
              </div>
            </Link>
          </div>

          {/* Content section */}
          <div className="flex-1 p-3 overflow-hidden">
            {service.description && (
              <div className="text-xs text-base-content/60 break-words line-clamp-3 leading-relaxed">
                {String(service.description)}
              </div>
            )}
          </div>

          {/* Footer section for deployed version */}
          {service.deployedVersion && (
            <div className="px-3 pb-3">
              <div className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs font-medium">
                v{String(service.deployedVersion)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default memo(ServiceNode)