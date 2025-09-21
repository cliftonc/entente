import { memo, useState } from 'react'
import {
  ServerIcon,
  CubeTransparentIcon,
  BoltIcon,
  CommandLineIcon,
  ArrowDownTrayIcon,
  MagnifyingGlassIcon,
  PaperAirplaneIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline'

function SystemViewLegend() {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="relative">
      <div className="bg-base-100 rounded-lg shadow-lg border border-base-300 overflow-hidden">
      {/* Header */}
      <button
        type="button"
        className="w-full px-4 py-2 text-left flex items-center justify-between hover:bg-base-200 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="text-sm font-medium text-base-content">Legend</span>
        <svg
          className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      </div>

      {/* Content - positioned absolutely to overlay */}
      {isExpanded && (
        <div className="absolute top-full right-0 mt-1 bg-base-100 rounded-lg shadow-lg border border-base-300 p-4 space-y-4 min-w-80 z-50">
          {/* Spec Types */}
          <div>
            <h4 className="text-xs font-medium text-base-content/80 mb-2 uppercase tracking-wide">
              Specification Types
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-blue-50 border border-blue-200 rounded flex items-center justify-center">
                  <ServerIcon className="w-3 h-3 text-blue-600" />
                </div>
                <span className="text-xs text-base-content">OpenAPI</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-purple-50 border border-purple-200 rounded flex items-center justify-center">
                  <CubeTransparentIcon className="w-3 h-3 text-purple-600" />
                </div>
                <span className="text-xs text-base-content">GraphQL</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-orange-50 border border-orange-200 rounded flex items-center justify-center">
                  <BoltIcon className="w-3 h-3 text-orange-600" />
                </div>
                <span className="text-xs text-base-content">AsyncAPI</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-cyan-50 border border-cyan-200 rounded flex items-center justify-center">
                  <CommandLineIcon className="w-3 h-3 text-cyan-600" />
                </div>
                <span className="text-xs text-base-content">gRPC</span>
              </div>
            </div>
          </div>

          {/* Service Types */}
          <div>
            <h4 className="text-xs font-medium text-base-content/80 mb-2 uppercase tracking-wide">
              Service Types
            </h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-4 h-3 bg-blue-50 border border-blue-200 rounded"></div>
                <span className="text-xs text-base-content">Consumer</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-3 bg-green-50 border border-green-200 rounded"></div>
                <span className="text-xs text-base-content">Provider</span>
              </div>
            </div>
          </div>

          {/* Contract Status */}
          <div>
            <h4 className="text-xs font-medium text-base-content/80 mb-2 uppercase tracking-wide">
              Contract Status
            </h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex items-center">
                  <div className="w-4 h-1 bg-green-500 rounded-l"></div>
                  <div className="w-0 h-0 border-l-4 border-l-green-500 border-t-2 border-b-2 border-t-transparent border-b-transparent"></div>
                </div>
                <span className="text-xs text-base-content">All verifications passing</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center">
                  <div className="w-4 h-1 bg-yellow-500 rounded-l"></div>
                  <div className="w-0 h-0 border-l-4 border-l-yellow-500 border-t-2 border-b-2 border-t-transparent border-b-transparent"></div>
                </div>
                <span className="text-xs text-base-content">Some verifications failing</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center">
                  <div className="w-4 h-1 bg-red-500 rounded-l"></div>
                  <div className="w-0 h-0 border-l-4 border-l-red-500 border-t-2 border-b-2 border-t-transparent border-b-transparent"></div>
                </div>
                <span className="text-xs text-base-content">All verifications failing</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center">
                  <div className="w-4 h-1 bg-indigo-500 rounded-l"></div>
                  <div className="w-0 h-0 border-l-4 border-l-indigo-500 border-t-2 border-b-2 border-t-transparent border-b-transparent"></div>
                </div>
                <span className="text-xs text-base-content">Verification pending</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center">
                  <div className="w-4 h-1 bg-gray-400 rounded-l"></div>
                  <div className="w-0 h-0 border-l-4 border-l-gray-400 border-t-2 border-b-2 border-t-transparent border-b-transparent"></div>
                </div>
                <span className="text-xs text-base-content">No verifications</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center">
                  <div className="w-4 h-1 bg-gray-400 rounded-l border-dashed border border-gray-400"></div>
                  <div className="w-0 h-0 border-l-4 border-l-gray-400 border-t-2 border-b-2 border-t-transparent border-b-transparent"></div>
                </div>
                <span className="text-xs text-base-content">Inactive contract</span>
              </div>
            </div>
          </div>

          {/* Operation Types */}
          <div>
            <h4 className="text-xs font-medium text-base-content/80 mb-2 uppercase tracking-wide">
              Operation Types
            </h4>
            <div className="grid grid-cols-2 gap-1 text-xs">
              <div className="flex items-center gap-1">
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-green-100 text-green-800 border border-green-200">
                  <ArrowDownTrayIcon className="w-2 h-2" />
                  GET
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200">
                  <MagnifyingGlassIcon className="w-2 h-2" />
                  Query
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-orange-100 text-orange-800 border border-orange-200">
                  <PaperAirplaneIcon className="w-2 h-2" />
                  Pub
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-800 border border-cyan-200">
                  <ArrowRightIcon className="w-2 h-2" />
                  RPC
                </span>
              </div>
            </div>
          </div>

          {/* Interaction */}
          <div>
            <h4 className="text-xs font-medium text-base-content/80 mb-2 uppercase tracking-wide">
              Interaction
            </h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-gray-100 border border-gray-300 rounded"></div>
                <span className="text-xs text-base-content">Click edges for contract details</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="badge badge-neutral badge-xs">12</div>
                <span className="text-xs text-base-content">Contract count</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default memo(SystemViewLegend)