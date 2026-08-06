import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { loadGameContent, type SavedGraph } from '@/lib/gameContent'
import { useFlowAssetPreloader } from '@/hooks/useFlowAssetPreloader'
import { criticalPhotoAssets } from '@/lib/gamePreloadAssets'
import { gameAssetPreloader } from '@/lib/gameAssetPreloader'

export interface SharedGameContent {
  graph: SavedGraph
  isLoading: boolean
}

const EMPTY_GRAPH: SavedGraph = { nodes: [], edges: [] }
const GameContentContext = createContext<SharedGameContent | undefined>(undefined)

/**
 * Public-game graph snapshot. It stays mounted above the router so replaying
 * can reset GamePage state without refetching the immutable production graph.
 * It also warms the graph's starting frontier while the player is still on
 * the ranking entry page.
 */
export function GameContentProvider({ children }: { children: ReactNode }) {
  const [graph, setGraph] = useState<SavedGraph>(EMPTY_GRAPH)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let active = true
    void loadGameContent()
      .then((loaded) => {
        if (!active || !loaded) return
        setGraph(loaded)

        // Decode important photos immediately and keep their Image objects
        // alive. This runs in the background and never blocks Start Game.
        for (const photo of criticalPhotoAssets(loaded.nodes)) {
          void gameAssetPreloader.preloadAndRetain(photo, 0).catch((reason) => {
            console.warn(`Could not preload game photo: ${photo.src}`, reason)
          })
        }
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const startNodeId = useMemo(() => {
    return graph.nodes.find((node) => node.type === 'login')?.id
      ?? graph.nodes[0]?.id
      ?? null
  }, [graph.nodes])

  useFlowAssetPreloader({
    nodes: graph.nodes,
    edges: graph.edges,
    currentNodeId: startNodeId,
  })

  const value = useMemo<SharedGameContent>(
    () => ({ graph, isLoading }),
    [graph, isLoading],
  )

  return (
    <GameContentContext.Provider value={value}>
      {children}
    </GameContentContext.Provider>
  )
}

/** Undefined in the local authoring app, which intentionally keeps its
 * existing load-on-preview behavior so newly saved editor graphs are fresh. */
export function useSharedGameContent(): SharedGameContent | undefined {
  return useContext(GameContentContext)
}
