import { useEffect, useMemo } from 'react'
import type { GameFlowEdge, GameFlowNode } from '@/types/editor'
import { planFlowPreloadNodes } from '@/lib/flowPreload'
import {
  assetsForFlowNode,
  globalFlowAssets,
  type GamePreloadAsset,
} from '@/lib/gamePreloadAssets'
import { gameAssetPreloader } from '@/lib/gameAssetPreloader'

interface FlowAssetPreloaderOptions {
  nodes: GameFlowNode[]
  edges: GameFlowEdge[]
  currentNodeId: string | null
  additionalRootIds?: readonly string[]
}

type NavigatorWithConnection = Navigator & {
  connection?: {
    saveData?: boolean
    effectiveType?: string
  }
}

function shouldReduceSpeculation(): boolean {
  if (typeof navigator === 'undefined') return false
  const connection = (navigator as NavigatorWithConnection).connection
  return connection?.saveData === true || /(?:^|-)2g$/.test(connection?.effectiveType ?? '')
}

function kindOrder(asset: GamePreloadAsset): number {
  if (asset.kind === 'audio') return 0
  if (asset.kind === 'image') return 1
  return 2
}

/**
 * Warms the current graph frontier. The planner follows saved connections,
 * so reordering or rewiring the editor graph automatically changes what is
 * loaded next without a matching code change.
 */
export function useFlowAssetPreloader({
  nodes,
  edges,
  currentNodeId,
  additionalRootIds = [],
}: FlowAssetPreloaderOptions) {
  const additionalRootsKey = additionalRootIds.join('|')
  const reducedSpeculation = shouldReduceSpeculation()
  const plan = useMemo(() => {
    if (!currentNodeId || nodes.length === 0) return []
    return planFlowPreloadNodes({
      nodes,
      edges,
      currentNodeId,
      additionalRootIds,
      lookaheadStops: reducedSpeculation ? 1 : 3,
      maxNodes: reducedSpeculation ? 10 : 28,
    })
  // additionalRootsKey captures the primitive identity of the optional roots
  // without forcing callers to memoize a tiny array.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, currentNodeId, additionalRootsKey, reducedSpeculation])

  useEffect(() => {
    if (!currentNodeId || nodes.length === 0) return
    const nodeById = new Map(nodes.map((node) => [node.id, node]))

    gameAssetPreloader.preloadMany(
      [...globalFlowAssets(nodes)].sort((a, b) => kindOrder(a) - kindOrder(b)),
      0,
    )

    for (const planned of plan) {
      const node = nodeById.get(planned.nodeId)
      if (!node) continue
      const assets = assetsForFlowNode(node)
        .filter((asset) => !(
          reducedSpeculation && planned.distance > 0 && asset.kind === 'video'
        ))
        .sort((a, b) => kindOrder(a) - kindOrder(b))
      gameAssetPreloader.preloadMany(assets, Math.min(planned.distance, 2))
    }
  }, [currentNodeId, nodes, plan, reducedSpeculation])
}
