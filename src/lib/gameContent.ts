import type { GameFlowEdge, GameFlowNode } from '@/types/editor'
import { assetUrl } from './paths'

const GAME_CONTENT_URL = assetUrl('/game-content.json')

export type SavedGraph = { nodes: GameFlowNode[]; edges: GameFlowEdge[] }

function isSavedGraph(value: unknown): value is SavedGraph {
  return (
    !!value &&
    typeof value === 'object' &&
    Array.isArray((value as { nodes?: unknown }).nodes) &&
    Array.isArray((value as { edges?: unknown }).edges)
  )
}

/** Load the immutable content artifact used by both local previews and players. */
export async function loadGameContent(): Promise<SavedGraph | null> {
  try {
    const response = await fetch(GAME_CONTENT_URL, { cache: 'no-store' })
    if (!response.ok) return null
    const parsed = await response.json()
    return isSavedGraph(parsed) ? parsed : null
  } catch {
    return null
  }
}
