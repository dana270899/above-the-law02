import type { GameFlowEdge, GameFlowNode } from '@/types/editor'

export interface PlannedFlowNode {
  nodeId: string
  /** Number of future player-visible stops between a root and this node. */
  distance: number
}

export interface FlowPreloadPlanOptions {
  nodes: GameFlowNode[]
  edges: GameFlowEdge[]
  currentNodeId: string
  /** Other currently interactive graph roots, such as an open case while
   * the main walker is paused on a tutorial message. */
  additionalRootIds?: readonly string[]
  /** How many future player-visible stops to inspect. Defaults to three. */
  lookaheadStops?: number
  /** Safety limit for malformed or unusually broad graphs. Defaults to 100. */
  maxNodes?: number
}

type TraversalMode = 'main' | 'side'

interface QueueEntry {
  nodeId: string
  distance: number
  mode: TraversalMode
  sequence: number
}

const DEFAULT_LOOKAHEAD_STOPS = 3
const DEFAULT_MAX_NODES = 100

/** Nodes that create a new player-facing stop. All other graph nodes are
 * transparent for lookahead purposes, even though they remain in the plan so
 * callers can inspect them or attach future asset metadata to them. */
function isVisibleStop(node: GameFlowNode): boolean {
  if (node.type === 'result') return node.data.resultType === 'win'
  return node.type === 'login'
    || node.type === 'message'
    || node.type === 'case'
    || node.type === 'operation'
    || node.type === 'miniGame'
    || node.type === 'ranking'
}

function normalizedWholeNumber(value: number | undefined, fallback: number): number {
  if (value == null || !Number.isFinite(value)) return fallback
  return Math.max(0, Math.floor(value))
}

/**
 * Plans graph nodes whose assets may be needed soon.
 *
 * The traversal deliberately mirrors the runtime walker instead of deriving a
 * sequence from node ids, case order, or editor positions:
 *
 * - Case and Second Arrest nodes expose all non-trigger decision branches.
 * - Every other main-flow node follows the first non-trigger edge, matching
 *   `useGameFlow` / `GamePage`.
 * - Case trigger branches are walked separately and may contain only the
 *   message/points chain that the trigger queue supports.
 * - A `newCase` message also reveals its target case immediately, even when
 *   tutorial messages sit between it and that case in the main graph.
 * - Transparent nodes do not consume a visible-stop unit.
 *
 * Results are unique by node id and use the shortest visible-stop distance
 * found from any root. Sorting by distance and then id keeps the result stable
 * when the editor serializes nodes or branch edges in a different order.
 */
