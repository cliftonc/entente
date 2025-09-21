import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import {
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  PencilIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  BellIcon,
  PaperAirplaneIcon,
  InboxArrowDownIcon,
  ArrowRightIcon,
  ArrowsRightLeftIcon,
} from '@heroicons/react/24/outline'

function OperationNode({ data }: NodeProps) {
  const { label, hasIncomingEdges, service, operation, hasDeployment = true } = data as any
  const specType = service?.specType || 'openapi'

  // Helper function to parse operation for different spec types
  const parseOperation = (label: string, specType: string, operation?: any) => {
    // If we have the operation object from the optimized API, use it directly
    if (operation && operation.method && operation.path) {
      // For GraphQL, map our custom method names to display names
      if (specType.toLowerCase() === 'graphql') {
        const methodMap: Record<string, string> = {
          'QUERY': 'Query',
          'MUTATION': 'Mutation',
          'SUBSCRIPTION': 'Subscription'
        }
        return {
          type: methodMap[operation.method.toUpperCase()] || 'Query',
          name: operation.path.replace(/^(Query|Mutation|Subscription)\./, '')
        }
      }
      return { method: operation.method.toUpperCase(), path: operation.path }
    }

    // Fallback to parsing the label string for backward compatibility
    switch (specType.toLowerCase()) {
      case 'openapi':
        // Parse "GET /api/users" format
        const match = label.match(/^(\w+)\s+(.+)$/)
        if (match) {
          return { method: match[1], path: match[2] }
        }
        return { method: 'GET', path: label }

      case 'graphql':
        // Parse GraphQL operations from label
        if (label.startsWith('Query.')) {
          return { type: 'Query', name: label.replace('Query.', '') }
        } else if (label.startsWith('Mutation.')) {
          return { type: 'Mutation', name: label.replace('Mutation.', '') }
        } else if (label.startsWith('Subscription.')) {
          return { type: 'Subscription', name: label.replace('Subscription.', '') }
        }
        return { type: 'Query', name: label }

      case 'asyncapi':
        // Parse async operations
        if (label.toLowerCase().includes('publish')) {
          return { type: 'Publish', channel: label.replace(/publish\s*/i, '') }
        } else if (label.toLowerCase().includes('subscribe')) {
          return { type: 'Subscribe', channel: label.replace(/subscribe\s*/i, '') }
        }
        return { type: 'Subscribe', channel: label }

      case 'grpc':
        // Parse gRPC operations
        if (label.includes('.')) {
          const parts = label.split('.')
          return { service: parts[0], method: parts[1] || 'Method' }
        }
        return { service: 'Service', method: label }

      default:
        return { method: 'GET', path: label }
    }
  }

  // Helper function to get method/type badge styling
  const getBadgeStyle = (method: string, specType: string) => {
    const styles = {
      openapi: {
        GET: 'bg-green-100 text-green-800 border-green-200',
        POST: 'bg-blue-100 text-blue-800 border-blue-200',
        PUT: 'bg-orange-100 text-orange-800 border-orange-200',
        DELETE: 'bg-red-100 text-red-800 border-red-200',
        PATCH: 'bg-purple-100 text-purple-800 border-purple-200',
      },
      graphql: {
        Query: 'bg-purple-100 text-purple-800 border-purple-200',
        Mutation: 'bg-pink-100 text-pink-800 border-pink-200',
        Subscription: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      },
      asyncapi: {
        Publish: 'bg-orange-100 text-orange-800 border-orange-200',
        Subscribe: 'bg-red-100 text-red-800 border-red-200',
      },
      grpc: {
        Unary: 'bg-cyan-100 text-cyan-800 border-cyan-200',
        Stream: 'bg-teal-100 text-teal-800 border-teal-200',
      }
    }

    const specStyles = styles[specType.toLowerCase() as keyof typeof styles] || styles.openapi
    return specStyles[method as keyof typeof specStyles] || 'bg-gray-100 text-gray-800 border-gray-200'
  }

  // Helper function to get method/type icon
  const getMethodIcon = (method: string, specType: string) => {
    switch (specType.toLowerCase()) {
      case 'openapi':
        switch (method) {
          case 'GET': return <ArrowDownTrayIcon className="w-3 h-3" />
          case 'POST': return <ArrowUpTrayIcon className="w-3 h-3" />
          case 'PUT': return <PencilIcon className="w-3 h-3" />
          case 'DELETE': return <TrashIcon className="w-3 h-3" />
          case 'PATCH': return <PencilIcon className="w-3 h-3" />
          default: return <ArrowDownTrayIcon className="w-3 h-3" />
        }
      case 'graphql':
        switch (method) {
          case 'Query': return <MagnifyingGlassIcon className="w-3 h-3" />
          case 'Mutation': return <PencilSquareIcon className="w-3 h-3" />
          case 'Subscription': return <BellIcon className="w-3 h-3" />
          default: return <MagnifyingGlassIcon className="w-3 h-3" />
        }
      case 'asyncapi':
        switch (method) {
          case 'Publish': return <PaperAirplaneIcon className="w-3 h-3" />
          case 'Subscribe': return <InboxArrowDownIcon className="w-3 h-3" />
          default: return <InboxArrowDownIcon className="w-3 h-3" />
        }
      case 'grpc':
        return <ArrowRightIcon className="w-3 h-3" />
      default:
        return <ArrowDownTrayIcon className="w-3 h-3" />
    }
  }

  const parsedOperation = parseOperation(label, specType, operation)

  return (
    <div className={`relative bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs shadow-sm hover:shadow-md transition-all duration-200 transform hover:-translate-y-0.5 min-w-[180px] ${hasDeployment ? '' : 'opacity-30'}`}>
      {/* Handle for incoming connections */}
      {hasIncomingEdges && (
        <Handle
          type="target"
          position={Position.Left}
          className="w-3 h-3 bg-blue-500 border-2 border-white"
        />
      )}

      {/* Operation content */}
      <div className="flex items-center gap-2">
        {/* Method/Type badge */}
        {specType.toLowerCase() === 'openapi' && parsedOperation.method && (
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border ${getBadgeStyle(parsedOperation.method, specType)}`}>
            {getMethodIcon(parsedOperation.method, specType)}
            {parsedOperation.method}
          </span>
        )}

        {specType.toLowerCase() === 'graphql' && parsedOperation.type && (
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border ${getBadgeStyle(parsedOperation.type, specType)}`}>
            {getMethodIcon(parsedOperation.type, specType)}
            {parsedOperation.type}
          </span>
        )}

        {specType.toLowerCase() === 'asyncapi' && parsedOperation.type && (
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border ${getBadgeStyle(parsedOperation.type, specType)}`}>
            {getMethodIcon(parsedOperation.type, specType)}
            {parsedOperation.type}
          </span>
        )}

        {specType.toLowerCase() === 'grpc' && (
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border ${getBadgeStyle('Unary', specType)}`}>
            {getMethodIcon('Unary', specType)}
            RPC
          </span>
        )}

        {/* Path/Name */}
        <div className="flex-1 min-w-0">
          {specType.toLowerCase() === 'openapi' && (
            <div className="font-mono text-gray-700 truncate">{parsedOperation.path}</div>
          )}

          {specType.toLowerCase() === 'graphql' && (
            <div className="font-medium text-gray-700 truncate">{parsedOperation.name}</div>
          )}

          {specType.toLowerCase() === 'asyncapi' && (
            <div className="font-mono text-gray-700 truncate">{parsedOperation.channel}</div>
          )}

          {specType.toLowerCase() === 'grpc' && (
            <div className="font-mono text-gray-700 truncate">
              {parsedOperation.service}.{parsedOperation.method}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default memo(OperationNode)