import type { GameFlowNode, GameFlowEdge } from '@/types/editor'
import { assetUrl } from './paths'

/**
 * SHARED EDITOR STORAGE
 * Single source of truth for the file-backed graph loader/saver,
 * so the editor (writer) and the game (reader) never drift apart.
 */
const API_GRAPH_URL = '/api/editor-state'
const STATIC_GRAPH_URL = assetUrl('/editor-state-current.json')

export type SavedGraph = { nodes: GameFlowNode[]; edges: GameFlowEdge[] }

function isSavedGraph(value: unknown): value is SavedGraph {
  return (
    !!value &&
    typeof value === 'object' &&
    Array.isArray((value as { nodes?: unknown }).nodes) &&
    Array.isArray((value as { edges?: unknown }).edges)
  )
}

async function fetchGraph(url: string): Promise<SavedGraph | null> {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) return null
  const parsed = await response.json()
  return isSavedGraph(parsed) ? parsed : null
}

/** Return the saved graph file, or null if nothing valid is available. */
export async function loadGraph(): Promise<SavedGraph | null> {
  try {
    return (await fetchGraph(API_GRAPH_URL)) ?? (await fetchGraph(STATIC_GRAPH_URL))
  } catch {
    try {
      return await fetchGraph(STATIC_GRAPH_URL)
    } catch {
      return null
    }
  }
}

/** Persist the live graph to data/editor-state-current.json in local dev. */
export async function saveCurrentGraph(graph: SavedGraph): Promise<void> {
  const response = await fetch(API_GRAPH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(graph),
  })
  if (!response.ok) {
    throw new Error(`Could not save editor state (${response.status})`)
  }
}
