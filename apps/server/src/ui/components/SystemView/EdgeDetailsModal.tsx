import { memo } from 'react'
import { type Edge } from '@xyflow/react'
import type { Contract, SystemViewOperation } from '@entente/types'
import { Link } from 'react-router-dom'
import { XMarkIcon, CheckCircleIcon, ExclamationCircleIcon, ClockIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline'

interface EdgeDetailsModalProps {
  edge: Edge | null
  onClose: () => void
  viewMode: 'simple' | 'detailed'
}

function EdgeDetailsModal({ edge, onClose, viewMode }: EdgeDetailsModalProps) {
  if (!edge) return null

  const contract = edge.data?.contract as Contract
  const operationIndex = edge.data?.operationIndex
  const operation = edge.data?.operation as SystemViewOperation | undefined
  const isInteraction = viewMode === 'detailed' && operationIndex !== undefined

  if (!contract) return null

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircleIcon className="w-4 h-4 text-green-600" />
      case 'deprecated':
        return <ExclamationCircleIcon className="w-4 h-4 text-yellow-600" />
      default:
        return <ClockIcon className="w-4 h-4 text-gray-600" />
    }
  }

  const getVerificationStatusText = (color: string) => {
    switch (color) {
      case '#10b981': return 'Passed'
      case '#f59e0b': return 'Partial'
      case '#ef4444': return 'Failed'
      case '#6366f1': return 'Pending'
      default: return 'Unknown'
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            {isInteraction ? 'Interaction' : 'Contract'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {/* Basic Info */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Consumer:</span>
              <span className="font-medium text-sm">{contract.consumerName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Provider:</span>
              <span className="font-medium text-sm">{contract.providerName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Environment:</span>
              <span className="font-medium text-sm">{contract.environment}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Status:</span>
              <div className="flex items-center gap-1">
                {getStatusIcon(contract.status)}
                <span className="font-medium text-sm capitalize">{contract.status}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Verification:</span>
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: edge.style?.stroke || '#94a3b8' }}
                ></div>
                <span className="font-medium text-sm">
                  {getVerificationStatusText(edge.style?.stroke as string)}
                </span>
              </div>
            </div>
            {isInteraction && operation && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Operation:</span>
                  <span className="font-medium text-sm">{operation.method} {operation.path}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Interactions:</span>
                  <span className="font-medium text-sm">{operation.interactionIds?.length || 0}</span>
                </div>
              </>
            )}
          </div>

          {/* Interaction Buttons */}
          {isInteraction && operation?.interactionIds && operation.interactionIds.length > 0 && (
            <div className="border-t border-gray-200 p-4">
              <h4 className="text-sm font-medium text-gray-900 mb-2">
                Recorded Interactions ({operation.interactionIds.length})
              </h4>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                {operation.interactionIds.slice(0, 10).map((interactionId: string, index: number) => (
                  <Link
                    key={interactionId}
                    to={`/interactions/${interactionId}`}
                    className="inline-flex items-center px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors"
                    onClick={onClose}
                  >
                    #{index + 1}
                  </Link>
                ))}
                {operation.interactionIds.length > 10 && (
                  <span className="inline-flex items-center px-2 py-1 text-xs text-gray-500">
                    +{operation.interactionIds.length - 10} more
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between p-4 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            Close
          </button>
          <Link
            to={`/contracts/${contract.id}`}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
            onClick={onClose}
          >
            View Contract
            <ArrowTopRightOnSquareIcon className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  )
}

export default memo(EdgeDetailsModal)