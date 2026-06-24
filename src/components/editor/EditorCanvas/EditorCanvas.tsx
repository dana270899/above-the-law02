import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type NodeChange,
  type EdgeChange,
  type ReactFlowInstance,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import type { GameFlowNode, GameFlowEdge } from '@/types/editor'
import { loadGraph, saveCurrentGraph } from '@/lib/editorStorage'
import {
  hasAnyVersion,
  saveVersion,
  type GameVersion,
} from '@/lib/versionHistory'
import { buildTutorialNodes, buildTutorialEdges } from '@/lib/tutorialFlow'
import { VersionsModal } from '@/components/editor/VersionsModal/VersionsModal'
import { LoginNode }     from '@/components/editor/nodes/LoginNode'
import { IntroNode }     from '@/components/editor/nodes/IntroNode'
import { CaseNode }      from '@/components/editor/nodes/CaseNode'
import { OperationNode } from '@/components/editor/nodes/OperationNode'
import { ResultNode }    from '@/components/editor/nodes/ResultNode'
import { PrizeNode }     from '@/components/editor/nodes/PrizeNode'
import { MessageNode }   from '@/components/editor/nodes/MessageNode'
import { TriggerNode }   from '@/components/editor/nodes/TriggerNode'
import { BgMusicNode }   from '@/components/editor/nodes/BgMusicNode'
import { DEFAULT_BG_MUSIC_ID, DEFAULT_BG_MUSIC_VOLUME } from '@/lib/bgMusic'
import { DEFAULT_WIN_SCREEN_ID } from '@/lib/winScreens'
import styles from './EditorCanvas.module.css'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const NODE_TYPES: Record<string, any> = {
  login:     LoginNode,
  intro:     IntroNode,
  case:      CaseNode,
  operation: OperationNode,
  result:    ResultNode,
  prize:     PrizeNode,
  message:   MessageNode,
  trigger:   TriggerNode,
  bgMusic:   BgMusicNode,
}

const DEFAULT_NODES: GameFlowNode[] = [
  {
    id: 'login',
    type: 'login',
    position: { x: 300, y: 40 },
    data: { nodeType: 'login', label: 'Login Screen' },
  },
  {
    id: 'message-1',
    type: 'message',
    position: { x: 300, y: 280 },
    data: {
      nodeType: 'message',
      messageType: 'text',
      content: '',
      buttonLabel: 'Continue',
      buttonLinkType: 'edge',
      buttonUrl: '',
      locationX: 50,
      locationY: 50,
    },
  },
]
const DEFAULT_EDGES: GameFlowEdge[] = [
  { id: 'e-login-msg1', source: 'login', target: 'message-1' },
]

type HistorySnapshot = { nodes: GameFlowNode[]; edges: GameFlowEdge[] }
const HISTORY_LIMIT = 5

function nextMessageIndex(nodes: GameFlowNode[]): number {
  return (
    nodes
      .filter((n) => n.type === 'message')
      .map((n) => Number(n.id.replace('message-', '')) || 0)
      .reduce((a, b) => Math.max(a, b), 0) + 1
  )
}