export function planFlowPreloadNodes({
  nodes,
  edges,
  currentNodeId,
  additionalRootIds = [],
  lookaheadStops: requestedLookahead,
  maxNodes: requestedMaxNodes,
}: FlowPreloadPlanOptions): PlannedFlowNode[] {
  const lookaheadStops = normalizedWholeNumber(
    requestedLookahead,
    DEFAULT_LOOKAHEAD_STOPS,
  )
  const maxNodes = normalizedWholeNumber(requestedMaxNodes, DEFAULT_MAX_NODES)
  if (maxNodes === 0) return []

  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  if (!nodeById.has(currentNodeId)) return []

  const outgoingBySource = new Map<string, GameFlowEdge[]>()
  for (const edge of edges) {
    const outgoing = outgoingBySource.get(edge.source)
    if (outgoing) outgoing.push(edge)
    else outgoingBySource.set(edge.source, [edge])
  }

  const plannedDistance = new Map<string, number>()
  const bestStateDistance = new Map<string, number>()
  const queue: QueueEntry[] = []
  let sequence = 0

  const enqueue = (
    nodeId: string,
    distance: number,
    mode: TraversalMode,
  ) => {
    if (distance > lookaheadStops || !nodeById.has(nodeId)) return

    const previousPlannedDistance = plannedDistance.get(nodeId)
    if (previousPlannedDistance == null) {
      if (plannedDistance.size >= maxNodes) return
      plannedDistance.set(nodeId, distance)
    } else if (distance < previousPlannedDistance) {
      plannedDistance.set(nodeId, distance)
    }

    const stateKey = `${mode}:${nodeId}`
    const previousStateDistance = bestStateDistance.get(stateKey)
    if (previousStateDistance != null && previousStateDistance <= distance) return
    bestStateDistance.set(stateKey, distance)
    queue.push({ nodeId, distance, mode, sequence: sequence++ })
  }

  enqueue(currentNodeId, 0, 'main')
  for (const rootId of additionalRootIds) enqueue(rootId, 0, 'main')

  const enqueueTarget = (
    targetId: string,
    sourceDistance: number,
    mode: TraversalMode,
  ) => {
    const target = nodeById.get(targetId)
    if (!target) return
    const targetDistance = sourceDistance + (isVisibleStop(target) ? 1 : 0)
    enqueue(targetId, targetDistance, mode)
  }

  while (queue.length > 0) {
    // This is a tiny 0/1-weight graph. Taking the nearest queued state first
    // makes maxNodes deterministic and ensures shortest distances settle
    // before broader, lower-priority branches.
    let nextIndex = 0
    for (let index = 1; index < queue.length; index += 1) {
      const candidate = queue[index]
      const selected = queue[nextIndex]
      if (
        candidate.distance < selected.distance
        || (
          candidate.distance === selected.distance
          && candidate.sequence < selected.sequence
        )
      ) {
        nextIndex = index
      }
    }

    const [entry] = queue.splice(nextIndex, 1)
    if (bestStateDistance.get(`${entry.mode}:${entry.nodeId}`) !== entry.distance) {
      continue
    }

    const node = nodeById.get(entry.nodeId)
    if (!node) continue
    const outgoing = outgoingBySource.get(node.id) ?? []

    if (entry.mode === 'side') {
      // Trigger nodes fan out to every supported queue start. Once inside a
      // side queue, the runtime follows only the first edge and continues only
      // through Message / Points nodes. It never moves the main walker.
      if (node.type === 'trigger') {
        for (const edge of outgoing) {
          const target = nodeById.get(edge.target)
          if (target?.type === 'message' || target?.type === 'points') {
            enqueueTarget(target.id, entry.distance, 'side')
          }
        }
        continue
      }

      if (node.type !== 'message' && node.type !== 'points') continue
      if (node.type === 'message' && node.data.buttonLinkType === 'url') continue

      const nextEdge = outgoing.find((edge) => edge.sourceHandle !== 'trigger')
      const target = nextEdge ? nodeById.get(nextEdge.target) : null
      if (target?.type === 'message' || target?.type === 'points') {
        enqueueTarget(target.id, entry.distance, 'side')
      }
      continue
    }

    if (node.type === 'message') {
      if (node.data.buttonLinkType === 'url') continue

      // `newCase` opens the named case window before the main walker
      // necessarily reaches that Case node.
      if (node.data.buttonLinkType === 'newCase' && node.data.targetCaseId) {
        const targetCase = nodes.find(
          (candidate) => candidate.type === 'case'
            && candidate.data.caseId === node.data.targetCaseId,
        )
        if (targetCase) enqueueTarget(targetCase.id, entry.distance, 'main')
      }
    }

    if (node.type === 'case') {
      for (const edge of outgoing) {
        if (edge.sourceHandle === 'trigger') {
          // Direct Case -> Message trigger wiring is ignored by GamePage; a
          // valid side branch always starts at a Trigger node.
          if (nodeById.get(edge.target)?.type === 'trigger') {
            enqueueTarget(edge.target, entry.distance, 'side')
          }
          continue
        }
        enqueueTarget(edge.target, entry.distance, 'main')
      }
      continue
    }

    if (node.type === 'secondArrest') {
      for (const edge of outgoing) {
        if (edge.sourceHandle !== 'trigger') {
          enqueueTarget(edge.target, entry.distance, 'main')
        }
      }
      continue
    }

    const nextEdge = outgoing.find((edge) => edge.sourceHandle !== 'trigger')
    if (nextEdge) enqueueTarget(nextEdge.target, entry.distance, 'main')
  }

  return [...plannedDistance.entries()]
    .map(([nodeId, distance]) => ({ nodeId, distance }))
    .sort((a, b) => a.distance - b.distance || a.nodeId.localeCompare(b.nodeId))
}
