import type {
  CaseFlowNode,
  GameFlowEdge,
  GameFlowNode,
  ResultFlowNode,
} from '@/types/editor'

export const CASE_NUMBER_PREFIX = '86'

/** Public case number. The authored order is its only variable part. */
export function caseNumberForOrder(order: number): string {
  const safeOrder = Number.isInteger(order) && order >= 1 ? order : 1
  return `${CASE_NUMBER_PREFIX}${safeOrder}`
}

function orderedCases(nodes: GameFlowNode[]): CaseFlowNode[] {
  const graphIndex = new Map(nodes.map((node, index) => [node.id, index]))
  return nodes
    .filter((node): node is CaseFlowNode => node.type === 'case')
    .sort((a, b) => {
      const aOrder = Number.isInteger(a.data.order) && a.data.order >= 1
        ? a.data.order
        : Number.POSITIVE_INFINITY
      const bOrder = Number.isInteger(b.data.order) && b.data.order >= 1
        ? b.data.order
        : Number.POSITIVE_INFINITY
      return aOrder - bOrder
        || (graphIndex.get(a.id) ?? 0) - (graphIndex.get(b.id) ?? 0)
    })
}

/**
 * Find the nearest case upstream of a flow node. Result nodes use this
 * instead of their old manually entered caseId, which could mark a future
 * tab solved and unlock it before the player reached it.
 */
export function findOwningCaseNode(
  nodeId: string,
  nodes: GameFlowNode[],
  edges: GameFlowEdge[],
): CaseFlowNode | null {
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const incomingByTarget = new Map<string, GameFlowEdge[]>()
  for (const edge of edges) {
    // Trigger branches are side effects, not part of the playable walker.
    if (edge.sourceHandle === 'trigger') continue
    const incoming = incomingByTarget.get(edge.target)
    if (incoming) incoming.push(edge)
    else incomingByTarget.set(edge.target, [edge])
  }

  const frontier = [nodeId]
  const visited = new Set(frontier)
  const upstreamCases = new Map<string, CaseFlowNode>()
  while (frontier.length > 0) {
    const targetId = frontier.shift()!
    for (const edge of incomingByTarget.get(targetId) ?? []) {
      const source = nodeById.get(edge.source)
      if (!source) continue
      // Stop this path at its first case. Continuing past it could find an
      // earlier case from the previous round and create a false ambiguity.
      if (source.type === 'case') {
        upstreamCases.set(source.id, source as CaseFlowNode)
        continue
      }
      if (visited.has(source.id)) continue
      visited.add(source.id)
      frontier.push(source.id)
    }
  }

  return upstreamCases.size === 1
    ? upstreamCases.values().next().value ?? null
    : null
}

function remapCaseReferences(
  node: GameFlowNode,
  caseIdMap: ReadonlyMap<string, string>,
): GameFlowNode {
  const data = node.data as Record<string, unknown>
  let nextData = data
  const remap = (field: 'caseId' | 'targetCaseId') => {
    const current = data[field]
    if (typeof current !== 'string') return
    const replacement = caseIdMap.get(current)
    if (!replacement || replacement === current) return
    if (nextData === data) nextData = { ...data }
    nextData[field] = replacement
  }
  remap('caseId')
  remap('targetCaseId')
  return nextData === data ? node : { ...node, data: nextData } as GameFlowNode
}

function applyCaseSequence(
  nodes: GameFlowNode[],
  edges: GameFlowEdge[],
  sequence: CaseFlowNode[],
): GameFlowNode[] {
  const oldCaseIdCounts = new Map<string, number>()
  for (const node of sequence) {
    oldCaseIdCounts.set(node.data.caseId, (oldCaseIdCounts.get(node.data.caseId) ?? 0) + 1)
  }

  const assignmentByNodeId = new Map<
    string,
    { order: number; caseId: string; title: string }
  >()
  const caseIdMap = new Map<string, string>()
  sequence.forEach((node, index) => {
    const order = index + 1
    const caseId = caseNumberForOrder(order)
    assignmentByNodeId.set(node.id, { order, caseId, title: `Case ${order}` })
    if (oldCaseIdCounts.get(node.data.caseId) === 1) {
      caseIdMap.set(node.data.caseId, caseId)
    }
  })

  let nextNodes = nodes.map((node) => {
    if (node.type !== 'case') return remapCaseReferences(node, caseIdMap)
    const assignment = assignmentByNodeId.get(node.id)
    if (!assignment) return node
    const caseNode = node as CaseFlowNode
    return {
      ...caseNode,
      data: {
        ...caseNode.data,
        ...assignment,
        window: caseNode.data.window
          ? { ...caseNode.data.window, caseId: assignment.caseId }
          : undefined,
      },
    }
  })

  // Repair result ownership from topology after identities are updated.
  // This also migrates graphs whose case nodes were manually renumbered
  // without updating their downstream result nodes.
  nextNodes = nextNodes.map((node) => {
    if (node.type !== 'result') return node
    const owner = findOwningCaseNode(node.id, nextNodes, edges)
    if (!owner || node.data.caseId === owner.data.caseId) return node
    return {
      ...node,
      data: { ...(node as ResultFlowNode).data, caseId: owner.data.caseId },
    } as ResultFlowNode
  })

  return nextNodes
}

/** Repair legacy case metadata and guarantee positions 1..N exactly once. */
export function normalizeCaseOrder(
  nodes: GameFlowNode[],
  edges: GameFlowEdge[],
): GameFlowNode[] {
  return applyCaseSequence(nodes, edges, orderedCases(nodes))
}

/** Move one case to a position and shift every intervening case. */
export function moveCaseToOrder(
  nodes: GameFlowNode[],
  edges: GameFlowEdge[],
  caseNodeId: string,
  requestedOrder: number,
): GameFlowNode[] {
  const sequence = orderedCases(nodes)
  const currentIndex = sequence.findIndex((node) => node.id === caseNodeId)
  if (currentIndex < 0 || !Number.isInteger(requestedOrder)) return nodes

  const [moving] = sequence.splice(currentIndex, 1)
  const targetIndex = Math.max(0, Math.min(sequence.length, requestedOrder - 1))
  sequence.splice(targetIndex, 0, moving)
  return applyCaseSequence(nodes, edges, sequence)
}