export function EditorCanvas() {
  const [graphLoaded, setGraphLoaded] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState<GameFlowNode>(DEFAULT_NODES)
  const [edges, setEdges, onEdgesChange] = useEdgesState(DEFAULT_EDGES)
  const nextMsgIdx = useRef(nextMessageIndex(DEFAULT_NODES))

  // Keep refs to the latest graph so history helpers can read pre-change
  // state without re-creating themselves on every render.
  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  useEffect(() => {
    nodesRef.current = nodes
    edgesRef.current = edges
  }, [nodes, edges])

  useEffect(() => {
    let cancelled = false
    loadGraph()
      .then((graph) => {
        if (cancelled) return
        const loaded = graph ?? { nodes: DEFAULT_NODES, edges: DEFAULT_EDGES }
        setNodes(loaded.nodes)
        setEdges(loaded.edges)
        nodesRef.current = loaded.nodes
        edgesRef.current = loaded.edges
        nextMsgIdx.current = nextMessageIndex(loaded.nodes)
        historyRef.current = { past: [], future: [] }
        bumpHistory()
        setGraphLoaded(true)
      })
      .catch((error) => {
        if (cancelled) return
        setSaveError(error instanceof Error ? error.message : String(error))
        setGraphLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [setNodes, setEdges])

  // ─── Undo / Redo ────────────────────────────────────────────
  // Bounded stacks: up to 5 entries each. A "commit" snapshots the
  // current graph into `past` and clears `future` — that happens just
  // before any mutating action (add, delete, connect, drag start,
  // tutorial inject, version restore). Undo moves a snapshot from
  // past→future; redo moves one from future→past.
  const historyRef = useRef<{ past: HistorySnapshot[]; future: HistorySnapshot[] }>({
    past: [],
    future: [],
  })
  const [, bumpHistory] = useReducer((x: number) => x + 1, 0)
  const isDraggingRef = useRef(false)

  const commitHistory = useCallback(() => {
    historyRef.current.past.push({
      nodes: nodesRef.current,
      edges: edgesRef.current,
    })
    if (historyRef.current.past.length > HISTORY_LIMIT) {
      historyRef.current.past.shift()
    }
    historyRef.current.future = []
    bumpHistory()
  }, [])

  const undo = useCallback(() => {
    const past = historyRef.current.past
    if (past.length === 0) return
    const prev = past.pop()!
    historyRef.current.future.push({
      nodes: nodesRef.current,
      edges: edgesRef.current,
    })
    if (historyRef.current.future.length > HISTORY_LIMIT) {
      historyRef.current.future.shift()
    }
    setNodes(prev.nodes)
    setEdges(prev.edges)
    bumpHistory()
  }, [setNodes, setEdges])

  const redo = useCallback(() => {
    const future = historyRef.current.future
    if (future.length === 0) return
    const next = future.pop()!
    historyRef.current.past.push({
      nodes: nodesRef.current,
      edges: edgesRef.current,
    })
    if (historyRef.current.past.length > HISTORY_LIMIT) {
      historyRef.current.past.shift()
    }
    setNodes(next.nodes)
    setEdges(next.edges)
    bumpHistory()
  }, [setNodes, setEdges])

  // Wrap the change handlers so we commit history at meaningful moments:
  // before a drag begins, before deletions, and before edge removals.
  // Mid-drag position updates and selection changes are skipped so the
  // 5-step history isn't burned on every pixel of motion.
  const handleNodesChange = useCallback(
    (changes: NodeChange<GameFlowNode>[]) => {
      const hasRemove = changes.some((c) => c.type === 'remove')
      const dragStart = changes.some(
        (c) => c.type === 'position' && c.dragging === true,
      )
      const dragEnd = changes.some(
        (c) => c.type === 'position' && c.dragging === false,
      )
      if (hasRemove) commitHistory()
      if (dragStart && !isDraggingRef.current) {
        isDraggingRef.current = true
        commitHistory()
      }
      if (dragEnd) isDraggingRef.current = false
      onNodesChange(changes)
    },
    [commitHistory, onNodesChange],
  )

  const handleEdgesChange = useCallback(
    (changes: EdgeChange<GameFlowEdge>[]) => {
      const hasRemove = changes.some((c) => c.type === 'remove')
      if (hasRemove) commitHistory()
      onEdgesChange(changes)
    },
    [commitHistory, onEdgesChange],
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      commitHistory()
      setEdges((eds) => addEdge(connection, eds))
    },
    [commitHistory, setEdges],
  )

  // Keyboard shortcuts: Cmd/Ctrl+Z = undo, Cmd/Ctrl+Shift+Z or
  // Cmd/Ctrl+Y = redo. Ignored while typing into form fields so it
  // doesn't fight the browser's native input-level undo.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return
      }
      const key = e.key.toLowerCase()
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  // ─── Viewport-aware placement ───────────────────────────────
  // New nodes drop at the center of whatever the user is currently
  // looking at, rather than the top-left of the world. A small counter
  // adds a few px of offset per add so a flurry of clicks doesn't stack
  // every node on top of each other.
  const wrapperRef = useRef<HTMLDivElement>(null)
  const rfInstanceRef = useRef<ReactFlowInstance<GameFlowNode, GameFlowEdge> | null>(null)
  const addOffsetRef = useRef(0)

  function getCenterFlowPosition() {
    const instance = rfInstanceRef.current
    const wrap = wrapperRef.current
    const offset = (addOffsetRef.current++ % 5) * 25
    if (!instance || !wrap) {
      return { x: 100 + offset, y: 100 + offset }
    }
    const rect = wrap.getBoundingClientRect()
    const center = instance.screenToFlowPosition({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    })
    return { x: center.x - 100 + offset, y: center.y - 50 + offset }
  }

  function addMessageNode() {
    commitHistory()
    const id = `message-${nextMsgIdx.current++}`
    setNodes((ns) => [
      ...ns,
      {
        id,
        type: 'message',
        position: getCenterFlowPosition(),
        data: {
          nodeType: 'message',
          messageType: 'text',
          content: '',
          buttonLabel: 'Continue',
          buttonLinkType: 'edge',
          buttonUrl: '',
          locationX: 50,
          locationY: 50,
        },
      } as GameFlowNode,
    ])
  }

  function addTriggerNode() {
    commitHistory()
    const id = `trigger-${Date.now()}`
    setNodes((ns) => [
      ...ns,
      {
        id,
        type: 'trigger',
        position: getCenterFlowPosition(),
        data: {
          nodeType: 'trigger',
          triggerType: 'arrest',
        },
      } as GameFlowNode,
    ])
  }

  function addCaseNode() {
    commitHistory()
    const existing = nodes.filter((n) => n.type === 'case').length
    const order = existing + 1
    const id = `case-${Date.now()}`
    setNodes((ns) => [
      ...ns,
      {
        id,
        type: 'case',
        position: getCenterFlowPosition(),
        data: {
          nodeType: 'case',
          caseId: String(890 + order),
          title: `Case ${order}`,
          order,
          hasOperation: false,
        },
      } as GameFlowNode,
    ])
  }

  function addOperationNode() {
    commitHistory()
    // Stable unique operationId — incremented count of existing
    // operation nodes. The user can rename it on the node card.
    const existing = nodes.filter((n) => n.type === 'operation').length
    const opId = `op-${existing + 1}`
    const id = `operation-${Date.now()}`
    setNodes((ns) => [
      ...ns,
      {
        id,
        type: 'operation',
        position: getCenterFlowPosition(),
        data: {
          nodeType: 'operation',
          operationId: opId,
          title: `Operation ${existing + 1}`,
        },
      } as GameFlowNode,
    ])
  }

  /** Add a single Background Music settings node. Only one is meaningful
   *  per graph — if one already exists, just bail out so the canvas
   *  doesn't end up with two competing tracks. */
  function addBgMusicNode() {
    const existing = nodes.find((n) => n.type === 'bgMusic')
    if (existing) {
      window.alert('A Background Music node already exists in this graph.')
      return
    }
    commitHistory()
    const id = `bgMusic-${Date.now()}`
    setNodes((ns) => [
      ...ns,
      {
        id,
        type: 'bgMusic',
        position: getCenterFlowPosition(),
        data: {
          nodeType: 'bgMusic',
          src: DEFAULT_BG_MUSIC_ID,
          volume: DEFAULT_BG_MUSIC_VOLUME,
        },
      } as GameFlowNode,
    ])
  }

  /** Add a fresh "win" result node. Renders the responsive win screen
   *  in-game (image + Good job! + Next bar). The author picks which
   *  image to show — and can upload a new one — from the node itself. */
  function addWinScreenNode() {
    commitHistory()
    const existing = nodes.filter(
      (n) => n.type === 'result' && (n.data as { resultType?: string }).resultType === 'win',
    ).length
    const id = `result-win-${Date.now()}`
    setNodes((ns) => [
      ...ns,
      {
        id,
        type: 'result',
        position: getCenterFlowPosition(),
        data: {
          nodeType: 'result',
          resultType: 'win',
          caseId: '',
          label: `Win ${existing + 1}`,
          winImage: DEFAULT_WIN_SCREEN_ID,
        },
      } as GameFlowNode,
    ])
  }

  // Persist nodes + edges to data/editor-state-current.json on every change.
  useEffect(() => {
    if (!graphLoaded) return
    const timeout = window.setTimeout(() => {
      saveCurrentGraph({ nodes, edges })
        .then(() => setSaveError(null))
        .catch((error) => {
          setSaveError(error instanceof Error ? error.message : String(error))
        })
    }, 350)
    return () => window.clearTimeout(timeout)
  }, [graphLoaded, nodes, edges])

  // ─── Version history ────────────────────────────────────────
  // Snapshots of the editor graph are stored separately under
  // `game-editor-versions-v1`. The user can save named versions, and
  // the editor itself takes an automatic snapshot on first ever load
  // and before any restore — so nothing the user has built can be
  // erased without a recovery path.
  const [versionsOpen, setVersionsOpen] = useState(false)

  // Run-once: if no versions exist yet, capture the current state as
  // the very first "auto" snapshot. This guarantees the user's
  // pre-versioning work is preserved.
  useEffect(() => {
    if (!graphLoaded) return
    let cancelled = false
    hasAnyVersion()
      .then((hasVersion) => {
        if (!cancelled && !hasVersion) {
          return saveVersion('Initial snapshot', { nodes, edges }, { auto: true })
        }
      })
      .catch((error) => {
        setSaveError(error instanceof Error ? error.message : String(error))
      })
    return () => {
      cancelled = true
    }
  }, [graphLoaded, nodes, edges])

  async function handleSaveVersion() {
    const name = window.prompt('Name this version (optional):', '') ?? ''
    try {
      await saveVersion(name, { nodes, edges }, { auto: false })
      setSaveError(null)
      setVersionsOpen(true)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error))
      window.alert('Could not save version. Check the local dev server.')
    }
  }

  /**
   * Inject the tutorial preset as a separate chain in the canvas. Each
   * preset id is prefixed `tut-` so a re-click is a no-op (we skip any
   * id already present). The user's existing nodes and edges are left
   * completely untouched — the only follow-up needed is wiring the
   * existing `login` node's outgoing edge to `tut-msg-welcome` to make
   * the new sequence playable.
   */
  function handleAddTutorial() {
    // Snapshot current graph in version history before the change so
    // the injection is fully reversible.
    commitHistory()
    saveVersion('Before injecting tutorial flow', { nodes, edges }, { auto: true }).catch((error) => {
      setSaveError(error instanceof Error ? error.message : String(error))
    })
    const presetNodes = buildTutorialNodes()
    const presetEdges = buildTutorialEdges()
    const existingNodeIds = new Set(nodes.map((n) => n.id))
    const existingEdgeIds = new Set(edges.map((e) => e.id))
    const newNodes = presetNodes.filter((n) => !existingNodeIds.has(n.id))
    const newEdges = presetEdges.filter((e) => !existingEdgeIds.has(e.id))
    if (newNodes.length === 0 && newEdges.length === 0) {
      window.alert('Tutorial flow already injected. Nothing to add.')
      return
    }
    setNodes((ns) => [...ns, ...newNodes])
    setEdges((es) => [...es, ...newEdges])
    window.alert(
      `Added ${newNodes.length} node(s) and ${newEdges.length} edge(s). ` +
      `Wire your existing login node to "tut-msg-welcome" to make this flow live.`,
    )
  }

  async function handleRestore(v: GameVersion) {
    // Always snapshot what we're about to overwrite, so even a restore
    // can itself be undone via "Restore the auto-backup".
    commitHistory()
    try {
      await saveVersion(`Before restoring "${v.name}"`, { nodes, edges }, { auto: true })
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error))
    }
    setNodes(v.graph.nodes)
    setEdges(v.graph.edges)
    setVersionsOpen(false)
  }

  const canUndo = historyRef.current.past.length > 0
  const canRedo = historyRef.current.future.length > 0

  return (
    <div className={styles.wrap} ref={wrapperRef}>
      <div className={styles.toolbar}>
        <button
          className={styles.addBtn}
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Cmd/Ctrl+Z) — up to 5 steps"
        >
          ↶ Undo
        </button>
        <button
          className={styles.addBtn}
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Cmd/Ctrl+Shift+Z) — up to 5 steps"
        >
          ↷ Redo
        </button>
        <button className={styles.addBtn} onClick={addMessageNode}>
          + Add Message
        </button>
        <button className={styles.addBtn} onClick={addCaseNode}>
          + Add Case
        </button>
        <button className={styles.addBtn} onClick={addOperationNode}>
          + Add Operation
        </button>
        <button className={styles.addBtn} onClick={addTriggerNode}>
          + Add Trigger
        </button>
        <button
          className={styles.addBtn}
          onClick={addWinScreenNode}
          title="Add a Win result node — renders the responsive win screen in-game. Choose or upload the image from the node."
        >
          + Add Win Screen
        </button>
        <button
          className={styles.addBtn}
          onClick={addBgMusicNode}
          title="Add a Background Music node — plays a looped track behind every screen except the win screens. Choose or upload the track from the node."
        >
          + Add Background Music
        </button>
        <button
          className={styles.addBtn}
          onClick={handleAddTutorial}
          title="Insert a pre-built tutorial sequence as a separate chain. Existing nodes and edges are left untouched."
        >
          🎓 Add tutorial flow
        </button>
        <button className={styles.addBtn} onClick={handleSaveVersion} title="Save the current graph as a named version">
          💾 Save version
        </button>
        <button className={styles.addBtn} onClick={() => setVersionsOpen(true)} title="Browse and restore saved versions">
          📜 Versions
        </button>
      </div>
      {(!graphLoaded || saveError) && (
        <div className={saveError ? styles.saveError : styles.saveStatus}>
          {saveError || 'Loading editor graph...'}
        </div>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onInit={(instance) => {
          rfInstanceRef.current = instance
        }}
        nodeTypes={NODE_TYPES}
        fitView
      >
        <Background color="#ddd" />
        <Controls />
        <MiniMap />
      </ReactFlow>

      {versionsOpen && (
        <VersionsModal
          onClose={() => setVersionsOpen(false)}
          onRestore={handleRestore}
        />
      )}
    </div>
  )
}
