import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { Desktop, type TaskbarApp } from '@/components/Desktop'
import {
  CaseWindowV2 as CaseWindow,
  DEFAULT_CASE_DATA,
  type CaseTab,
  type CaseDecision,
  type CaseWindowData,
  type CaseWindowHighlightTarget,
} from '@/components/CaseWindow'
import {
  OperationWindowV2,
  DEFAULT_OPERATION_V2_DATA,
  type OperationWindowV2Data,
  type OperationItemKey,
  type OperationCounters,
} from '@/components/OperationWindowV2'
import { BossMessage } from '@/components/game/BossMessage/BossMessage'
import { LoginScreen } from '@/components/game/LoginScreen/LoginScreen'
import { Subtitles } from '@/components/game/Subtitles'
import { startDragCursor, stopDragCursor } from '@/lib/dragCursor'
import { TutorialSpotlight } from '@/components/game/TutorialSpotlight'
import { OperationLockedScreen } from '@/components/game/OperationLockedScreen'
import { AchievementsWindow, type CaseOutcome } from '@/components/AchievementsWindow'
import { WhackAMole } from '@/components/WhackAMole'
import { useGameFlow } from '@/hooks/useGameFlow'
import { useFlowAssetPreloader } from '@/hooks/useFlowAssetPreloader'
import { useGameScale } from '@/hooks/useGameScale'
import { messageDataToBossProps } from '@/lib/messageMapping'
import type {
  CaseFlowNode,
  GameFlowEdge,
  GameFlowNode,
  MessageFlowNode,
  MessageNodeData,
  OperationFlowNode,
  PointsFlowNode,
  ResultFlowNode,
  TriggerFlowNode,
  TriggerType,
  RankingFlowNode,
} from '@/types/editor'
import { WinScreenComponent } from '@/components/game/WinScreen'
import type { WinVariant } from '@/lib/winScreenImage'
import { getWinSound } from '@/lib/winSounds'
import { loadAudioBlob } from '@/lib/audioBlobStore'
import { BgMusicPlayer } from '@/components/game/BgMusicPlayer/BgMusicPlayer'
import type { BgMusicFlowNode } from '@/types/editor'
import { assetUrl } from '@/lib/paths'
import { buildRunScore, calculateCaseScore, combineRetryScore, DEFAULT_SCORING_SETTINGS, recordCaseScore, type CaseScoreBreakdown, type PlayerProfile, type ScoringSettings } from '@/lib/scoring'
import {
  freezeCaseTimer,
  getCaseElapsedSeconds,
  pauseCaseTimer,
  resumeCaseTimer,
  type CaseTimers,
} from '@/lib/caseTimer'
import { RankingPage } from '@/components/game/RankingPage/RankingPage'
import { GameRestartDialog } from '@/components/game/GameRestartDialog/GameRestartDialog'
import { formatCaseTimestamp, isCaseUnlocked } from '@/lib/caseProgression'
import { pathContainsPointsNode } from '@/lib/pointsFlow'
import { pathReachesRankingWithoutResult } from '@/lib/terminalCaseFlow'
import styles from './GamePage.module.css'

function isCaseWindowHighlightTarget(
  targetId: string | undefined,
): targetId is CaseWindowHighlightTarget {
  return targetId === 'case.identity'
    || targetId === 'case.records'
    || targetId === 'case.suspicion.attachment'
}

const WINDOW_MOTION_MS = 420
type WindowMotion = 'idle' | 'minimizing' | 'restoring'
type WindowMotionOrigin = 'desktop' | 'taskbar'

/** Keeps existing messages immediate while allowing each message node to
 * opt into a delay. The node itself remains active so the graph cannot
 * advance or lose state while its card is waiting to appear. */
function useDelayedMessage(node: MessageFlowNode | null): MessageFlowNode | null {
  const [revealedId, setRevealedId] = useState<string | null>(null)
  const nodeId = node?.id ?? null
  const delaySeconds = Math.max(0, node?.data.delaySeconds ?? 0)

  useEffect(() => {
    if (!nodeId || delaySeconds === 0) return
    const timer = window.setTimeout(() => setRevealedId(nodeId), delaySeconds * 1000)
    return () => window.clearTimeout(timer)
  }, [nodeId, delaySeconds])

  if (!node) return null
  return delaySeconds === 0 || revealedId === node.id ? node : null
}

/**
 * GAME PAGE
 * Walks the saved editor graph and renders the matching in-game UI.
 *
 * Stopping nodes (the walker pauses here for player input):
 *   - login   → renders the LoginScreen full-screen
 *   - message → overlays a BossMessage at locationX/Y on the desktop
 *   - case    → unlocks the Cases icon; player opens the window manually
 *
 * Non-renderable nodes (intro / operation / result / prize) are
 * auto-skipped. When the walker passes through a `result` node, the
 * matching case is recorded as completed (handled inside useGameFlow),
 * which unlocks the next tab in the Cases window.
 */
