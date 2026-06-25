import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Desktop, type TaskbarApp } from '@/components/Desktop'
import {
  CaseWindow,
  DEFAULT_CASE_DATA,
  type CaseDecision,
  type CaseWindowData,
} from '@/components/CaseWindow'
import {
  OperationWindowV2,
  DEFAULT_OPERATION_V2_DATA,
  type OperationWindowV2Data,
} from '@/components/OperationWindowV2'
import { WhackAMole } from '@/components/WhackAMole'
import { AchievementsWindow } from '@/components/AchievementsWindow'
import { useGameScale } from '@/hooks/useGameScale'
import { loadGraph } from '@/lib/editorStorage'
import type { SavedGraph } from '@/lib/editorStorage'
import type { CaseFlowNode, OperationFlowNode } from '@/types/editor'
import styles from './DesktopPage.module.css'

/**
 * The base desktop screen — shown when no scenario is active.
 *
 * When opened with `?startCase=<caseId>` (the "Play from this case" link in
 * the editor's CaseNode), it looks up that case in the saved editor graph and
 * renders the matching Case Window on the desktop.
 *
 * When opened with `?startOperation=<operationId>` (the "Preview this
 * operation" link in the editor's OperationNode), it looks up that
 * operation in the saved graph and renders its Operation Window on the
 * desktop. Without either param it just shows the bare desktop.
 */
export function DesktopPage() {
  const navigate = useNavigate()
  const scaleRef = useGameScale()
  const [graph, setGraph] = useState<SavedGraph | null>(null)

  useEffect(() => {
    let cancelled = false
    loadGraph().then((loaded) => {
      if (!cancelled) setGraph(loaded)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const startCaseId = useMemo(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('startCase')?.trim() || null
  }, [])

  const startOperationId = useMemo(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('startOperation')?.trim() || null
  }, [])

  const startCase = useMemo<CaseWindowData | null>(() => {
    if (!startCaseId) return null
    if (!graph) return null
    const node = graph.nodes.find(
      (n) => n.type === 'case' && (n as CaseFlowNode).data.caseId === startCaseId,
    ) as CaseFlowNode | undefined
    if (!node) return null
    return node.data.window ?? { ...DEFAULT_CASE_DATA, caseId: startCaseId }
  }, [graph, startCaseId])

  const startOperation = useMemo<OperationWindowV2Data | null>(() => {
    if (!startOperationId) return null
    if (!graph) return null
    const node = graph.nodes.find(
      (n) => n.type === 'operation' && (n as OperationFlowNode).data.operationId === startOperationId,
    ) as OperationFlowNode | undefined
    if (!node) return null
    return node.data.window ?? { ...DEFAULT_OPERATION_V2_DATA }
  }, [graph, startOperationId])

  const [closed, setClosed] = useState(false)
  const [operationClosed, setOperationClosed] = useState(false)
  const [whackOpen, setWhackOpen] = useState(false)
  // Local decision state — without the full game flow here, the user
  // can still preview the "Arrested" / "Released" lower-bar variants
  // by clicking the buttons in the previewed case window.
  const [decision, setDecision] = useState<CaseDecision | null>(null)
  // Local counter state for the previewed operation window — same
  // contract as the components-tab preview. Always starts at zero
  // regardless of any saved counters.
  const [opCounters, setOpCounters] = useState(
    () => DEFAULT_OPERATION_V2_DATA.counters,
  )

  const taskbarApps = useMemo<TaskbarApp[]>(() => {
    const apps: TaskbarApp[] = []
    if (startCase && !closed) {
      apps.push({ id: 'cases', label: 'Cases' })
    }
    if (startOperation && !operationClosed) {
      apps.push({ id: 'operation', label: 'Operation' })
    }
    if (whackOpen) {
      apps.push({ id: 'whack', label: 'Game' })
    }
    return apps
  }, [closed, operationClosed, startCase, startOperation, whackOpen])

  return (
    <div ref={scaleRef} className={styles.canvas} data-scaled-stage>
      <Desktop
        onStartClick={() => navigate('/game')}
        onWhackClick={() => setWhackOpen(true)}
        taskbarApps={taskbarApps}
      >
        <div className={styles.achievementsLayer}>
          <AchievementsWindow />
        </div>
        {startCase && !closed && (
          <div className={styles.caseLayer}>
            <CaseWindow
              data={startCase}
              draggable
              decision={decision}
              onArrest={() => setDecision('arrested')}
              onRelease={() => setDecision('released')}
              onClose={() => setClosed(true)}
            />
          </div>
        )}
        {startOperation && !operationClosed && (
          <div className={styles.caseLayer}>
            <OperationWindowV2
              data={{ ...startOperation, counters: opCounters }}
              draggable
              onChangeCounter={(key, value) => setOpCounters((c) => ({ ...c, [key]: value }))}
              onClose={() => setOperationClosed(true)}
              onStartOperation={() => {
                // Preview-mode: just acknowledge — the real
                // game-flow advance lives in GamePage.
                window.alert('Operation started! (Preview only — run via /game to advance the flow.)')
              }}
            />
          </div>
        )}
        {whackOpen && (
          <div className={styles.caseLayer}>
            <WhackAMole onClose={() => setWhackOpen(false)} />
          </div>
        )}
      </Desktop>
    </div>
  )
}
