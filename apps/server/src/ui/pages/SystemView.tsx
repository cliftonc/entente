import React, { useCallback, useMemo, useState, useEffect } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
  type NodeTypes,
  type FitViewOptions,
  MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { Contract, Service, VerificationResults } from '@entente/types'
import { useSystemView, type SystemViewFilters } from '../hooks/useSystemView'
import { useVerificationLatest } from '../hooks/useVerifications'
import { useEnvironments } from '../hooks/useDeployments'
import ServiceNode from '../components/SystemView/ServiceNode'
import OperationNode from '../components/SystemView/OperationNode'
import { getLayoutedElements } from '../utils/layoutUtils'
import SystemViewControls from '../components/SystemView/SystemViewControls'
import SystemViewLegend from '../components/SystemView/SystemViewLegend'
import EdgeDetailsModal from '../components/SystemView/EdgeDetailsModal'

interface SystemViewUIFilters {
  environment?: string
  status?: 'active' | 'archived' | 'deprecated' | 'all'
  viewMode: 'simple' | 'detailed'
}

const nodeTypes: NodeTypes = {
  service: ServiceNode,
  operation: OperationNode,
  group: ServiceNode, // Use ServiceNode for groups too
}

const fitViewOptions: FitViewOptions = {
  padding: 0.2,
  maxZoom: 1.5,
}

// Inner component that has access to useReactFlow
function ReactFlowInner({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onEdgeClick,
  nodeTypes,
  viewMode
}: {
  nodes: Node[]
  edges: Edge[]
  onNodesChange: any
  onEdgesChange: any
  onEdgeClick: any
  nodeTypes: any
  viewMode: string
}) {
  const { fitView } = useReactFlow()

  // Fit view when viewMode changes
  useEffect(() => {
    const timer = setTimeout(() => {
      fitView(fitViewOptions)
    }, 100) // Small delay to ensure layout is complete

    return () => clearTimeout(timer)
  }, [viewMode, fitView])

  return (
    <>
      <Background />
      <Controls />
      <MiniMap
        nodeStrokeWidth={3}
        nodeColor={(node) => {
          const service = (node.data as any)?.service
          if (!service) return '#94a3b8'
          return service.specType === 'graphql' ? '#a855f7' :
                 service.specType === 'asyncapi' ? '#f97316' :
                 service.specType === 'grpc' ? '#06b6d4' : '#3b82f6'
        }}
        className="bg-base-100 border border-base-300"
      />
    </>
  )
}

