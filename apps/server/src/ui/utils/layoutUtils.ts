import dagre from 'dagre'
import type { Node, Edge } from '@xyflow/react'

export interface LayoutOptions {
  direction?: 'TB' | 'LR' | 'BT' | 'RL'
  nodeSpacing?: number
  rankSpacing?: number
}

export const getLayoutedElements = (
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions = {}
): { nodes: Node[]; edges: Edge[] } => {
  const {
    direction = 'LR', // Left-to-right for horizontal layout
    nodeSpacing = 50,
    rankSpacing = 100
  } = options

  const isHorizontal = direction === 'LR' || direction === 'RL'

  // Create dagre graph
  const dagreGraph = new dagre.graphlib.Graph()
  dagreGraph.setDefaultEdgeLabel(() => ({}))

  // Configure layout
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: nodeSpacing,
    ranksep: rankSpacing,
    marginx: 20,
    marginy: 20,
  })

  // Set node dimensions for dagre
  nodes.forEach((node) => {
    // Determine node size based on type and data
    let nodeWidth = 200  // Default width for service nodes
    let nodeHeight = 120 // Default height for service nodes

    if (node.type === 'group') {
      // Group nodes (providers in detailed mode) are larger
      nodeWidth = 280
      // Use dynamic height if available from style, otherwise calculate
      nodeHeight = (node.style?.height as number) || 280
    } else if (node.type === 'operation') {
      // Operation nodes are smaller
      nodeWidth = 240
      nodeHeight = 28
    }

    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight })
  })

  // Add edges to dagre
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target)
  })

  // Calculate layout
  dagre.layout(dagreGraph)

  // Apply calculated positions to nodes
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id)
    if (!nodeWithPosition) return node

    // Get node dimensions
    const { width, height } = nodeWithPosition

    return {
      ...node,
      // Set handle positions based on layout direction
      targetPosition: isHorizontal ? 'left' : 'top',
      sourcePosition: isHorizontal ? 'right' : 'bottom',
      // Adjust position to React Flow's coordinate system (top-left anchor)
      position: {
        x: nodeWithPosition.x - width / 2,
        y: nodeWithPosition.y - height / 2,
      },
    } as Node
  })

  return {
    nodes: layoutedNodes,
    edges: edges.map(edge => ({
      ...edge,
      // Update edge types for better routing in horizontal layout
      type: 'smoothstep',
    })),
  }
}

export const getNodeDimensions = (node: Node): { width: number; height: number } => {
  if (node.type === 'group') {
    return {
      width: 280,
      height: (node.style?.height as number) || 280
    }
  } else if (node.type === 'operation') {
    return {
      width: 240,
      height: 28
    }
  } else {
    return {
      width: 200,
      height: 120
    }
  }
}