export function GamePage() {
  const navigate = useNavigate()
  const flow = useGameFlow()
  const gameStartedAtRef = useRef(new Date())
  const scaleRef = useGameScale()
  const publicationKeyRef = useRef(crypto.randomUUID())
  const [playerProfile, setPlayerProfile] = useState<PlayerProfile>({ name: 'Officer', photo: null, photoPreviewUrl: null })
  const [scoreByCase, setScoreByCase] = useState<Record<string, CaseScoreBreakdown>>({})
  const showRestartPreview = import.meta.env.DEV
    && new URLSearchParams(window.location.search).get('restartPreview') === '1'
  const restartToRanking = useCallback(() => {
    navigate('/')
  }, [navigate])
  const restartDialog = (
    <GameRestartDialog
      preview={showRestartPreview}
      onRestart={restartToRanking}
    />
  )
  const [pointPopup, setPointPopup] = useState<{ id: string; points: number; kind: 'win' | 'lose' | 'time' } | null>(null)
  const winAdvancePendingRef = useRef(false)
  const winAdvanceTimerRef = useRef<number | null>(null)
  const pointPopupTimerRef = useRef<number | null>(null)
  const caseTimersRef = useRef<CaseTimers>({})
  const caseAttemptRef = useRef<Record<string, 1 | 2>>({})

  // ?startCase / ?startOperation lets the editor's "Play from this
  // case" / "Preview this operation" links drop the player straight
  // onto the matching node — the walker jumps there on mount, and
  // the relevant window auto-opens. The graph's earlier nodes are
  // skipped (login etc.), but every downstream transition runs the
  // same as a normal `/game` session.
  const startParams = useMemo(() => {
    if (!import.meta.env.DEV) {
      return { startCaseId: null, startOperationId: null }
    }

    const params = new URLSearchParams(window.location.search)
    return {
      startCaseId:      params.get('startCase')?.trim()      || null,
      startOperationId: params.get('startOperation')?.trim() || null,
    }
  }, [])

  // Has the player popped open the Cases window? Stays closed until
  // the player clicks the desktop icon or a boss-message "case" button.
  // Auto-opens on mount when the URL says we're starting on a case.
  const [caseWindowOpen, setCaseWindowOpen] = useState(
    () => !!startParams.startCaseId,
  )
  const [miniGameOpen, setMiniGameOpen] = useState(false)
  const [miniGameMinimized, setMiniGameMinimized] = useState(false)
  const [miniGameScoringSession, setMiniGameScoringSession] = useState(false)
  const [miniGamePoints, setMiniGamePoints] = useState(0)
  const [flowPoints, setFlowPoints] = useState(0)
  const miniGameContinueRef = useRef<(() => void) | null>(null)
  const miniGameContinueOnCloseRef = useRef(false)
  const miniGameNodeExitingRef = useRef(false)
  const [miniGameMotion, setMiniGameMotion] = useState<WindowMotion>('idle')
  const [miniGameMotionOrigin, setMiniGameMotionOrigin] = useState<WindowMotionOrigin>('desktop')
  const miniGameMotionTimeoutRef = useRef<number | null>(null)
  const miniGameLayerRef = useRef<HTMLDivElement | null>(null)
  const [foregroundDesktopApp, setForegroundDesktopApp] = useState<
    'cases' | 'operation' | null
  >(() => startParams.startCaseId ? 'cases' : null)

  // Which case body is currently displayed inside the Cases window
  // (the active left-side tab). Defaults to the current flow case
  // when the player opens the window, or the first unlocked case.
  const [viewCaseId, setViewCaseId] = useState<string | null>(null)

  // Per-case Arrest / Release decisions. Drives the footer variant in
  // the Case Window: undecided shows the buttons, decided shows the pill.
  // Lives here (in-memory for the session) rather than in useGameFlow so
  // it doesn't change the editor data shape.
  const [caseDecisions, setCaseDecisions] = useState<
    Record<string, CaseDecision>
  >({})
  // Operation-backed cases are not solved by the decision alone. Keep the
  // decided case pending until its Operation Window successfully finishes.
  const [pendingOperationCaseId, setPendingOperationCaseId] = useState<string | null>(null)
  const [completedOperationCaseIds, setCompletedOperationCaseIds] = useState<Set<string>>(
    () => new Set(),
  )

  // Side queue of message-node ids fired by a tutorial trigger
  // (Arrest / Release / suspicion row expand / suspicion attachment).
  // Each entry is shown as a BossMessage overlay, popped on click.
  // Does NOT advance the main walker. When the queue drains, the
  // `pendingActionRef` (the click action that was deferred) runs.
  const [triggerQueue, setTriggerQueue] = useState<string[]>([])
  const pendingActionRef = useRef<(() => void) | null>(null)
  const pendingIncorrectCaseRef = useRef<CaseFlowNode | null>(null)
  const lossAwardedCaseIdsRef = useRef<Set<string>>(new Set())
  const pointsControlledCaseIdsRef = useRef<Set<string>>(new Set())

  // Ids of trigger-fired messages that have already been displayed in
  // this session. Re-firing the same trigger (player re-expands a row,
  // re-clicks the attachment, or re-clicks Arrest on a retry case) must
  // not replay a bubble the player already saw.
  const [shownTriggerMessageIds, setShownTriggerMessageIds] = useState<Set<string>>(
    () => new Set(),
  )

  // Cases explicitly reached during this session stay available. This
  // includes direct editor previews and cases opened by announcement
  // messages, so visiting an earlier tab cannot lock the current case.
  const [sessionUnlockedCaseIds, setSessionUnlockedCaseIds] = useState<Set<string>>(
    () => new Set(startParams.startCaseId ? [startParams.startCaseId] : []),
  )

  // Operation desktop icon: starts locked. A boss-message with
  // `buttonLinkType === 'operation'` flips this to true. When the
  // player is dropped straight onto an operation node via the editor's
  // preview link, we unlock it on mount too so the walker-stop window
  // can render without first having to walk through a message.
  const [operationUnlocked, setOperationUnlocked] = useState(
    () => !!startParams.startOperationId,
  )
  const [operationWindowOpen, setOperationWindowOpen] = useState(false)
  const [operationWindowMinimized, setOperationWindowMinimized] = useState(false)
  const [operationWindowMotion, setOperationWindowMotion] = useState<WindowMotion>('idle')
  const operationWindowMotionTimeoutRef = useRef<number | null>(null)
  const operationWindowLayerRef = useRef<HTMLDivElement | null>(null)
  const [operationWindowMotionOrigin, setOperationWindowMotionOrigin] =
    useState<WindowMotionOrigin>('desktop')
  // Locked-screen modal: shown when the player clicks the Operation
  // icon before it's been unlocked by the boss flow.
  const [operationLockedScreenOpen, setOperationLockedScreenOpen] =
    useState(false)

  const { isLoading, currentNode, advance, goTo, cases, completedCaseIds, caseResults, nodes, edges } = flow
  const [achievementsOpen, setAchievementsOpen] = useState(false)
  const [caseWindowMinimized, setCaseWindowMinimized] = useState(false)
  const [caseWindowMotion, setCaseWindowMotion] = useState<WindowMotion>('idle')
  const caseWindowMotionTimeoutRef = useRef<number | null>(null)
  const caseWindowLayerRef = useRef<HTMLDivElement | null>(null)
  const [caseWindowMotionOrigin, setCaseWindowMotionOrigin] =
    useState<WindowMotionOrigin>('desktop')

  // Measure the real taskbar button so the animation follows the correct
  // icon even when the set/order of open apps changes.
  useLayoutEffect(() => {
    const setFlightPath = (
      layer: HTMLDivElement | null,
      appId: 'cases' | 'operation' | 'whack',
      motion: WindowMotion,
      origin: WindowMotionOrigin,
    ) => {
      if (!layer || motion === 'idle') return
      const targetSelector = origin === 'desktop'
        ? `[data-spot="icon.${appId}"]`
        : `[data-taskbar-app="${appId}"]`
      const app = document.querySelector<HTMLElement>(targetSelector)
      const windowElement = layer.firstElementChild as HTMLElement | null
      const canvas = layer.closest<HTMLElement>('[data-scaled-stage]')
      if (!app || !windowElement || !canvas) return

      // Animate the full-screen positioning layer, not the draggable window
      // itself. The window owns a centering `transform`, which otherwise
      // changes the coordinate system and pulls the flight path toward the
      // middle of the taskbar.
      layer.style.animation = 'none'
      const windowRect = windowElement.getBoundingClientRect()
      const appRect = app.getBoundingClientRect()
      const canvasRect = canvas.getBoundingClientRect()
      const stageScale = canvasRect.width / 1920 || 1
      layer.style.setProperty(
        '--window-taskbar-x',
        `${(appRect.left + appRect.width / 2 - (windowRect.left + windowRect.width / 2)) / stageScale}px`,
      )
      layer.style.setProperty(
        '--window-taskbar-y',
        `${(appRect.top + appRect.height / 2 - (windowRect.top + windowRect.height / 2)) / stageScale}px`,
      )
      void layer.offsetWidth
      layer.style.animation = ''
    }

    setFlightPath(
      caseWindowLayerRef.current,
      'cases',
      caseWindowMotion,
      caseWindowMotionOrigin,
    )
    setFlightPath(
      operationWindowLayerRef.current,
      'operation',
      operationWindowMotion,
      operationWindowMotionOrigin,
    )
    setFlightPath(
      miniGameLayerRef.current,
      'whack',
      miniGameMotion,
      miniGameMotionOrigin,
    )
  }, [
    caseWindowMotion,
    caseWindowMotionOrigin,
    operationWindowMotion,
    operationWindowMotionOrigin,
    miniGameMotion,
    miniGameMotionOrigin,
  ])

  // Look up the single bgMusic settings node from the saved graph (if any).
  // It's a standalone node — no walker edges. The runtime plays its
  // track on loop behind every screen except the win-result screen.
  const bgMusicNode: BgMusicFlowNode | null = useMemo(() => {
    return nodes.find((n): n is BgMusicFlowNode => n.type === 'bgMusic') ?? null
  }, [nodes])

  // Visibility of the bg-music volume widget. Hidden by default; the
  // desktop Start button toggles it. The underlying audio keeps playing
  // either way — only the on-screen control flips.
  const [volumeControlVisible, setVolumeControlVisible] = useState(false)

  // One-shot: when the URL asks for a specific starting node, jump
  // the walker there. We only do this once (on mount); after that,
  // normal walker transitions take over.
  const didStartJumpRef = useRef(false)
  useEffect(() => {
    if (didStartJumpRef.current) return
    if (nodes.length === 0) return
    const { startCaseId, startOperationId } = startParams
    if (!startCaseId && !startOperationId) return
    let target: GameFlowNode | undefined
    if (startCaseId) {
      target = nodes.find(
        (n): n is CaseFlowNode => n.type === 'case' && n.data.caseId === startCaseId,
      )
    } else if (startOperationId) {
      target = nodes.find(
        (n): n is OperationFlowNode => n.type === 'operation' && n.data.operationId === startOperationId,
      )
    }
    if (target) {
      goTo(target.id)
      didStartJumpRef.current = true
    }
  }, [nodes, startParams, goTo])

  useEffect(() => {
    return () => {
      if (caseWindowMotionTimeoutRef.current != null) {
        window.clearTimeout(caseWindowMotionTimeoutRef.current)
      }
      if (operationWindowMotionTimeoutRef.current != null) {
        window.clearTimeout(operationWindowMotionTimeoutRef.current)
      }
      if (miniGameMotionTimeoutRef.current != null) {
        window.clearTimeout(miniGameMotionTimeoutRef.current)
      }
    }
  }, [])

  // A connected Points node is a transparent action. Guard the current
  // visit synchronously so React Strict Mode and unrelated re-renders cannot
  // award it twice; leaving the node arms it for a future loop visit.
  const processedPointsNodeRef = useRef<string | null>(null)
  useEffect(() => {
    if (currentNode?.type !== 'points') {
      processedPointsNodeRef.current = null
      return
    }
    if (processedPointsNodeRef.current === currentNode.id) return
    processedPointsNodeRef.current = currentNode.id
    const amount = Math.round(Number((currentNode as PointsFlowNode).data.amount) || 0)
    if (amount !== 0) {
      setAchievementsOpen(true)
      setFlowPoints((current) => current + amount)
      showPointPopup(amount, amount < 0 ? 'lose' : 'win', currentNode.id)
    }
    advance()
  }, [currentNode, advance])

  // Auto-skip everything except the player-facing node types.
  // `result` nodes still stop the walker when they are a 'win' so the
  // full-screen win overlay can render; 'lose' results are skipped past.
  // `operation` nodes stop the walker so the OperationWindow can render
  // and gate on the player flipping every toggle + clicking Arrest.
  useEffect(() => {
    if (!currentNode) return
    if (
      currentNode.type === 'message' ||
      currentNode.type === 'miniGame' ||
      currentNode.type === 'login' ||
      currentNode.type === 'case' ||
      currentNode.type === 'operation'
      || currentNode.type === 'secondArrest'
      || currentNode.type === 'ranking'
      || currentNode.type === 'points'
    ) return
    if (
      currentNode.type === 'result' &&
      (currentNode as ResultFlowNode).data.resultType === 'win'
    ) return
    advance()
  }, [currentNode, advance])

  const messageNode: MessageFlowNode | null =
    currentNode?.type === 'message' ? (currentNode as MessageFlowNode) : null
  const caseNode: CaseFlowNode | null =
    currentNode?.type === 'case' ? (currentNode as CaseFlowNode) : null
  const operationNode: OperationFlowNode | null =
    currentNode?.type === 'operation' ? (currentNode as OperationFlowNode) : null
  const secondArrestNode = currentNode?.type === 'secondArrest' ? currentNode : null

  // Per-operation counter state, keyed by operationId. Always
  // initialised from DEFAULT_OPERATION_V2_DATA.counters (all 0)
  // so the player starts every operation with every item at zero,
  // regardless of any counter state the editor's preview may
  // have persisted onto the node.
  const [operationCounters, setOperationCounters] = useState<
    Record<string, OperationCounters>
  >({})
  function changeOperationCounter(
    opId: string,
    key: OperationItemKey,
    value: number,
  ) {
    setOperationCounters((prev) => {
      const cur = prev[opId] ?? DEFAULT_OPERATION_V2_DATA.counters
      return { ...prev, [opId]: { ...cur, [key]: value } }
    })
  }

  // When the walker lands on an operation node, unlock the
  // desktop Operation icon so the player can open the window
  // themselves. We never auto-open: the player chooses when.
  useEffect(() => {
    if (operationNode) setOperationUnlocked(true)
  }, [operationNode])

  // Play the notification chime each time a NEW boss message appears.
  // Browsers block autoplay before any user interaction, so the first
  // play() may reject — that's fine, we swallow it silently.
  const triggerHeadId = triggerQueue[0] ?? null
  const triggerHeadNode = triggerHeadId
    ? nodes.find((node) => node.id === triggerHeadId) ?? null
    : null

  // Remember every trigger-fired message id as it actually appears, so
  // a future re-fire of the same trigger filters it out instead of
  // replaying the bubble the player already dismissed.
  useEffect(() => {
    if (!triggerHeadId || triggerHeadNode?.type !== 'message') return
    setShownTriggerMessageIds((prev) => {
      if (prev.has(triggerHeadId)) return prev
      const next = new Set(prev)
      next.add(triggerHeadId)
      return next
    })
  }, [triggerHeadId, triggerHeadNode])

  // When the walker lands on a message whose button opens the
  // Achievements window, pop the window AS the message appears — not
  // after the player clicks Next. The click handler still calls
  // `onOpenAchievements` as a no-op safety net.
  useEffect(() => {
    if (!messageNode) return
    if (messageNode.data.buttonLinkType !== 'achievements') return
    setAchievementsOpen(true)
  }, [messageNode])

  // Compute the case tab list for the Cases window. A tab is locked
  // unless either (a) it is the first case in `order`, (b) the previous
  // case (by order) has been completed, OR (c) the case has already been
  // reached in this session (through a message or direct editor preview).
  const tabs: CaseTab[] = useMemo(() => {
    return cases.map((c, i) => {
      const unlocked = isCaseUnlocked(
        cases,
        i,
        completedCaseIds,
        sessionUnlockedCaseIds,
      )
      const caseHasOperation = nodes.some(
        (node) => node.type === 'case'
          && (node as CaseFlowNode).data.caseId === c.caseId
          && !!(node as CaseFlowNode).data.hasOperation,
      )
      return {
        id: c.caseId,
        time: i === cases.length - 1
          ? formatCaseTimestamp(gameStartedAtRef.current)
          : caseWindowDataFor(c.caseId, nodes)?.createdAt ?? '',
        locked: !unlocked,
        solved: caseHasOperation
          ? completedOperationCaseIds.has(c.caseId)
          : caseDecisions[c.caseId] != null || completedCaseIds.has(c.caseId),
        operationPending: pendingOperationCaseId === c.caseId,
      }
    })
  }, [
    cases,
    caseDecisions,
    completedCaseIds,
    completedOperationCaseIds,
    sessionUnlockedCaseIds,
    nodes,
    pendingOperationCaseId,
  ])

  // Sticky case id — remembers the last case the walker visited so
  // the Cases window keeps showing it after the walker advances into
  // a downstream message / operation. Without this, the case window
  // would snap back to the first unlocked tab the instant the walker
  // leaves the case node, confusing the player.
  const [lastCaseId, setLastCaseId] = useState<string | null>(null)
  useEffect(() => {
    if (!caseNode) return
    const reachedCaseId = caseNode.data.caseId
    setLastCaseId(reachedCaseId)
    setSessionUnlockedCaseIds((current) => {
      if (current.has(reachedCaseId)) return current
      const next = new Set(current)
      next.add(reachedCaseId)
      return next
    })
  }, [caseNode])

  // Resolve which case body to display in the open window.
  // Priority: explicit tab selection → current flow case →
  // last walker case (sticky) → first unlocked.
  const activeCaseId: string | null = useMemo(() => {
    if (viewCaseId) return viewCaseId
    if (caseNode) return caseNode.data.caseId
    if (lastCaseId) return lastCaseId
    const firstUnlocked = tabs.find((t) => !t.locked)
    return firstUnlocked?.id ?? null
  }, [viewCaseId, caseNode, lastCaseId, tabs])

  const activeCaseData: CaseWindowData | null = useMemo(() => {
    if (!activeCaseId) return null
    return caseWindowDataFor(activeCaseId, nodes)
  }, [activeCaseId, nodes])

  // The case node whose body is currently displayed — used for trigger
  // lookups and the decision handlers. This is intentionally derived
  // from `activeCaseId` (what's open in the Cases window) rather than
  // the walker's current node, so tutorial flows can pause the walker
  // on a side message while the case stays interactive underneath.
  const activeCaseNode: CaseFlowNode | null = useMemo(() => {
    if (!activeCaseId) return null
    return (
      nodes.find(
        (n): n is CaseFlowNode => n.type === 'case' && n.data.caseId === activeCaseId,
      ) ?? null
    )
  }, [activeCaseId, nodes])

  useFlowAssetPreloader({
    nodes,
    edges,
    currentNodeId: currentNode?.id ?? null,
    additionalRootIds: [activeCaseNode?.id]
      .filter((id): id is string => typeof id === 'string'),
  })

  // A Second Arrest gate is a visible second decision point in the graph.
  // Clear the earlier case choice on entry so Arrest and Release are both
  // available again; Release can then loop back into this same gate.
  useEffect(() => {
    if (!secondArrestNode || !activeCaseId) return
    if (secondArrestNode.data.resetDecisionOnEnter === false) return
    setCaseDecisions((prev) => {
      if (prev[activeCaseId] == null) return prev
      const next = { ...prev }
      delete next[activeCaseId]
      return next
    })
  }, [activeCaseId, secondArrestNode])

  const activelyViewedCaseId =
    caseWindowOpen
    && !caseWindowMinimized
    && foregroundDesktopApp === 'cases'
      ? activeCaseId
      : null

  useEffect(() => {
    if (!activelyViewedCaseId) return
    resumeCaseTimer(caseTimersRef.current, activelyViewedCaseId, performance.now())
    if (caseAttemptRef.current[activelyViewedCaseId] == null) {
      caseAttemptRef.current[activelyViewedCaseId] = 1
    }
    return () => {
      pauseCaseTimer(caseTimersRef.current, activelyViewedCaseId, performance.now())
    }
  }, [activelyViewedCaseId])

  const rankingNode = nodes.find((node): node is RankingFlowNode => node.type === 'ranking')
  const scoringNode = nodes.find((node) => node.type === 'scoring')
  const scoringData = scoringNode?.data ?? rankingNode?.data
  const scoringSettings: ScoringSettings = scoringData ? {
    winningTarget: Number(scoringData.winningTarget ?? DEFAULT_SCORING_SETTINGS.winningTarget),
    normalFirstPoints: Number(scoringData.normalFirstPoints ?? DEFAULT_SCORING_SETTINGS.normalFirstPoints),
    normalSecondPoints: Number(scoringData.normalSecondPoints ?? DEFAULT_SCORING_SETTINGS.normalSecondPoints),
    importantFirstPoints: Number(scoringData.importantFirstPoints ?? DEFAULT_SCORING_SETTINGS.importantFirstPoints),
    importantSecondPoints: Number(scoringData.importantSecondPoints ?? DEFAULT_SCORING_SETTINGS.importantSecondPoints),
    speedBonusEnabled: Boolean(scoringData.speedBonusEnabled ?? DEFAULT_SCORING_SETTINGS.speedBonusEnabled),
    speedTimeLimitSeconds: Number(scoringData.speedTimeLimitSeconds ?? DEFAULT_SCORING_SETTINGS.speedTimeLimitSeconds),
    speedMaxBonus: Number(scoringData.speedMaxBonus ?? DEFAULT_SCORING_SETTINGS.speedMaxBonus),
  } : DEFAULT_SCORING_SETTINGS

  useEffect(() => {
    if (currentNode?.type !== 'result') return
    const result = currentNode as ResultFlowNode
    if (result.data.resultType === 'win') return
    const caseId = result.data.caseId || lastCaseId
    if (!caseId) return
    if (pointsControlledCaseIdsRef.current.has(caseId)) return
    const scoredCase = nodes.find((node): node is CaseFlowNode => node.type === 'case' && node.data.caseId === caseId)
    if (!scoredCase) return
    if (scoreByCase[caseId]) return
    const breakdown = calculateCaseScore({
      caseData: scoredCase.data,
      correct: false,
      attempt: caseAttemptRef.current[caseId] ?? 1,
      elapsedSeconds: getCaseElapsedSeconds(caseTimersRef.current, caseId, performance.now()),
      settings: scoringSettings,
    })
    setAchievementsOpen(true)
    setScoreByCase((current) => recordCaseScore(current, breakdown))
    showPointPopup(breakdown.totalPoints, 'lose', caseId)
  }, [currentNode, lastCaseId, nodes, scoreByCase, scoringSettings])

  useEffect(() => () => {
    if (winAdvanceTimerRef.current != null) window.clearTimeout(winAdvanceTimerRef.current)
    if (pointPopupTimerRef.current != null) window.clearTimeout(pointPopupTimerRef.current)
  }, [])

  // Open the Cases window. Used by the desktop icon and by boss-message
  // 'case' / 'newCase' buttons. When `targetCaseId` is passed (only
  // 'newCase' does this today), the window opens with that case selected.
  // Defensive: callers wired into DOM `onClick` may pass an event as the
  // first arg — guard against non-string values so a click event never
  // ends up stored as `viewCaseId`.
  const openCaseWindow = (targetCaseId?: string) => {
    if (caseWindowMotionTimeoutRef.current != null) {
      window.clearTimeout(caseWindowMotionTimeoutRef.current)
      caseWindowMotionTimeoutRef.current = null
    }
    if (typeof targetCaseId === 'string' && targetCaseId) {
      setSessionUnlockedCaseIds((current) => {
        if (current.has(targetCaseId)) return current
        const next = new Set(current)
        next.add(targetCaseId)
        return next
      })
      setViewCaseId(targetCaseId)
    } else {
      setViewCaseId(null) // resolve via priority again
    }
    setCaseWindowOpen(true)
    setCaseWindowMinimized(false)
    setForegroundDesktopApp('cases')

    // Tutorial messages sometimes select the next case while the Cases
    // window is already visible. In that situation, update the content in
    // place instead of replaying the restore animation (which looks like
    // the same window opens twice).
    if (caseWindowOpen && !caseWindowMinimized) {
      setCaseWindowMotion('idle')
      return
    }

    setCaseWindowMotionOrigin('desktop')
    setCaseWindowMotion('restoring')
    caseWindowMotionTimeoutRef.current = window.setTimeout(() => {
      setCaseWindowMotion('idle')
      caseWindowMotionTimeoutRef.current = null
    }, WINDOW_MOTION_MS)
  }

  const minimizeCaseWindow = () => {
    if (caseWindowMotionTimeoutRef.current != null) {
      window.clearTimeout(caseWindowMotionTimeoutRef.current)
    }
    setCaseWindowMotionOrigin('taskbar')
    setCaseWindowMotion('minimizing')
    caseWindowMotionTimeoutRef.current = window.setTimeout(() => {
      setCaseWindowMinimized(true)
      setForegroundDesktopApp((current) => current === 'cases' ? null : current)
      setCaseWindowMotion('idle')
      caseWindowMotionTimeoutRef.current = null
    }, WINDOW_MOTION_MS)
  }

  const restoreCaseWindow = () => {
    if (caseWindowMotionTimeoutRef.current != null) {
      window.clearTimeout(caseWindowMotionTimeoutRef.current)
    }
    setCaseWindowOpen(true)
    setCaseWindowMinimized(false)
    setForegroundDesktopApp('cases')
    setCaseWindowMotionOrigin('taskbar')
    setCaseWindowMotion('restoring')
    caseWindowMotionTimeoutRef.current = window.setTimeout(() => {
      setCaseWindowMotion('idle')
      caseWindowMotionTimeoutRef.current = null
    }, WINDOW_MOTION_MS)
  }

  const openOperationWindow = () => {
    if (operationWindowMotionTimeoutRef.current != null) {
      window.clearTimeout(operationWindowMotionTimeoutRef.current)
    }
    setOperationWindowOpen(true)
    setOperationWindowMinimized(false)
    setForegroundDesktopApp('operation')
    setOperationWindowMotionOrigin('desktop')
    setOperationWindowMotion('restoring')
    operationWindowMotionTimeoutRef.current = window.setTimeout(() => {
      setOperationWindowMotion('idle')
      operationWindowMotionTimeoutRef.current = null
    }, WINDOW_MOTION_MS)
  }

  const minimizeOperationWindow = () => {
    if (operationWindowMotionTimeoutRef.current != null) {
      window.clearTimeout(operationWindowMotionTimeoutRef.current)
    }
    setOperationWindowMotionOrigin('taskbar')
    setOperationWindowMotion('minimizing')
    operationWindowMotionTimeoutRef.current = window.setTimeout(() => {
      setOperationWindowMinimized(true)
      setForegroundDesktopApp((current) => (
        current === 'operation'
          ? caseWindowOpen && !caseWindowMinimized ? 'cases' : null
          : current
      ))
      setOperationWindowMotion('idle')
      operationWindowMotionTimeoutRef.current = null
    }, WINDOW_MOTION_MS)
  }

  const restoreOperationWindow = () => {
    if (operationWindowMotionTimeoutRef.current != null) {
      window.clearTimeout(operationWindowMotionTimeoutRef.current)
    }
    setOperationWindowOpen(true)
    setOperationWindowMinimized(false)
    setForegroundDesktopApp('operation')
    setOperationWindowMotionOrigin('taskbar')
    setOperationWindowMotion('restoring')
    operationWindowMotionTimeoutRef.current = window.setTimeout(() => {
      setOperationWindowMotion('idle')
      operationWindowMotionTimeoutRef.current = null
    }, WINDOW_MOTION_MS)
  }

  /**
   * Run `action` immediately if `ids` is empty/undefined; otherwise
   * queue the messages and defer `action` until the queue drains.
   * Stable identity (used as a CaseWindow prop).
   */
  const runWithTrigger = useCallback(
    (
      result: { ids: string[]; delaySeconds: number } | undefined,
      action: () => void,
    ) => {
      const ids = result?.ids ?? []
      if (ids.length === 0) {
        action()
        return
      }
      pendingActionRef.current = action
      const ms = Math.max(0, (result?.delaySeconds ?? 0) * 1000)
      if (ms > 0) {
        window.setTimeout(() => setTriggerQueue(ids), ms)
      } else {
        setTriggerQueue(ids)
      }
    },
    [],
  )

  const triggerHead: MessageFlowNode | null = triggerHeadNode?.type === 'message'
    ? triggerHeadNode as MessageFlowNode
    : null
  const visibleTriggerHead = useDelayedMessage(triggerHead)
  const visibleMessageNode = useDelayedMessage(messageNode)
  const visibleMessageNodeId = visibleMessageNode?.id ?? null
  const visibleTriggerHeadId = visibleTriggerHead?.id ?? null

  // Play the notification only when the delayed card actually appears,
  // so the sound and visual stay synchronized for every message path.
  useEffect(() => {
    const visibleId = visibleTriggerHeadId ?? visibleMessageNodeId
    if (!visibleId) return
    const audio = new Audio(assetUrl('/sounds/notification.mp3'))
    audio.play().catch(() => { /* autoplay blocked — ignore */ })
  }, [visibleMessageNodeId, visibleTriggerHeadId])

  // Points nodes in a trigger side-chain apply without moving the main
  // walker, then replace themselves with the next supported side node.
  const processedTriggerPointsRef = useRef<string | null>(null)
  useEffect(() => {
    if (triggerHeadNode?.type !== 'points') {
      processedTriggerPointsRef.current = null
      return
    }
    if (processedTriggerPointsRef.current === triggerHeadNode.id) return
    processedTriggerPointsRef.current = triggerHeadNode.id
    const amount = Math.round(Number((triggerHeadNode as PointsFlowNode).data.amount) || 0)
    if (amount !== 0) {
      setAchievementsOpen(true)
      setFlowPoints((current) => current + amount)
      showPointPopup(amount, amount < 0 ? 'lose' : 'win', triggerHeadNode.id)
    }
    const nextId = findNextFrom(triggerHeadNode.id)
    const nextNode = nextId ? nodes.find((node) => node.id === nextId) : null
    setTriggerQueue((queue) => {
      const rest = queue.slice(1)
      return nextNode && (nextNode.type === 'message' || nextNode.type === 'points')
        && !rest.includes(nextNode.id)
        ? [nextNode.id, ...rest]
        : rest
    })
  }, [triggerHeadNode, nodes])

  // If the queue head points at a missing/unsupported id, skip past it
  // so the queue can drain instead of getting stuck.
  useEffect(() => {
    if (triggerQueue.length > 0 && !triggerHeadNode) {
      setTriggerQueue((q) => q.slice(1))
    }
  }, [triggerHeadNode, triggerQueue.length])

  // When the queue empties, fire whatever click action was deferred.
  // Runs once per drain (the ref is cleared immediately).
  useEffect(() => {
    if (triggerQueue.length === 0 && pendingActionRef.current) {
      const action = pendingActionRef.current
      pendingActionRef.current = null
      action()
    }
  }, [triggerQueue.length])

  /**
   * Walk the graph to collect message-node ids fired by a player
   * choice on the given case. Path:
   *   case --(sourceHandle: 'trigger')--> Trigger node --> Message node
   * Filters Trigger nodes by `triggerType` (and `targetRowId` for
   * row-based triggers). Returns an empty array if nothing matches —
   * which makes `runWithTrigger` run the action immediately.
   */
  const findTriggerMessageIds = useCallback(
    (
      caseNodeId: string,
      triggerType: TriggerType,
      rowId?: string,
    ): { ids: string[]; delaySeconds: number } => {
      const triggerEdges = edges.filter(
        (e: GameFlowEdge) => e.source === caseNodeId && e.sourceHandle === 'trigger',
      )
      const ids: string[] = []
      let delaySeconds = 0
      for (const tEdge of triggerEdges) {
        const tNode = nodes.find(
          (n: GameFlowNode): n is TriggerFlowNode =>
            n.id === tEdge.target && n.type === 'trigger',
        )
        if (!tNode) continue
        if (tNode.data.triggerType !== triggerType) continue
        if (rowId && tNode.data.targetRowId !== rowId) continue
        const d = tNode.data.delaySeconds ?? 0
        if (d > delaySeconds) delaySeconds = d
        // Follow each outgoing edge from the trigger node to a message or
        // transparent Points node. Subsequent nodes are resolved as the
        // side queue advances.
        // Skip messages the player has already seen in this session so a
        // repeat trigger doesn't re-show the same bubble.
        for (const out of edges.filter((e) => e.source === tNode.id)) {
          const targetNode = nodes.find((n) => n.id === out.target)
          if (targetNode?.type === 'points') ids.push(targetNode.id)
          if (targetNode?.type === 'message' && !shownTriggerMessageIds.has(targetNode.id)) {
            ids.push(targetNode.id)
          }
        }
      }
      return { ids, delaySeconds }
    },
    [nodes, edges, shownTriggerMessageIds],
  )

  /** Bridge from CaseWindow's `onRowTrigger` to the graph lookup.
   *  Resolves the case via `activeCaseNode` (the open case window),
   *  not the walker's current node — tutorial flows often park the
   *  walker on a side message while the case stays interactive.
   *
   *  Row triggers run the row action IMMEDIATELY (so the row visibly
   *  expands or the attachment popup opens) and queue the tutorial
   *  message alongside, instead of deferring the action until the
   *  queue drains. This matches the intent of teaching prompts that
   *  comment on what the player just did. */
  const onRowTrigger = useCallback(
    (action: 'expand' | 'attachment', rowId: string, thenRun: () => void) => {
      thenRun()
      if (!activeCaseNode) return
      const triggerType: TriggerType = action === 'expand' ? 'expandRow' : 'attachmentRow'
      const { ids, delaySeconds } = findTriggerMessageIds(activeCaseNode.id, triggerType, rowId)
      // Replace (not append) so a follow-up player action dismisses the
      // previous tutorial bubble — e.g. clicking the attachment hides the
      // "Don't forget to check the attachment" prompt that just told them
      // to do it. If the new action has no triggers, clear the queue too.
      const ms = Math.max(0, delaySeconds * 1000)
      if (ids.length > 0 && ms > 0) {
        setTriggerQueue([])
        window.setTimeout(() => setTriggerQueue(ids), ms)
      } else {
        setTriggerQueue(ids)
      }
    },
    [activeCaseNode, findTriggerMessageIds],
  )

  // Persistent bg-music widget — rendered alongside the login screen,
  // the desktop, and the win-result return so the background track
  // keeps playing through the whole game. The audio element itself is
  // a module-level singleton inside BgMusicPlayer, so unmount/remount
  // across these returns doesn't restart the track.
  const bgMusic = bgMusicNode ? (
    <BgMusicPlayer
      src={bgMusicNode.data.src}
      srcCustom={bgMusicNode.data.srcCustom}
      defaultVolume={bgMusicNode.data.volume}
      showControl={volumeControlVisible}
    />
  ) : null

  // Decision handlers — driven by the open case window, not the
  // walker's current node. The walker may be parked on a tutorial
  // message upstream of the case; in that case Arrest/Release jumps
  // the walker via `goTo` along the case node's matching handle.
  const canDecide = !!activeCaseNode
  /** True when the case has any matching trigger with retry=true. */
  const hasRetryTrigger = (caseNodeId: string, triggerType: TriggerType) => {
    const triggerEdges = edges.filter(
      (e) => e.source === caseNodeId && e.sourceHandle === 'trigger',
    )
    return triggerEdges.some((tEdge) => {
      const tNode = nodes.find(
        (n): n is TriggerFlowNode => n.id === tEdge.target && n.type === 'trigger',
      )
      return !!tNode && tNode.data.triggerType === triggerType && tNode.data.retry === true
    })
  }
  const hasRestoreArrestButtonTrigger = (caseNodeId: string) => {
    const triggerEdges = edges.filter(
      (e) => e.source === caseNodeId && e.sourceHandle === 'trigger',
    )
    return triggerEdges.some((tEdge) => {
      const tNode = nodes.find(
        (n): n is TriggerFlowNode => n.id === tEdge.target && n.type === 'trigger',
      )
      return !!tNode
        && tNode.data.triggerType === 'arrest'
        && tNode.data.restoreArrestButton === true
    })
  }
  const isIncorrectDecision = (caseNode: CaseFlowNode, triggerType: TriggerType) => {
    if (hasRetryTrigger(caseNode.id, triggerType)) return true
    const decisionEdge = edges.find(
      (edge) => edge.source === caseNode.id && edge.sourceHandle === triggerType,
    )
    const targetNode = decisionEdge
      ? nodes.find((node) => node.id === decisionEdge.target)
      : null
    return targetNode?.type === 'message' && targetNode.data.messageType === 'voice'
      || targetNode?.type === 'trigger' && targetNode.data.retry === true
  }
  /** Find the next walker node along a specific source handle from
   *  any source id. Mirrors useGameFlow's internal lookup but lets us
   *  jump from a case node even when the walker isn't currently on it.
   *
   *  Strict on `sourceHandle`: an Arrest / Release click that doesn't
   *  match a handle-specific edge returns null instead of falling
   *  through to the first outgoing edge, which would otherwise route
   *  both decisions to the same target whenever an edge was wired
   *  without latching onto the arrest/release dot. */
  const findNextFrom = (sourceId: string, sourceHandle?: string): string | null => {
    const walkerEdges = edges.filter((e) => e.sourceHandle !== 'trigger')
    if (sourceHandle) {
      const exact = walkerEdges.find(
        (e) => e.source === sourceId && e.sourceHandle === sourceHandle,
      )
      if (exact) return exact.target
      if (typeof console !== 'undefined') {
        console.warn(
          `[GamePage] No edge from "${sourceId}" with sourceHandle="${sourceHandle}". ` +
          `Player decision ignored. Check the editor wiring for this case node.`,
        )
      }
      return null
    }
    return walkerEdges.find((e) => e.source === sourceId)?.target ?? null
  }
  const nextCaseIdFrom = (sourceId: string): string | undefined => {
    const nextId = findNextFrom(sourceId)
    const nextNode = nextId ? nodes.find((node) => node.id === nextId) : null
    return nextNode?.type === 'case'
      ? (nextNode as CaseFlowNode).data.caseId
      : undefined
  }
  /** Wipe any lingering tutorial trigger overlay from a previous click
   *  so a fresh decision isn't blocked by a stale "I give you another
   *  chance" voice still sitting in the queue. The pending action from
   *  the prior runWithTrigger (e.g. the retry no-op) is dropped on the
   *  floor too — its purpose was tied to the now-superseded choice. */
  const clearPendingTrigger = () => {
    pendingActionRef.current = null
    pendingIncorrectCaseRef.current = null
    setTriggerQueue([])
  }
  const recordRankingBoundCase = (
    caseNode: CaseFlowNode,
    targetId: string | null,
    incorrect: boolean,
    usesPointsNode: boolean,
  ) => {
    if (
      incorrect
      || usesPointsNode
      || !pathReachesRankingWithoutResult(targetId, nodes, edges)
    ) return

    const caseId = caseNode.data.caseId
    const breakdown = calculateCaseScore({
      caseData: caseNode.data,
      correct: true,
      attempt: caseAttemptRef.current[caseId] ?? 1,
      elapsedSeconds: getCaseElapsedSeconds(caseTimersRef.current, caseId, performance.now()),
      settings: scoringSettings,
    })
    setAchievementsOpen(true)
    setScoreByCase((current) => {
      if (current[caseId]?.correct) return current
      const previous = current[caseId]
      return {
        ...current,
        [caseId]: previous ? combineRetryScore(previous, breakdown) : breakdown,
      }
    })
    showPointPopup(breakdown.totalPoints, 'win', `${caseId}-ranking`)
  }
  const onArrest = () => {
    if (!activeCaseNode) return
    if (secondArrestNode) {
      clearPendingTrigger()
      const targetId = findNextFrom(secondArrestNode.id, 'arrest')
      if (targetId) goTo(targetId)
      return
    }
    const caseId = activeCaseNode.data.caseId
    freezeCaseTimer(caseTimersRef.current, caseId, performance.now())
    clearPendingTrigger()
    const retry = hasRetryTrigger(activeCaseNode.id, 'arrest')
    const incorrect = isIncorrectDecision(activeCaseNode, 'arrest')
    const decisionTargetId = findNextFrom(activeCaseNode.id, 'arrest')
    const usesPointsNode = pathContainsPointsNode(decisionTargetId, nodes, edges)
    if (usesPointsNode) pointsControlledCaseIdsRef.current.add(caseId)
    if (incorrect && !usesPointsNode) pendingIncorrectCaseRef.current = activeCaseNode
    const continueOnly = activeCaseNode.data.arrestContinuesWithoutDecision === true
    const restoreArrestButton = hasRestoreArrestButtonTrigger(activeCaseNode.id)
    // On a retry-arrest trigger we never lock the decision — the pill
    // would otherwise flash "Arrested" while the boss scolds the player.
    if (!retry && !continueOnly) {
      setCaseDecisions((prev) => ({ ...prev, [caseId]: 'arrested' }))
      if (activeCaseNode.data.hasOperation) setPendingOperationCaseId(caseId)
    }
    runWithTrigger(findTriggerMessageIds(activeCaseNode.id, 'arrest'), () => {
      if (retry) {
        caseAttemptRef.current[caseId] = 2
        return
      }
      if (restoreArrestButton) {
        setCaseDecisions((prev) => {
          const next = { ...prev }
          delete next[caseId]
          return next
        })
      }
      recordRankingBoundCase(activeCaseNode, decisionTargetId, incorrect, usesPointsNode)
      if (decisionTargetId) goTo(decisionTargetId)
    })
  }
  const onRelease = () => {
    if (!activeCaseNode) return
    if (secondArrestNode) {
      clearPendingTrigger()
      const targetId = findNextFrom(secondArrestNode.id, 'release')
      if (targetId) goTo(targetId)
      return
    }
    const caseId = activeCaseNode.data.caseId
    freezeCaseTimer(caseTimersRef.current, caseId, performance.now())
    clearPendingTrigger()
    const retry = hasRetryTrigger(activeCaseNode.id, 'release')
    const incorrect = isIncorrectDecision(activeCaseNode, 'release')
    const decisionTargetId = findNextFrom(activeCaseNode.id, 'release')
    const usesPointsNode = pathContainsPointsNode(decisionTargetId, nodes, edges)
    if (usesPointsNode) pointsControlledCaseIdsRef.current.add(caseId)
    if (incorrect && !usesPointsNode) pendingIncorrectCaseRef.current = activeCaseNode
    if (!retry) {
      setCaseDecisions((prev) => ({ ...prev, [caseId]: 'released' }))
      if (activeCaseNode.data.hasOperation) setPendingOperationCaseId(caseId)
    }
    runWithTrigger(findTriggerMessageIds(activeCaseNode.id, 'release'), () => {
      if (retry) {
        caseAttemptRef.current[caseId] = 2
        return
      }
      recordRankingBoundCase(activeCaseNode, decisionTargetId, incorrect, usesPointsNode)
      if (decisionTargetId) goTo(decisionTargetId)
    })
  }

  function recordIncorrectChoice(caseNode: CaseFlowNode) {
    const caseId = caseNode.data.caseId
    if (lossAwardedCaseIdsRef.current.has(caseId)) return
    lossAwardedCaseIdsRef.current.add(caseId)
    const breakdown = calculateCaseScore({
      caseData: caseNode.data,
      correct: false,
      attempt: caseAttemptRef.current[caseId] ?? 1,
      elapsedSeconds: getCaseElapsedSeconds(caseTimersRef.current, caseId, performance.now()),
      settings: scoringSettings,
    })
    setAchievementsOpen(true)
    setScoreByCase((current) => recordCaseScore(current, breakdown))
    showPointPopup(breakdown.totalPoints, 'lose', `${caseId}-incorrect`)
  }

  function showPointPopup(points: number, kind: 'win' | 'lose' | 'time', key: string) {
    if (pointPopupTimerRef.current != null) {
      window.clearTimeout(pointPopupTimerRef.current)
    }
    const id = `${key}-${Date.now()}`
    setPointPopup({ id, points, kind })
    pointPopupTimerRef.current = window.setTimeout(() => {
      setPointPopup((current) => current?.id === id ? null : current)
      pointPopupTimerRef.current = null
    }, 1400)
  }

  function flushPendingIncorrectChoice() {
    const pendingCase = pendingIncorrectCaseRef.current
    if (!pendingCase) return
    pendingIncorrectCaseRef.current = null
    recordIncorrectChoice(pendingCase)
  }

  // Per-slot outcomes for the achievements panel, in case-order.
  const achievementsResults: CaseOutcome[] = cases.map(
    (c) => caseResults.get(c.caseId) ?? null,
  )
  const runScore = useMemo(
    () => buildRunScore(
      Object.values(scoreByCase),
      scoringSettings.winningTarget,
      miniGamePoints,
      flowPoints,
    ),
    [flowPoints, miniGamePoints, scoreByCase, scoringSettings.winningTarget],
  )
  const totalScore = runScore.total

  const openCasualMiniGame = () => {
    miniGameContinueRef.current = null
    miniGameContinueOnCloseRef.current = false
    setMiniGameScoringSession(false)
    setMiniGameOpen(true)
    setMiniGameMinimized(false)
    setMiniGameMotionOrigin('desktop')
    setMiniGameMotion('restoring')
    if (miniGameMotionTimeoutRef.current != null) window.clearTimeout(miniGameMotionTimeoutRef.current)
    miniGameMotionTimeoutRef.current = window.setTimeout(() => {
      setMiniGameMotion('idle')
      miniGameMotionTimeoutRef.current = null
    }, WINDOW_MOTION_MS)
  }

  const openScoringMiniGame = (onContinue: () => void, continueOnClose = false) => {
    miniGameContinueRef.current = onContinue
    miniGameContinueOnCloseRef.current = continueOnClose
    setMiniGameScoringSession(true)
    setMiniGameOpen(true)
    setMiniGameMinimized(false)
    setMiniGameMotionOrigin('desktop')
    setMiniGameMotion('restoring')
    if (miniGameMotionTimeoutRef.current != null) window.clearTimeout(miniGameMotionTimeoutRef.current)
    miniGameMotionTimeoutRef.current = window.setTimeout(() => {
      setMiniGameMotion('idle')
      miniGameMotionTimeoutRef.current = null
    }, WINDOW_MOTION_MS)
  }

  // A message can explicitly open a mini-game and also point at a miniGame
  // graph node. In that shape the window already represents that node, so
  // exiting must continue from the node rather than land on it and reopen
  // the same window a second time.
  const openMessageMiniGame = (sourceId: string, onContinue: () => void) => {
    const linkedNodeId = findNextFrom(sourceId)
    const linkedNode = linkedNodeId
      ? nodes.find((node) => node.id === linkedNodeId)
      : null
    const followingNodeId = linkedNode?.type === 'miniGame'
      ? findNextFrom(linkedNode.id)
      : null

    openScoringMiniGame(
      followingNodeId ? () => goTo(followingNodeId) : onContinue,
      true,
    )
  }

  const bankMiniGameScore = ({ score, started }: { score: number; started: boolean }) => {
    if (!miniGameScoringSession || !started) return
    const points = Math.max(0, Math.round(score))
    setMiniGamePoints(points)
    showPointPopup(points, 'win', 'mini-game')
  }

  const closeMiniGame = (result: { score: number; started: boolean }) => {
    bankMiniGameScore(result)
    const continueFlow = miniGameContinueOnCloseRef.current ? miniGameContinueRef.current : null
    if (continueFlow) miniGameNodeExitingRef.current = true
    setMiniGameOpen(false)
    setMiniGameMinimized(false)
    setMiniGameScoringSession(false)
    miniGameContinueRef.current = null
    miniGameContinueOnCloseRef.current = false
    continueFlow?.()
  }

  const continueFromMiniGame = (result: { score: number; started: boolean }) => {
    bankMiniGameScore(result)
    const continueFlow = miniGameContinueRef.current
    if (continueFlow) miniGameNodeExitingRef.current = true
    setMiniGameOpen(false)
    setMiniGameMinimized(false)
    setMiniGameScoringSession(false)
    miniGameContinueRef.current = null
    miniGameContinueOnCloseRef.current = false
    continueFlow?.()
  }

  useEffect(() => {
    if (currentNode?.type !== 'miniGame') {
      miniGameNodeExitingRef.current = false
      return
    }
    if (miniGameOpen || miniGameNodeExitingRef.current) return
    openScoringMiniGame(advance, true)
  }, [currentNode, miniGameOpen, advance])

  const restoreMiniGame = () => {
    setMiniGameMinimized(false)
    setMiniGameMotionOrigin('taskbar')
    setMiniGameMotion('restoring')
    if (miniGameMotionTimeoutRef.current != null) window.clearTimeout(miniGameMotionTimeoutRef.current)
    miniGameMotionTimeoutRef.current = window.setTimeout(() => {
      setMiniGameMotion('idle')
      miniGameMotionTimeoutRef.current = null
    }, WINDOW_MOTION_MS)
  }

  const minimizeMiniGame = () => {
    if (miniGameMotionTimeoutRef.current != null) {
      window.clearTimeout(miniGameMotionTimeoutRef.current)
    }
    setMiniGameMotionOrigin('taskbar')
    setMiniGameMotion('minimizing')
    miniGameMotionTimeoutRef.current = window.setTimeout(() => {
      setMiniGameMinimized(true)
      setMiniGameMotion('idle')
      miniGameMotionTimeoutRef.current = null
    }, WINDOW_MOTION_MS)
  }

  const taskbarApps = useMemo<TaskbarApp[]>(() => {
    const apps: TaskbarApp[] = []
    if (caseWindowOpen && activeCaseData) {
      apps.push({
        id: 'cases',
        label: 'Cases',
        onClick: restoreCaseWindow,
      })
    }
    if (operationWindowOpen) {
      apps.push({
        id: 'operation',
        label: 'Operation',
        onClick: restoreOperationWindow,
      })
    }
    if (miniGameOpen) {
      apps.push({
        id: 'whack',
        label: 'Mini Game',
        onClick: restoreMiniGame,
      })
    }
    return apps
  }, [activeCaseData, caseWindowOpen, miniGameOpen, operationWindowOpen, miniGameMinimized])

  // While the flow sits on a login node, render the LoginScreen as a
  // full-screen step. Submitting follows the node's outgoing edge.
  if (isLoading) {
    return <div ref={scaleRef} className={styles.canvas} data-scaled-stage />
  }

  if (currentNode?.type === 'login') {
    return (
      <>
        <div ref={scaleRef} className={styles.canvas} data-scaled-stage>
          <LoginScreen
            onLogin={(profile) => { setPlayerProfile(profile); advance() }}
          />
          {restartDialog}
          {bgMusic}
        </div>
      </>
    )
  }

  if (currentNode?.type === 'ranking') {
    return <div ref={scaleRef} className={styles.canvas} data-scaled-stage><RankingPage profile={playerProfile} run={runScore} publicationKey={publicationKeyRef.current} /></div>
  }

  // Walker is on a win-result — keep the desktop visible behind the
  // centered win window, then let Next advance along the result edge.
  if (
    currentNode?.type === 'result' &&
    (currentNode as ResultFlowNode).data.resultType === 'win'
  ) {
    const resultData = (currentNode as ResultFlowNode).data
    const winImage = resultData.winImage as WinVariant | undefined
    const winImageCustom = resultData.winImageCustom
    const winImageCustomId = resultData.winImageCustomId
    const winSound = resultData.winSound
    const winSoundCustom = resultData.winSoundCustom
    const winSoundCustomId = resultData.winSoundCustomId
    const winTitle = resultData.winTitle
    const winFooterText = resultData.winFooterText
    const winCtaLabel = resultData.winCtaLabel
    const awardWinAndAdvance = () => {
      if (winAdvancePendingRef.current) return
      const caseId = resultData.caseId || lastCaseId
      if (caseId && pointsControlledCaseIdsRef.current.has(caseId)) {
        advance()
        return
      }
      const scoredCase = nodes.find((node): node is CaseFlowNode => node.type === 'case' && node.data.caseId === caseId)
      if (!caseId || !scoredCase) {
        advance()
        return
      }
      const existingScore = scoreByCase[caseId]
      if (existingScore?.correct) {
        advance()
        return
      }
      winAdvancePendingRef.current = true
      const breakdown = calculateCaseScore({
        caseData: scoredCase.data,
        correct: true,
        attempt: caseAttemptRef.current[caseId] ?? 1,
        elapsedSeconds: getCaseElapsedSeconds(caseTimersRef.current, caseId, performance.now()),
        settings: scoringSettings,
      })
      setScoreByCase((current) => {
        if (current[caseId]?.correct) return current
        const previous = current[caseId]
        return {
          ...current,
          [caseId]: previous ? combineRetryScore(previous, breakdown) : breakdown,
        }
      })
      setPointPopup({ id: `${caseId}-${Date.now()}`, points: breakdown.totalPoints, kind: 'win' })
      winAdvanceTimerRef.current = window.setTimeout(() => {
        winAdvancePendingRef.current = false
        setPointPopup(null)
        advance()
      }, 1400)
    }
    return (
      <>
        <div ref={scaleRef} className={styles.canvas} data-scaled-stage>
          <Desktop
            onCasesClick={openCaseWindow}
            onOperationClick={() => {
              if (operationUnlocked) {
                openOperationWindow()
              } else {
                setForegroundDesktopApp('operation')
                setOperationLockedScreenOpen(true)
              }
            }}
            onStartClick={() => setVolumeControlVisible((v) => !v)}
            onWhackClick={openCasualMiniGame}
          >
            <WinScreenStop
              variant={winImage}
              src={winImageCustom}
              imageBlobId={winImageCustomId}
              soundId={winSound}
              soundSrc={winSoundCustom}
              soundBlobId={winSoundCustomId}
              winTitle={winTitle}
              winFooterText={winFooterText}
              winCtaLabel={winCtaLabel}
              onNext={awardWinAndAdvance}
            />
            <div className={`${styles.achievementsLayer} ${styles.winAchievementsLayer}`}>
              <AchievementsWindow
                results={achievementsResults}
                total={totalScore}
                winningTarget={scoringSettings.winningTarget}
                pointPopup={pointPopup}
              />
            </div>
          </Desktop>
          {restartDialog}
          {bgMusic}
        </div>
      </>
    )
  }

  // Same precedence as the BossMessage stacking below: a trigger-queue
  // tutorial message wins over the walker's current message.
  const activeTutorialMsg =
    (visibleTriggerHead?.data.isTutorial ? visibleTriggerHead : null)
    ?? (visibleMessageNode?.data.isTutorial ? visibleMessageNode : null)
  const activeTutorialTargetId = activeTutorialMsg?.data.spotlightTargetId
  const caseWindowHighlightTarget = isCaseWindowHighlightTarget(activeTutorialTargetId)
    ? activeTutorialTargetId
    : undefined

  return (
    <>
    <div ref={scaleRef} className={styles.canvas} data-scaled-stage>
    <Desktop
      onCasesClick={openCaseWindow}
      onOperationClick={() => {
        if (operationUnlocked) {
          openOperationWindow()
        } else {
          setForegroundDesktopApp('operation')
          setOperationLockedScreenOpen(true)
        }
      }}
      onStartClick={() => setVolumeControlVisible((v) => !v)}
      onWhackClick={openCasualMiniGame}
      taskbarApps={taskbarApps}
      tutorialOverlay={(() => {
        if (!activeTutorialMsg || caseWindowHighlightTarget) return null
        return (
          <TutorialSpotlight
            key={activeTutorialMsg.id}
            targetId={activeTutorialTargetId}
          />
        )
      })()}
    >
      {caseWindowOpen && !caseWindowMinimized && activeCaseData && (
        <div
          ref={caseWindowLayerRef}
          className={[
            styles.caseLayer,
            activeTutorialMsg ? styles.tutorialColorLayer : '',
            caseWindowMotion === 'minimizing'
              ? styles.windowMinimizing
              : caseWindowMotion === 'restoring'
              ? styles.windowRestoring
              : '',
          ].filter(Boolean).join(' ')}
        >
          <CaseWindow
            data={activeCaseData}
            draggable
            tabs={tabs}
            onTabSelect={(caseId) => setViewCaseId(caseId)}
            onArrest={canDecide ? onArrest : undefined}
            onRelease={canDecide ? onRelease : undefined}
            decision={activeCaseId ? caseDecisions[activeCaseId] ?? null : null}
            onClose={() => {
              setCaseWindowOpen(false)
              setCaseWindowMinimized(false)
              setForegroundDesktopApp((current) => current === 'cases' ? null : current)
              setCaseWindowMotion('idle')
            }}
            onMinimizeChange={(minimized) => {
              if (minimized) minimizeCaseWindow()
              else restoreCaseWindow()
            }}
            onRowTrigger={onRowTrigger}
            useCamera={!!activeCaseNode?.data.useCamera}
            highlightTargetId={caseWindowHighlightTarget}
          />
        </div>
      )}

      {/* Operation Window V2 — opened by the desktop icon (always),
          rendered with the walker's current operation-node data
          when the walker is on one. Arrest Arab inside the window
          advances the flow along the operation node's outgoing
          edge and closes the window; otherwise it's just a
          decorative preview that closes on click. Counters are
          always seeded to zero (DEFAULT_OPERATION_V2_DATA.counters)
          so the player starts fresh every time the window opens. */}
      {operationWindowOpen && !operationWindowMinimized && (() => {
        const opId = operationNode?.data.operationId ?? 'preview'
        const opData: OperationWindowV2Data = operationNode?.data.window
          ?? DEFAULT_OPERATION_V2_DATA
        const counters = operationCounters[opId] ?? DEFAULT_OPERATION_V2_DATA.counters
        const closeWindow = () => {
          setOperationWindowOpen(false)
          setOperationWindowMinimized(false)
          setForegroundDesktopApp((current) => (
            current === 'operation'
              ? caseWindowOpen && !caseWindowMinimized ? 'cases' : null
              : current
          ))
          setOperationWindowMotion('idle')
        }
        return (
          <div
            ref={operationWindowLayerRef}
            className={[
              styles.caseLayer,
              activeTutorialMsg ? styles.tutorialColorLayer : '',
              operationWindowMotion === 'minimizing'
                ? styles.windowMinimizing
                : operationWindowMotion === 'restoring'
                ? styles.windowRestoring
                : '',
            ].filter(Boolean).join(' ')}
          >
            <OperationWindowV2
              draggable
              data={{ ...opData, counters }}
              onChangeCounter={(key, value) => changeOperationCounter(opId, key, value)}
              onStartOperation={() => {
                const completedCaseId = operationNode?.data.caseId ?? pendingOperationCaseId
                if (completedCaseId) {
                  setCompletedOperationCaseIds((prev) => {
                    if (prev.has(completedCaseId)) return prev
                    const next = new Set(prev)
                    next.add(completedCaseId)
                    return next
                  })
                  setPendingOperationCaseId((pending) => (
                    pending === completedCaseId ? null : pending
                  ))
                }
                closeWindow()
                if (operationNode) advance()
              }}
              onClose={closeWindow}
              onMinimizeChange={(minimized) => {
                if (minimized) minimizeOperationWindow()
                else restoreOperationWindow()
              }}
            />
          </div>
        )
      })()}

      {achievementsOpen && (
        <div
          className={[
            styles.achievementsLayer,
            pointPopup ? styles.achievementsPopupLayer : '',
            activeTutorialMsg ? styles.tutorialColorLayer : '',
          ].filter(Boolean).join(' ')}
        >
          <AchievementsWindow
            results={achievementsResults}
            total={totalScore}
            winningTarget={scoringSettings.winningTarget}
            pointPopup={pointPopup}
            loopEntryFlicker={
              messageNode?.data.buttonLinkType === 'achievements'
            }
          />
        </div>
      )}

      {miniGameOpen && (
        <div
          ref={miniGameLayerRef}
          className={[
            styles.caseLayer,
            miniGameMinimized ? styles.windowHidden : '',
            activeTutorialMsg ? styles.tutorialTopColorLayer : '',
            miniGameMotion === 'minimizing'
              ? styles.windowMinimizing
              : miniGameMotion === 'restoring'
              ? styles.windowRestoring
              : '',
          ].filter(Boolean).join(' ')}
        >
          <WhackAMole
            draggable
            onClose={closeMiniGame}
            onContinue={miniGameScoringSession ? continueFromMiniGame : undefined}
            onMinimizeChange={(minimized) => {
              if (minimized) minimizeMiniGame()
              else restoreMiniGame()
            }}
            minimized={miniGameMinimized}
          />
        </div>
      )}

      {/* Operation locked-screen modal: the icon is always rendered
          clickable; if the boss flow hasn't unlocked operations yet,
          clicking shows this screen instead of opening the window. */}
      {operationLockedScreenOpen && (
        <OperationLockedScreen
          onClose={() => {
            setOperationLockedScreenOpen(false)
            setForegroundDesktopApp(
              caseWindowOpen && !caseWindowMinimized ? 'cases' : null,
            )
          }}
        />
      )}

      {/* Trigger-queue sidecar: messages fired by a tutorial trigger
          (Arrest / Release / suspicion expand / suspicion attachment).
          The walker's own message overlay is suppressed while the queue
          runs so two messages can't stack. */}
      {visibleTriggerHead && !(miniGameOpen && visibleTriggerHead.data.buttonLinkType === 'miniGame') && (
        <div className={styles.messageOverlay}>
          <BossMessageSlot
            key={visibleTriggerHead.id}
            data={visibleTriggerHead.data}
            nextCaseId={nextCaseIdFrom(visibleTriggerHead.id)}
            onAdvance={() => {
              // Decision-triggered losses are awarded as soon as the voice
              // finishes. A chained follow-up message may still open, but it
              // must not delay the score change or red points indicator.
              if (visibleTriggerHead.data.messageType === 'voice' && pendingActionRef.current) {
                flushPendingIncorrectChoice()
                const action = pendingActionRef.current
                pendingActionRef.current = null
                action()
              }
              // Follow the message's outgoing edge to a chained message
              // node, so Trigger → Voice → Text plays the whole chain
              // before the queue drains and the pending action fires.
              const nextId = findNextFrom(visibleTriggerHead.id)
              const isChainable =
                nextId != null &&
                nodes.some((n) => n.id === nextId && (n.type === 'message' || n.type === 'points'))
              setTriggerQueue((q) => {
                const rest = q.slice(1)
                return isChainable && !rest.includes(nextId!)
                  ? [nextId!, ...rest]
                  : rest
              })
            }}
            onOpenCases={openCaseWindow}
            onUnlockOperation={() => setOperationUnlocked(true)}
            onOpenAchievements={() => setAchievementsOpen(true)}
            onOpenMiniGame={(onContinue) => {
              openScoringMiniGame(onContinue, true)
            }}
          />
        </div>
      )}

      {/* Game-flow sidecar: only renders when the current node is a message.
          `key` resets drag state whenever a new message takes the slot, so
          each notification re-appears at its editor-defined locationX/Y. */}
      {visibleMessageNode && !triggerHead && !(miniGameOpen && visibleMessageNode.data.buttonLinkType === 'miniGame') && (
        <div className={styles.messageOverlay}>
          <BossMessageSlot
            key={visibleMessageNode.id}
            data={visibleMessageNode.data}
            nextCaseId={nextCaseIdFrom(visibleMessageNode.id)}
            onAdvance={() => {
              flushPendingIncorrectChoice()
              advance()
            }}
            onOpenCases={openCaseWindow}
            onUnlockOperation={() => setOperationUnlocked(true)}
            onOpenAchievements={() => setAchievementsOpen(true)}
            onOpenMiniGame={(onContinue) => {
              openMessageMiniGame(visibleMessageNode.id, onContinue)
            }}
          />
        </div>
      )}

      {/* Scheduled subtitles for the active voice message. The walker's
          message wins over a trigger-queue message (matches BossMessage
          stacking above). Subtitles auto-tick from when they mount, so
          we key on the node id to restart the timer per message. */}
      {(() => {
        const activeVoice = (visibleTriggerHead?.data.messageType === 'voice' ? visibleTriggerHead : null)
          ?? (visibleMessageNode?.data.messageType === 'voice' ? visibleMessageNode : null)
        if (!activeVoice) return null
        const cues = activeVoice.data.subtitles ?? []
        if (cues.length === 0) return null
        return (
          <Subtitles
            key={activeVoice.id}
            cues={cues}
            voiceDuration={activeVoice.data.voiceDuration}
          />
        )
      })()}
    </Desktop>
    {restartDialog}
    {bgMusic}
    </div>
    </>
  )
}

