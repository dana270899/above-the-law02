import type { GameFlowEdge, GameFlowNode } from '@/types/editor'

/**
 * Returns true when the active decision path reaches Ranking without first
 * reaching a node that owns or records another case outcome.
 *
 * Messages, mini-games, Points nodes, and other transparent flow steps may be
 * inserted between the decision and Ranking without changing this result.
 */
export function pathReachesRankingWithoutResult(
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
    if (node.type === 'ranking') return true
    if (
      node.type === 'result'
      || node.type === 'case'
      || node.type === 'operation'
      || node.type === 'secondArrest'
      || node.type === 'login'
    ) return false

    currentId = edges.find(
      (edge) => edge.source === currentId && edge.sourceHandle !== 'trigger',
    )?.target ?? null
  }

  return false
}
