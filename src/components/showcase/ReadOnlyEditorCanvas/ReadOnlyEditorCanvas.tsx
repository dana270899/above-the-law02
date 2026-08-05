import { useMemo, type ComponentType } from 'react'
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { GameFlowNode } from '@/types/editor'
import { useSharedGameContent } from '@/components/game/GameContentProvider'
import { LoginNode } from '@/components/editor/nodes/LoginNode'
import { IntroNode } from '@/components/editor/nodes/IntroNode'
import { CaseNode } from '@/components/editor/nodes/CaseNode'
import { OperationNode } from '@/components/editor/nodes/OperationNode'
import { ResultNode } from '@/components/editor/nodes/ResultNode'
import { PrizeNode } from '@/components/editor/nodes/PrizeNode'
import { MessageNode } from '@/components/editor/nodes/MessageNode'
import { MiniGameNode } from '@/components/editor/nodes/MiniGameNode'
import { TriggerNode } from '@/components/editor/nodes/TriggerNode'
import { SecondArrestNode } from '@/components/editor/nodes/SecondArrestNode'
import { BgMusicNode } from '@/components/editor/nodes/BgMusicNode'
import { RankingNode } from '@/components/editor/nodes/RankingNode'
import { ScoringNode } from '@/components/editor/nodes/ScoringNode'
import { PointsNode } from '@/components/editor/nodes/PointsNode'
import styles from './ReadOnlyEditorCanvas.module.css'

// These are the same renderers used by the real authoring canvas. The canvas
// wrapper blocks their form controls, but retaining the renderers keeps every
// card visually identical to the project files.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function locked(NodeRenderer: ComponentType<any>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function LockedNode(props: any) {
    return (
      <div {...({ inert: '' } as Record<string, string>)}>
        <NodeRenderer {...props} />
      </div>
    )
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const NODE_TYPES: Record<string, any> = {
  login: locked(LoginNode),
  intro: locked(IntroNode),
  case: locked(CaseNode),
  operation: locked(OperationNode),
  result: locked(ResultNode),
  prize: locked(PrizeNode),
  message: locked(MessageNode),
  miniGame: locked(MiniGameNode),
  trigger: locked(TriggerNode),
  secondArrest: locked(SecondArrestNode),
  bgMusic: locked(BgMusicNode),
  ranking: locked(RankingNode),
  scoring: locked(ScoringNode),
  points: locked(PointsNode),
}

export function ReadOnlyEditorCanvas() {
  const sharedContent = useSharedGameContent()
  const nodes = sharedContent?.graph.nodes ?? []
  const edges = sharedContent?.graph.edges ?? []
  const isLoading = sharedContent?.isLoading ?? true

  const lockedNodes = useMemo(
    () => nodes.map((node) => ({
      ...node,
      draggable: false,
      selectable: false,
      connectable: false,
      focusable: false,
    } as GameFlowNode)),
    [nodes],
  )

  return (
    <div className={styles.wrap}>
      {isLoading && <div className={styles.status}>Loading published graph…</div>}
      <ReactFlow
        className={styles.flow}
        nodes={lockedNodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        nodesDraggable={false}
        nodesConnectable={false}
        nodesFocusable={false}
        edgesFocusable={false}
        elementsSelectable={false}
        deleteKeyCode={null}
        panOnDrag
        zoomOnScroll
        zoomOnPinch
        fitView
      >
        <Background color="#ddd" />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </div>
  )
}