/** Windowed win stop. The `variant` selects which screen to render
 *  (set per result node in the editor). Plays the notification chime
 *  on mount, then lets the win screen's own controls advance the flow. */
function WinScreenStop({
  onNext,
  variant,
  src,
  imageBlobId,
  soundId,
  soundSrc,
  soundBlobId,
  winTitle,
  winFooterText,
  winCtaLabel,
}: {
  onNext: () => void
  variant?: WinVariant
  src?: string
  /** IndexedDB blob id for a per-node uploaded image file. Wins over
   *  `src` and `variant`. */
  imageBlobId?: string
  /** Registry id from the node — `WIN_SOUND_NONE` plays no sound. */
  soundId?: string
  /** Per-node uploaded audio data URL — legacy storage path. */
  soundSrc?: string
  /** IndexedDB blob id for a per-node uploaded audio file — wins over
   *  both `soundSrc` and `soundId`. */
  soundBlobId?: string
  winTitle?: string
  winFooterText?: string
  winCtaLabel?: string
}) {
  useEffect(() => {
    // Priority: IndexedDB blob → legacy data URL → registry → "None".
    // This is a one-shot sting that plays alongside the BgMusicPlayer
    // (which keeps the background track looping). Stops on unmount so a
    // long upload doesn't bleed into the next screen.
    let audio: HTMLAudioElement | null = null
    let blobUrl: string | null = null
    let cancelled = false

    async function start() {
      let url: string | null = null
      if (soundBlobId) {
        try {
          const blob = await loadAudioBlob(soundBlobId)
          if (blob) {
            blobUrl = URL.createObjectURL(blob)
            url = blobUrl
          }
        } catch {
          // fall through to lower-priority sources
        }
      }
      if (!url) {
        const option = getWinSound(soundId)
        url = soundSrc ? assetUrl(soundSrc) : option?.src ?? null
      }
      if (!url || cancelled) return
      audio = new Audio(url)
      audio.play().catch(() => { /* autoplay blocked — ignore */ })
    }
    start()

    return () => {
      cancelled = true
      if (audio) {
        audio.pause()
        audio.src = ''
      }
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    }
  }, [soundId, soundSrc, soundBlobId])
  return (
    <div className={styles.winStop}>
      <WinScreenComponent
        className={styles.winScreen}
        variant={variant}
        src={src}
        blobId={imageBlobId}
        onComplete={onNext}
        winTitle={winTitle}
        winFooterText={winFooterText}
        winCtaLabel={winCtaLabel}
      />
    </div>
  )
}

