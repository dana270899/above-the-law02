import type { GameFlowEdge, GameFlowNode } from '@/types/editor'

/**
 * Whether a decision branch delegates scoring to a connected Points node.
 * Only transparent/message steps are traversed: once gameplay reaches a
 * different stopping node, that later part of the game is a new scoring
 * boundary and must not change how the original decision is scored.
 */
export function pathContainsPointsNode(
  startId: string | null,
  nodes: GameFlowNode[],
  edges: GameFlowEdge[],
): boolean {
  const visited = new Set<string>()
  let currentId = startId

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId)
    const node = nodes.find((candidate) => candidate.id === currentId)
    if (!node) return false
    if (node.type === 'points') return true
    if (node.type !== 'message') return false
    currentId = edges.find(
      (edge) => edge.source === currentId && edge.sourceHandle !== 'trigger',
    )?.target ?? null
  }

  return false
}
