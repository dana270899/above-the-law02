import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  GameFlowEdge,
  GameFlowNode,
  CaseFlowNode,
  ResultFlowNode,
} from '@/types/editor'
import { loadGraph } from '@/lib/editorStorage'

/**
 * GAME FLOW HOOK
 * - Loads the editor's saved graph file on mount.
 * - Tracks which node the player is currently on (starts at the
 *   `login` node, falls back to the first node if there is none).
 * - Exposes `advance(sourceHandle?)` which follows an outgoing edge.
 *   When `sourceHandle` is given (e.g. 'arrest' / 'release' on a
 *   case node) the matching handle's edge is followed; otherwise the
 *   first outgoing edge wins.
 * - Tracks which cases have been completed: whenever the walker
 *   reaches a `result` node, that result's `caseId` is added to
 *   `completedCaseIds`. This drives sequential unlock in the UI.
 */
export interface CaseSummary {
  /** Stable id from the editor (the CaseNode's caseId). */
  caseId: string
  /** Display title from the editor. */
  title: string
  /** Order number from the editor (1, 2, 3, …). Lower = earlier. */
  order: number
}

export interface GameFlow {
  /** All nodes from the saved graph (empty if nothing was saved). */
  nodes: GameFlowNode[]
  /** All edges from the saved graph. */
  edges: GameFlowEdge[]
  /** The node the player is currently on, or null if empty / finished. */
  currentNode: GameFlowNode | null
  /** All case nodes sorted by `order` ascending. */
  cases: CaseSummary[]
  /** Set of caseIds that have been resolved (passed through a result node). */
  completedCaseIds: Set<string>
  /** Per-case outcome ('win' | 'lose') recorded as the player passes
   *  through result nodes. Read this to drive the AchievementsWindow. */
  caseResults: Map<string, 'win' | 'lose'>
  /**
   * Move to the next node. Pass `sourceHandle` to follow a specific
   * handle (e.g. case-node arrest/release). No-op if no edge matches.
   */
  advance: (sourceHandle?: string) => void
  /** Jump to a specific node by id (e.g. restart). No-op if not found. */
  goTo: (nodeId: string) => void
}

function findStartId(nodes: GameFlowNode[]): string | null {
  const login = nodes.find((n) => n.type === 'login')
  if (login) return login.id
  return nodes[0]?.id ?? null
}

function findNextNodeId(
  currentId: string,
  edges: GameFlowEdge[],
  sourceHandle?: string,
): string | null {
  // Edges from a case node's dedicated `trigger` source handle are NOT
  // walker edges — they're side-graph metadata pointing at Trigger
  // nodes consumed by GamePage's trigger lookup. Never follow them.
  const walkerEdges = edges.filter((e) => e.sourceHandle !== 'trigger')
  if (sourceHandle) {
    // Strict: when a specific handle is requested (case node Arrest /
    // Release), ONLY follow an edge whose sourceHandle matches exactly.
    // Falling through to "first outgoing edge wins" would silently route
    // the player's choice to the wrong target whenever an edge was
    // dragged without latching onto a handle dot — looking exactly like
    // "win and lose are inverted / random".
    const exact = walkerEdges.find(
      (e) => e.source === currentId && e.sourceHandle === sourceHandle,
    )
    if (exact) return exact.target
    if (typeof console !== 'undefined') {
      console.warn(
        `[useGameFlow] No edge from "${currentId}" with sourceHandle="${sourceHandle}". ` +
        `Player decision ignored. Check the editor wiring for this case node.`,
      )
    }
    return null
  }
  return walkerEdges.find((e) => e.source === currentId)?.target ?? null
}

export function useGameFlow(): GameFlow {
  // Load ONCE after first render. We intentionally don't reload on every
  // change — the game runs against a snapshot of the editor file.
  const [graph, setGraph] = useState<{ nodes: GameFlowNode[]; edges: GameFlowEdge[] }>({
    nodes: [],
    edges: [],
  })
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [completedCaseIds, setCompletedCaseIds] = useState<Set<string>>(() => new Set())
  const [caseResults, setCaseResults] = useState<Map<string, 'win' | 'lose'>>(
    () => new Map(),
  )

  useEffect(() => {
    let cancelled = false
    loadGraph().then((loaded) => {
      if (cancelled || !loaded) return
      setGraph(loaded)
      setCurrentId(findStartId(loaded.nodes))
    })
    return () => {
      cancelled = true
    }
  }, [])

  const currentNode = useMemo(
    () => graph.nodes.find((n) => n.id === currentId) ?? null,
    [graph.nodes, currentId],
  )

  // When the walker lands on a `result` node, mark its case as
  // completed AND record whether it was a win or a lose. The auto-skip
  // in the page will move past the result shortly after, but this
  // side-effect records both before that happens.
  useEffect(() => {
    if (currentNode?.type !== 'result') return
    const { caseId, resultType } = (currentNode as ResultFlowNode).data
    if (!caseId) return
    setCompletedCaseIds((prev) => {
      if (prev.has(caseId)) return prev
      const next = new Set(prev)
      next.add(caseId)
      return next
    })
    setCaseResults((prev) => {
      if (prev.get(caseId) === resultType) return prev
      const next = new Map(prev)
      next.set(caseId, resultType)
      return next
    })
  }, [currentNode])

  // All cases from the graph, sorted by `order` (asc). Locked / unlocked
  // is computed by the consumer using `completedCaseIds`.
  const cases = useMemo<CaseSummary[]>(() => {
    return graph.nodes
      .filter((n): n is CaseFlowNode => n.type === 'case')
      .map((n) => ({
        caseId: n.data.caseId,
        title: n.data.title,
        order: n.data.order,
      }))
      .sort((a, b) => a.order - b.order)
  }, [graph.nodes])

  const advance = useCallback(
    (sourceHandle?: string) => {
      if (!currentId) return
      const nextId = findNextNodeId(currentId, graph.edges, sourceHandle)
      if (nextId) setCurrentId(nextId)
    },
    [currentId, graph.edges],
  )

  const goTo = useCallback(
    (nodeId: string) => {
      if (graph.nodes.some((n) => n.id === nodeId)) setCurrentId(nodeId)
    },
    [graph.nodes],
  )

  return {
    nodes: graph.nodes,
    edges: graph.edges,
    currentNode,
    cases,
    completedCaseIds,
    caseResults,
    advance,
    goTo,
  }
}