function SystemView() {
  const [filters, setFilters] = useState<SystemViewUIFilters>({
    environment: undefined,
    status: 'all',
    viewMode: 'simple',
  })

  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null)

  // Fetch optimized system view data
  const { data: systemViewData, isLoading, isError } = useSystemView({
    environment: filters.environment,
    status: filters.status,
  })

  // Fetch latest verification status
  const { data: verificationData, isLoading: isVerificationLoading } = useVerificationLatest()

  // Fetch all environments from the database
  const { data: environments, isLoading: isEnvironmentsLoading } = useEnvironments()

  // Extract data from the optimized response
  const services = systemViewData?.services || []
  const contracts = systemViewData?.contracts || []
  const operations = systemViewData?.operations || {}

  // Create verification status map by contractId for quick lookup
  const verificationStatusMap = useMemo(() => {
    const map = new Map<string, 'passed' | 'failed' | 'partial' | 'pending'>()
    if (verificationData) {
      verificationData.forEach(verification => {
        if (verification.contractId) {
          map.set(verification.contractId, verification.status)
        }
      })
    }
    return map
  }, [verificationData])

  // Helper function to determine verification color based on contract verification status
  const getVerificationColor = useCallback((contract: typeof contracts[0]) => {
    // Get verification status from our map first, fallback to contract property
    const verificationStatus = verificationStatusMap.get(contract.id) || contract.verificationStatus

    if (!verificationStatus) {
      return '#94a3b8' // gray - no verification data
    }

    // Map verification status to colors
    switch (verificationStatus) {
      case 'passed':
        return '#10b981' // green - all tests passed
      case 'partial':
        return '#f59e0b' // yellow - some tests passed
      case 'failed':
        return '#ef4444' // red - tests failed
      case 'pending':
        return '#6366f1' // purple - verification pending
      default:
        return '#94a3b8' // gray - unknown status
    }
  }, [verificationStatusMap])

  // Helper function to determine stroke dash pattern based on contract and verification status
  const getStrokeDashArray = useCallback((contract: typeof contracts[0]) => {
    // If contract is not active, use dashed line
    if (contract.status !== 'active') {
      return '5,3'
    }

    // Default to solid line for all active contracts (including pending)
    return '0'
  }, [verificationStatusMap])

  // Generate nodes and edges from data
  const { nodes, edges } = useMemo(() => {
    if (isLoading || !services.length) {
      return { nodes: [], edges: [] }
    }

    // Filter services based on current filters
    const filteredServices = services.filter(service => {
      // Note: Services no longer have a type field, they can act as both consumer and provider
      return true
    })

    // Filter contracts based on current filters (environment filter should NOT filter contracts)
    const filteredContracts = contracts.filter(contract => {
      if (filters.status !== 'all' && contract.status !== filters.status) {
        return false
      }
      return true
    })

    // Create nodes for services and operation nodes in detailed mode
    const allNodes: Node[] = []


    filteredServices.forEach((service, index) => {
      const serviceContracts = filteredContracts.filter(
        c => c.consumerName === service.name || c.providerName === service.name
      )

      const hasOperations = filters.viewMode === 'detailed' &&
                          serviceContracts.filter(c => c.providerName === service.name).length > 0

      // Get operations for this provider from the optimized data
      const providerOperations = hasOperations ? (operations[service.name] || []) : []
      const operationsCount = Math.min(providerOperations.length, 6) // Max 6 operations

      // Calculate dynamic height: header (90px for two-line layout) + operations (count * 50px) + padding (20px)
      const dynamicHeight = hasOperations ? 90 + (operationsCount * 50) + 20 : undefined

      // Main service node - use 'group' type for providers in detailed mode
      const serviceNode: Node = {
        id: `service-${service.id}`,
        type: hasOperations ? 'group' : 'service',
        position: {
          x: 0, // Will be calculated by dagre
          y: 0, // Will be calculated by dagre
        },
        style: hasOperations ? {
          width: 280,
          height: dynamicHeight,
          backgroundColor: service.specType === 'graphql' ? '#a855f7' :
                         service.specType === 'asyncapi' ? '#f97316' :
                         service.specType === 'grpc' ? '#06b6d4' : '#3b82f6',
          border: service.specType === 'graphql' ? '2px solid #e9d5ff' :
                  service.specType === 'asyncapi' ? '2px solid #fed7aa' :
                  service.specType === 'grpc' ? '2px solid #a5f3fc' : '2px solid #bfdbfe',
          borderRadius: '12px',
          overflow: 'hidden',
          opacity: filters.environment && !service.deployedVersion ? 0.5 : 1,
        } : {
          opacity: filters.environment && !service.deployedVersion ? 0.5 : 1,
        },
        data: {
          service,
          contractCount: serviceContracts.length,
          label: service.name, // Required for group nodes
          isGroup: hasOperations, // Flag to indicate this is a group container
          hasDeployment: filters.environment ? !!service.deployedVersion : true, // If no environment filter, assume deployed
        },
      }

      // Add parent node first (critical for React Flow)
      allNodes.push(serviceNode)

      // In detailed mode, add operation nodes inside providers
      if (hasOperations && providerOperations.length > 0) {
        providerOperations.slice(0, 6).forEach((operation, opIndex) => {
          const operationNode: Node = {
            id: `operation-${service.id}-${opIndex}`,
            type: 'operation',
            position: {
              x: 20,
              y: 90 + (opIndex * 50), // Vertical arrangement starting after taller header
            },
            style: {
              width: 240,
              height: 44,
            },
            data: {
              label: service.specType === 'graphql' ? operation.path : `${operation.method} ${operation.path}`,
              service,
              operationIndex: opIndex,
              operation, // Pass the full operation object with method/path
              hasDeployment: filters.environment ? !!service.deployedVersion : true, // Pass deployment status to operation nodes
            },
            parentId: serviceNode.id,
            extent: 'parent',
            draggable: false,
          }
          // Add child nodes after parent (order matters)
          allNodes.push(operationNode)
        })
      }
    })

    // Create edges for contracts
    const contractEdges: Edge[] = filteredContracts.map(contract => {
      const sourceNode = allNodes.find(node => {
        const data = node.data as any
        return data.service?.name === contract.consumerName
      })

      // In detailed mode, connect to operation nodes instead of service nodes
      if (filters.viewMode === 'detailed') {
        // Find the provider service node for this contract
        const providerServiceNode = allNodes.find(node => {
          const data = node.data as any
          return data.service?.name === contract.providerName
        })

        if (sourceNode && providerServiceNode) {
          // Find all operation nodes that are children of this provider
          const operationNodesForProvider = allNodes.filter(node => {
            return node.type === 'operation' && node.parentId === providerServiceNode.id
          })

          if (operationNodesForProvider.length > 0) {
            // Connect to all operations for this provider
            const verificationColor = getVerificationColor(contract)
            return operationNodesForProvider.map((operationNode, index) => ({
              id: `contract-${contract.id}-op-${index}`,
              source: sourceNode.id,
              target: operationNode.id,
              type: 'smoothstep',
              animated: false,
              markerEnd: {
                type: MarkerType.ArrowClosed,
                width: 10,
                height: 10,
                color: verificationColor,
              },
              style: {
                stroke: verificationColor,
                strokeWidth: 2,
                strokeDasharray: getStrokeDashArray(contract),
              },
              data: {
                contract,
                operationIndex: index,
                operation: operationNode.data.operation // Pass the full operation object with interactionIds
              },
            }))
          }
        }
        return []
      }

      // Simple mode - connect directly to service nodes
      const targetNode = allNodes.find(node => {
        const data = node.data as any
        return data.service?.name === contract.providerName
      })

      if (!sourceNode || !targetNode) {
        return null
      }

      const verificationColor = getVerificationColor(contract)
      return [{
        id: `contract-${contract.id}`,
        source: sourceNode.id,
        target: targetNode.id,
        type: 'smoothstep',
        animated: false,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 10,
          height: 10,
          color: verificationColor,
        },
        style: {
          stroke: verificationColor,
          strokeWidth: 2,
          strokeDasharray: getStrokeDashArray(contract),
        },
        data: { contract },
      }]
    }).filter(Boolean).flat() as Edge[]

    // Apply dagre layout ONLY to parent nodes (consumers and providers)
    // Child operation nodes should maintain their relative positioning within groups
    const parentNodes = allNodes.filter(node => !node.parentId)
    const childNodes = allNodes.filter(node => node.parentId)

    // For dagre layout, create simplified edges between parent nodes only
    const parentEdges = contractEdges.map(edge => {
      // Find the parent nodes for source and target
      const sourceParent = allNodes.find(node =>
        node.id === edge.source ||
        allNodes.some(child => child.parentId === node.id && child.id === edge.source)
      )
      const targetParent = allNodes.find(node =>
        node.id === edge.target ||
        allNodes.some(child => child.parentId === node.id && child.id === edge.target)
      )

      if (sourceParent && targetParent && !sourceParent.parentId && !targetParent.parentId) {
        return {
          ...edge,
          source: sourceParent.id,
          target: targetParent.id,
          id: `parent-${edge.id}`,
        }
      }
      return null
    }).filter(Boolean) as Edge[]

    // Remove duplicate parent edges (multiple operations might create multiple edges between same parents)
    const uniqueParentEdges = parentEdges.reduce((acc, edge) => {
      const key = `${edge.source}-${edge.target}`
      if (!acc.some(e => `${e.source}-${e.target}` === key)) {
        acc.push(edge)
      }
      return acc
    }, [] as Edge[])

    const { nodes: layoutedParentNodes } = getLayoutedElements(
      parentNodes,
      uniqueParentEdges,
      {
        direction: 'LR', // Left-to-right for horizontal layout
        nodeSpacing: 50,
        rankSpacing: 150, // More space between consumer and provider columns
      }
    )

    // Combine layouted parent nodes with unchanged child nodes
    const finalNodes = [...layoutedParentNodes, ...childNodes]

    // Update nodes with edge connection information
    const nodesWithEdgeInfo = finalNodes.map(node => {
      const hasIncomingEdges = contractEdges.some(edge => edge.target === node.id)
      const hasOutgoingEdges = contractEdges.some(edge => edge.source === node.id)

      return {
        ...node,
        data: {
          ...node.data,
          hasIncomingEdges,
          hasOutgoingEdges,
        }
      }
    })

    return {
      nodes: nodesWithEdgeInfo,
      edges: contractEdges, // Use original edges for actual connections
    }
  }, [services, contracts, operations, filters, isLoading, getVerificationColor])

  const [reactFlowNodes, setNodes, onNodesChange] = useNodesState([] as any)
  const [reactFlowEdges, setEdges, onEdgesChange] = useEdgesState([] as any)

  // Update React Flow nodes and edges when data changes
  useEffect(() => {
    setNodes(nodes as any)
    setEdges(edges as any)
  }, [JSON.stringify(nodes), JSON.stringify(edges), setNodes, setEdges])

  const handleFilterChange = useCallback((newFilters: Partial<SystemViewFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
  }, [])

  const onEdgeClick = useCallback((_event: React.MouseEvent, edge: Edge) => {
    setSelectedEdge(edge)
  }, [])

  if (isLoading || isVerificationLoading || isEnvironmentsLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="loading loading-spinner loading-lg"></div>
          <p className="text-base-content/70">Loading system view...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with title and controls */}
      <div className="flex items-start justify-between">
        <h1 className="text-2xl font-bold text-base-content">System View</h1>
        <div className="flex items-start gap-4">
          <SystemViewControls
            filters={filters}
            onFilterChange={handleFilterChange}
            environments={environments || []}
          />
          <SystemViewLegend />
        </div>
      </div>

      {/* React Flow container */}
      <div className="w-full bg-white rounded-lg shadow border border-base-300" style={{ height: '85vh' }}>
        <ReactFlow
          nodes={reactFlowNodes}
          edges={reactFlowEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onEdgeClick={onEdgeClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={fitViewOptions}
          attributionPosition="bottom-left"
          nodesDraggable={true}
          nodesConnectable={false}
          elementsSelectable={true}
        >
          <ReactFlowInner
            nodes={reactFlowNodes}
            edges={reactFlowEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onEdgeClick={onEdgeClick}
            nodeTypes={nodeTypes}
            viewMode={filters.viewMode}
          />
        </ReactFlow>
      </div>

      {/* Edge Details Modal */}
      <EdgeDetailsModal
        edge={selectedEdge}
        onClose={() => setSelectedEdge(null)}
        viewMode={filters.viewMode}
      />
    </div>
  )
}

export default SystemView