/** Look up a CaseNode by caseId and return its window data (or a
 *  defaults-based fallback if the editor never seeded one). The node's
 *  `data.caseId` always wins over any drift in `data.window.caseId`,
 *  so the editor's on-node case number is the single source of truth. */
function caseWindowDataFor(
  caseId: string,
  nodes: ReturnType<typeof useGameFlow>['nodes'],
): CaseWindowData | null {
  const node = nodes.find(
    (n): n is CaseFlowNode => n.type === 'case' && n.data.caseId === caseId,
  )
  if (!node) return null
  const base = node.data.window ?? DEFAULT_CASE_DATA
  return { ...base, caseId: node.data.caseId }
}

/**
 * Renders a BossMessage at the editor's locationX / locationY (%) and
 * lets the player drag it anywhere on the desktop by grabbing the card.
 * Drag starts from `mousedown` on the card; clicks on inner buttons /
 * links keep their own semantics (mic, Open, etc.).
 *
 * A new `<BossMessageSlot>` is mounted whenever the message id changes
 * (parent passes `key={node.id}`), which resets the drag position so
 * each new notification re-appears at its editor-defined coordinates.
 */
function BossMessageSlot({
  data,
  nextCaseId,
  onAdvance,
  onOpenCases,
  onUnlockOperation,
  onOpenAchievements,
  onOpenMiniGame,
}: {
  data: MessageNodeData
  nextCaseId?: string
  onAdvance: () => void
  onOpenCases: (targetCaseId?: string) => void
  onUnlockOperation: () => void
  onOpenAchievements: () => void
  onOpenMiniGame: (onContinue: () => void) => void
}) {
  // Drag position. `null` = use the editor's locationX/locationY (%).
  // Once dragged, switches to absolute pixel coords.
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const slotRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{
    offsetX: number; offsetY: number
  } | null>(null)
  // Set while a drag is in progress so the parent click handler (text-only
  // dismiss) doesn't fire on the mouseup that ends the drag.
  const justDraggedRef = useRef(false)
  const [messagePhotoUrl, setMessagePhotoUrl] = useState<string | undefined>()

  useEffect(() => {
    let objectUrl: string | undefined
    let cancelled = false
    if (!data.photoCustomId) {
      setMessagePhotoUrl(undefined)
      return
    }
    loadAudioBlob(data.photoCustomId).then((blob) => {
      if (!blob || cancelled) return
      objectUrl = URL.createObjectURL(blob)
      setMessagePhotoUrl(objectUrl)
    }).catch(() => setMessagePhotoUrl(undefined))
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [data.photoCustomId])

  // Voice clip playback. The audio plays on mount; the flow auto-advances
  // when the clip finishes; the mic icon (see `replayVoice` below) restarts
  // the clip from t=0. `data.content` holds the URL (e.g. "/sounds/angry01.mp3").
  //
  // We keep a ref to the latest `onAdvance` so the `ended` listener always
  // calls the current closure — the parent passes a fresh function every
  // render, but the audio effect only re-mounts when the source changes.
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const onAdvanceRef = useRef(onAdvance)
  useEffect(() => { onAdvanceRef.current = onAdvance }, [onAdvance])

  // Incremented on every playback start (initial mount + replay) — passed
  // through to BossMessage as `playKey` so the playhead element remounts
  // and its CSS animation restarts from the left edge of the track.
  const [playKey, setPlayKey] = useState(0)

  useEffect(() => {
    if (data.messageType !== 'voice') return

    let advanced = false
    let timer: number | null = null

    const finish = () => {
      if (advanced) return
      advanced = true
      if (timer != null) window.clearTimeout(timer)
      onAdvanceRef.current()
    }

    // If the audio can't play (missing file, decode error, autoplay
    // blocked, empty content) `ended` will never fire. Hold the message
    // on screen for `voiceDuration` seconds — same length as the playhead
    // animation — then advance, so the player still gets to read it.
    const scheduleFallback = () => {
      if (timer != null) return
      const sec = data.voiceDuration ?? 5
      timer = window.setTimeout(finish, sec * 1000)
    }

    const src = data.content?.trim()
    if (!src) {
      scheduleFallback()
      return () => { if (timer != null) window.clearTimeout(timer) }
    }

    const audio = new Audio(assetUrl(src))
    audioRef.current = audio
    audio.addEventListener('ended', finish)
    audio.addEventListener('error', scheduleFallback)
    audio.play().catch(scheduleFallback)
    setPlayKey((k) => k + 1)            // sync playhead with the new playback

    return () => {
      if (timer != null) window.clearTimeout(timer)
      audio.removeEventListener('ended', finish)
      audio.removeEventListener('error', scheduleFallback)
      audio.pause()
      audio.src = ''
      audioRef.current = null
    }
  }, [data.messageType, data.content, data.voiceDuration])

  // Mic-icon handler for voice messages: restart playback from the
  // beginning. Falls back to onAdvance if there is no audio loaded
  // (empty content, fetch failed, etc.) so the player isn't stuck.
  const replayVoice = () => {
    const audio = audioRef.current
    if (!audio) { onAdvance(); return }
    audio.currentTime = 0
    audio.play().catch(() => { /* ignore — mic click should never throw */ })
    setPlayKey((k) => k + 1)            // re-trigger the playhead animation
  }

  const onClick = () => {
    if ((data.messageType === 'link' || data.messageType === 'photo') && data.buttonLinkType === 'url' && data.buttonUrl) {
      window.location.assign(data.buttonUrl)
      return
    }
    if ((data.messageType === 'link' || data.messageType === 'photo') && data.buttonLinkType === 'miniGame') {
      onOpenMiniGame(onAdvance)
      return
    }
    if ((data.messageType === 'link' || data.messageType === 'photo') && nextCaseId) {
      // A case announcement opens its directly connected case only when
      // the player clicks the message button. Sequential completion owns
      // the tab's enabled state independently.
      onOpenCases(nextCaseId)
      onAdvance()
      return
    }
    if ((data.messageType === 'link' || data.messageType === 'photo') && data.buttonLinkType === 'case') {
      // Open the Cases window AND advance the flow so the case node
      // becomes current (and the decision buttons become live).
      onOpenCases()
      onAdvance()
      return
    }
    if ((data.messageType === 'link' || data.messageType === 'photo') && data.buttonLinkType === 'newCase') {
      // Some tutorial announcements target a later case through an
      // intermediate message chain, so they specify the case explicitly.
      if (data.targetCaseId) {
        onOpenCases(data.targetCaseId)
      } else {
        onOpenCases()
      }
      onAdvance()
      return
    }
    if ((data.messageType === 'link' || data.messageType === 'photo') && data.buttonLinkType === 'operation') {
      // Unlock the Operation desktop icon (player still has to click it).
      onUnlockOperation()
      onAdvance()
      return
    }
    if ((data.messageType === 'link' || data.messageType === 'photo') && data.buttonLinkType === 'achievements') {
      onOpenAchievements()
      onAdvance()
      return
    }
    onAdvance()
  }

  /* --- Drag ----------------------------------------- */
  function onMouseDown(e: ReactMouseEvent<HTMLDivElement>) {
    if (!(e.target as HTMLElement).closest('[data-message-drag-handle]')) return
    // Buttons + links keep their own click handlers — don't start a drag.
    if ((e.target as HTMLElement).closest('button, a')) return
    const el = slotRef.current
    const canvas = el?.parentElement
    if (!el || !canvas) return
    const rect = el.getBoundingClientRect()
    const canvasRect = canvas.getBoundingClientRect()
    const scale = canvasRect.width / canvas.offsetWidth || 1
    dragRef.current = {
      offsetX: (e.clientX - rect.left) / scale,
      offsetY: (e.clientY - rect.top) / scale,
    }
    startDragCursor()
    // Defer marking "dragged" until the pointer actually moves a few
    // pixels — a stationary mousedown+up should still register as a click.
    justDraggedRef.current = false
    e.preventDefault()
  }

  useEffect(() => {
    function onMove(e: MouseEvent) {
      const d = dragRef.current
      if (!d) return
      const el = slotRef.current
      const canvas = el?.parentElement
      if (!el || !canvas) return
      const canvasRect = canvas.getBoundingClientRect()
      const scale = canvasRect.width / canvas.offsetWidth || 1
      const nextX = (e.clientX - canvasRect.left) / scale - d.offsetX
      const nextY = (e.clientY - canvasRect.top) / scale - d.offsetY
      // Tiny-jitter dead-zone — don't start dragging until the user
      // has clearly moved the pointer.
      if (!justDraggedRef.current && pos == null) {
        const rect = el.getBoundingClientRect()
        const originX = (rect.left - canvasRect.left) / scale
        const originY = (rect.top - canvasRect.top) / scale
        if (Math.abs(nextX - originX) + Math.abs(nextY - originY) < 4) return
      }
      justDraggedRef.current = true
      const w = el?.offsetWidth ?? 0
      const h = el?.offsetHeight ?? 0
      const margin = 100 // always keep this much of the card on screen
      const canvasW = canvas.offsetWidth
      const canvasH = canvas.offsetHeight
      const x = Math.max(-w + margin, Math.min(canvasW - margin, nextX))
      const y = Math.max(0, Math.min(canvasH - Math.min(h, 50), nextY))
      setPos({ x, y })
      // Suppress text-selection during drag
      const sel = typeof getSelection !== 'undefined' ? getSelection() : null
      if (sel && !sel.isCollapsed) sel.removeAllRanges()
    }
    function onUp() {
      if (!dragRef.current) return
      dragRef.current = null
      stopDragCursor()
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      if (dragRef.current) {
        dragRef.current = null
        stopDragCursor()
      }
    }
  }, [])

  // Text messages have no inherent button/CTA — make the whole card
  // clickable so the player has a way to dismiss them (and so trigger-
  // queue text messages can drain). A drag-end shouldn't trigger dismiss.
  const isTextOnly = data.messageType === 'text'
  const dismissOnClick = () => {
    if (justDraggedRef.current) {
      justDraggedRef.current = false
      return
    }
    onClick()
  }

  const style: CSSProperties = pos == null
    ? { left: `${data.locationX}%`, top: `${data.locationY}%` }
    : { left: pos.x, top: pos.y, transform: 'none' }

  return (
    <div
      ref={slotRef}
      className={`${styles.messageSlot} ${isTextOnly ? styles.messageSlotClickable : ''} ${styles.messageSlotDraggable}`}
      style={style}
      onMouseDown={onMouseDown}
      onClick={isTextOnly ? dismissOnClick : undefined}
      role={isTextOnly ? 'button' : undefined}
      tabIndex={isTextOnly ? 0 : undefined}
      onKeyDown={isTextOnly ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() }
      } : undefined}
    >
      <BossMessage
        {...messageDataToBossProps(data, onClick, replayVoice, messagePhotoUrl)}
        {...(data.messageType === 'voice' ? { playKey } : {})}
      />
    </div>
  )
}
