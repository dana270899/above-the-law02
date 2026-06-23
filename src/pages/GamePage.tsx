import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import { Desktop } from '@/components/Desktop'
import {
  CaseWindow,
  DEFAULT_CASE_DATA,
  type CaseTab,
  type CaseDecision,
  type CaseWindowData,
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
import { TutorialSpotlight } from '@/components/game/TutorialSpotlight'
import { OperationLockedScreen } from '@/components/game/OperationLockedScreen'
import { AchievementsWindow, type CaseOutcome } from '@/components/AchievementsWindow'
import { useGameFlow } from '@/hooks/useGameFlow'
import { useGameScale } from '@/hooks/useGameScale'
import { messageDataToBossProps } from '@/lib/messageMapping'
import type {
  CaseFlowNode,
  GameFlowEdge,
  GameFlowNode,
  MessageFlowNode,
  MessageNodeData,
  OperationFlowNode,
  ResultFlowNode,
  TriggerFlowNode,
  TriggerType,
} from '@/types/editor'
import { WinScreenComponent } from '@/components/game/WinScreen'
import type { WinVariant } from '@/lib/winScreenImage'
import { getWinSound } from '@/lib/winSounds'
import { loadAudioBlob } from '@/lib/audioBlobStore'
import { BgMusicPlayer } from '@/components/game/BgMusicPlayer/BgMusicPlayer'
import type { BgMusicFlowNode } from '@/types/editor'
import { assetUrl } from '@/lib/paths'
import styles from './GamePage.module.css'

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
  const flow = useGameFlow()
  const scaleRef = useGameScale()

  // ?startCase / ?startOperation lets the editor's "Play from this
  // case" / "Preview this operation" links drop the player straight
  // onto the matching node — the walker jumps there on mount, and
  // the relevant window auto-opens. The graph's earlier nodes are
  // skipped (login etc.), but every downstream transition runs the
  // same as a normal `/game` session.
  const startParams = useMemo(() => {
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

  // Side queue of message-node ids fired by a tutorial trigger
  // (Arrest / Release / suspicion row expand / suspicion attachment).
  // Each entry is shown as a BossMessage overlay, popped on click.
  // Does NOT advance the main walker. When the queue drains, the
  // `pendingActionRef` (the click action that was deferred) runs.
  const [triggerQueue, setTriggerQueue] = useState<string[]>([])
  const pendingActionRef = useRef<(() => void) | null>(null)

  // Ids of trigger-fired messages that have already been displayed in
  // this session. Re-firing the same trigger (player re-expands a row,
  // re-clicks the attachment, or re-clicks Arrest on a retry case) must
  // not replay a bubble the player already saw.
  const [shownTriggerMessageIds, setShownTriggerMessageIds] = useState<Set<string>>(
    () => new Set(),
  )

  // Case ids force-unlocked by a `newCase` boss-message button. Adds to
  // the normal sequential-unlock rule (doesn't replace it).
  const [manuallyUnlockedCaseIds, setManuallyUnlockedCaseIds] = useState<Set<string>>(
    () => new Set(),
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
  // Locked-screen modal: shown when the player clicks the Operation
  // icon before it's been unlocked by the boss flow.
  const [operationLockedScreenOpen, setOperationLockedScreenOpen] =
    useState(false)

  const { currentNode, advance, goTo, cases, completedCaseIds, caseResults, nodes, edges } = flow
  const [achievementsOpen, setAchievementsOpen] = useState(false)

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

  // Auto-skip everything except the player-facing node types.
  // `result` nodes still stop the walker when they are a 'win' so the
  // full-screen win overlay can render; 'lose' results are skipped past.
  // `operation` nodes stop the walker so the OperationWindow can render
  // and gate on the player flipping every toggle + clicking Arrest.
  useEffect(() => {
    if (!currentNode) return
    if (
      currentNode.type === 'message' ||
      currentNode.type === 'login' ||
      currentNode.type === 'case' ||
      currentNode.type === 'operation'
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
  const messageNodeId = messageNode?.id ?? null
  useEffect(() => {
    if (!messageNodeId) return
    const audio = new Audio(assetUrl('/sounds/notification.mp3'))
    audio.play().catch(() => { /* autoplay blocked — ignore */ })
  }, [messageNodeId])

  // Same chime for trigger-queue messages (Arrest/Release/row triggers).
  // Without this, messages fired by a Trigger node appear silently.
  const triggerHeadId = triggerQueue[0] ?? null
  useEffect(() => {
    if (!triggerHeadId) return
    const audio = new Audio(assetUrl('/sounds/notification.mp3'))
    audio.play().catch(() => { /* autoplay blocked — ignore */ })
  }, [triggerHeadId])

  // Remember every trigger-fired message id as it actually appears, so
  // a future re-fire of the same trigger filters it out instead of
  // replaying the bubble the player already dismissed.
  useEffect(() => {
    if (!triggerHeadId) return
    setShownTriggerMessageIds((prev) => {
      if (prev.has(triggerHeadId)) return prev
      const next = new Set(prev)
      next.add(triggerHeadId)
      return next
    })
  }, [triggerHeadId])

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
  // case (by order) has been completed, OR (c) it was force-unlocked
  // by a `newCase` boss-message button.
  const tabs: CaseTab[] = useMemo(() => {
    return cases.map((c, i) => {
      const prev = i === 0 ? null : cases[i - 1]
      const seqUnlocked = prev == null || completedCaseIds.has(prev.caseId)
      const manuallyUnlocked = manuallyUnlockedCaseIds.has(c.caseId)
      return {
        id: c.caseId,
        time: caseWindowDataFor(c.caseId, nodes)?.createdAt ?? '',
        locked: !seqUnlocked && !manuallyUnlocked,
      }
    })
  }, [cases, completedCaseIds, manuallyUnlockedCaseIds, nodes])

  // Sticky case id — remembers the last case the walker visited so
  // the Cases window keeps showing it after the walker advances into
  // a downstream message / operation. Without this, the case window
  // would snap back to the first unlocked tab the instant the walker
  // leaves the case node, confusing the player.
  const [lastCaseId, setLastCaseId] = useState<string | null>(null)
  useEffect(() => {
    if (caseNode) setLastCaseId(caseNode.data.caseId)
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

  // Open the Cases window. Used by the desktop icon and by boss-message
  // 'case' / 'newCase' buttons. When `targetCaseId` is passed (only
  // 'newCase' does this today), the window opens with that case selected.
  // Defensive: callers wired into DOM `onClick` may pass an event as the
  // first arg — guard against non-string values so a click event never
  // ends up stored as `viewCaseId`.
  const openCaseWindow = (targetCaseId?: string) => {
    if (typeof targetCaseId === 'string' && targetCaseId) {
      setViewCaseId(targetCaseId)
    } else {
      setViewCaseId(null) // resolve via priority again
    }
    setCaseWindowOpen(true)
  }

  // Force-unlock a specific case (used by the 'newCase' message button).
  const unlockCase = (caseId: string) => {
    setManuallyUnlockedCaseIds((prev) => {
      if (prev.has(caseId)) return prev
      const next = new Set(prev)
      next.add(caseId)
      return next
    })
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

  const triggerHead: MessageFlowNode | null = triggerQueue[0]
    ? nodes.find(
        (n): n is MessageFlowNode =>
          n.id === triggerQueue[0] && n.type === 'message',
      ) ?? null
    : null

  // If the queue head points at a missing/non-message id, skip past it
  // so the queue can drain instead of getting stuck.
  useEffect(() => {
    if (triggerQueue.length > 0 && !triggerHead) {
      setTriggerQueue((q) => q.slice(1))
    }
  }, [triggerHead, triggerQueue.length])

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
        // Follow each outgoing edge from the trigger node to a message.
        // Skip messages the player has already seen in this session so a
        // repeat trigger doesn't re-show the same bubble.
        for (const out of edges.filter((e) => e.source === tNode.id)) {
          const mNode = nodes.find(
            (n): n is MessageFlowNode => n.id === out.target && n.type === 'message',
          )
          if (mNode && !shownTriggerMessageIds.has(mNode.id)) ids.push(mNode.id)
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

  // While the flow sits on a login node, render the LoginScreen as a
  // full-screen step. Submitting follows the node's outgoing edge.
  if (currentNode?.type === 'login') {
    return (
      <>
        <div ref={scaleRef} className={styles.canvas}>
          <LoginScreen onLogin={() => advance()} />
        </div>
        {bgMusic}
      </>
    )
  }

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
  /** Wipe any lingering tutorial trigger overlay from a previous click
   *  so a fresh decision isn't blocked by a stale "I give you another
   *  chance" voice still sitting in the queue. The pending action from
   *  the prior runWithTrigger (e.g. the retry no-op) is dropped on the
   *  floor too — its purpose was tied to the now-superseded choice. */
  const clearPendingTrigger = () => {
    pendingActionRef.current = null
    setTriggerQueue([])
  }
  const onArrest = () => {
    if (!activeCaseNode) return
    clearPendingTrigger()
    const caseId = activeCaseNode.data.caseId
    const retry = hasRetryTrigger(activeCaseNode.id, 'arrest')
    // On a retry-arrest trigger we never lock the decision — the pill
    // would otherwise flash "Arrested" while the boss scolds the player.
    if (!retry) {
      setCaseDecisions((prev) => ({ ...prev, [caseId]: 'arrested' }))
    }
    runWithTrigger(findTriggerMessageIds(activeCaseNode.id, 'arrest'), () => {
      if (retry) return
      const targetId = findNextFrom(activeCaseNode.id, 'arrest')
      if (targetId) goTo(targetId)
    })
  }
  const onRelease = () => {
    if (!activeCaseNode) return
    clearPendingTrigger()
    const caseId = activeCaseNode.data.caseId
    const retry = hasRetryTrigger(activeCaseNode.id, 'release')
    if (!retry) {
      setCaseDecisions((prev) => ({ ...prev, [caseId]: 'released' }))
    }
    runWithTrigger(findTriggerMessageIds(activeCaseNode.id, 'release'), () => {
      if (retry) return
      const targetId = findNextFrom(activeCaseNode.id, 'release')
      if (targetId) goTo(targetId)
    })
  }

  // Per-slot outcomes for the achievements panel, in case-order.
  const achievementsResults: CaseOutcome[] = cases.map(
    (c) => caseResults.get(c.caseId) ?? null,
  )
  const achievementsTotal = Math.max(cases.length, 8)

  // Walker is on a win-result — render the responsive win screen
  // OUTSIDE the fixed 1920×1080 canvas so the image can fill the
  // actual viewport width (keeping ratio) and the decision bar can
  // take whatever vertical space is left. Plays a chime on mount;
  // Next advances the walker along the result's outgoing edge.
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
    return (
      <>
        <WinScreenStop
          variant={winImage}
          src={winImageCustom}
          imageBlobId={winImageCustomId}
          soundId={winSound}
          soundSrc={winSoundCustom}
          soundBlobId={winSoundCustomId}
          onNext={() => advance()}
        />
        {bgMusic}
      </>
    )
  }

  return (
    <>
    <Desktop
      onCasesClick={openCaseWindow}
      onOperationClick={() => {
        if (operationUnlocked) setOperationWindowOpen(true)
        else setOperationLockedScreenOpen(true)
      }}
      onStartClick={() => setVolumeControlVisible((v) => !v)}
      tutorialOverlay={(() => {
        // Same precedence as the BossMessage stacking below: a
        // trigger-queue tutorial message wins over the walker's
        // current message.
        const activeTutorialMsg =
          (triggerHead?.data.isTutorial ? triggerHead : null)
          ?? (messageNode?.data.isTutorial ? messageNode : null)
        if (!activeTutorialMsg) return null
        return (
          <TutorialSpotlight
            key={activeTutorialMsg.id}
            targetId={activeTutorialMsg.data.spotlightTargetId}
          />
        )
      })()}
    >
      {caseWindowOpen && activeCaseData && (
        <div className={styles.caseLayer}>
          <CaseWindow
            data={activeCaseData}
            draggable
            tabs={tabs}
            onTabSelect={(caseId) => setViewCaseId(caseId)}
            onArrest={canDecide ? onArrest : undefined}
            onRelease={canDecide ? onRelease : undefined}
            decision={activeCaseId ? caseDecisions[activeCaseId] ?? null : null}
            onClose={() => setCaseWindowOpen(false)}
            onRowTrigger={onRowTrigger}
            useCamera={!!activeCaseNode?.data.useCamera}
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
      {operationWindowOpen && (() => {
        const opId = operationNode?.data.operationId ?? 'preview'
        const opData: OperationWindowV2Data = operationNode?.data.window
          ?? DEFAULT_OPERATION_V2_DATA
        const counters = operationCounters[opId] ?? DEFAULT_OPERATION_V2_DATA.counters
        const closeWindow = () => setOperationWindowOpen(false)
        return (
          <div className={styles.caseLayer}>
            <OperationWindowV2
              draggable
              data={{ ...opData, counters }}
              onChangeCounter={(key, value) => changeOperationCounter(opId, key, value)}
              onStartOperation={() => {
                closeWindow()
                if (operationNode) advance()
              }}
              onClose={closeWindow}
            />
          </div>
        )
      })()}

      {achievementsOpen && (
        <div className={styles.achievementsLayer}>
          <AchievementsWindow
            results={achievementsResults}
            total={achievementsTotal}
            loopEntryFlicker={
              messageNode?.data.buttonLinkType === 'achievements'
            }
          />
        </div>
      )}

      {/* Operation locked-screen modal: the icon is always rendered
          clickable; if the boss flow hasn't unlocked operations yet,
          clicking shows this screen instead of opening the window. */}
      {operationLockedScreenOpen && (
        <OperationLockedScreen
          onClose={() => setOperationLockedScreenOpen(false)}
        />
      )}

      {/* Trigger-queue sidecar: messages fired by a tutorial trigger
          (Arrest / Release / suspicion expand / suspicion attachment).
          The walker's own message overlay is suppressed while the queue
          runs so two messages can't stack. */}
      {triggerHead && (
        <div className={styles.messageOverlay}>
          <BossMessageSlot
            key={triggerHead.id}
            data={triggerHead.data}
            onAdvance={() => {
              // Follow the message's outgoing edge to a chained message
              // node, so Trigger → Voice → Text plays the whole chain
              // before the queue drains and the pending action fires.
              const nextId = findNextFrom(triggerHead.id)
              const isChainable =
                nextId != null &&
                nodes.some((n) => n.id === nextId && n.type === 'message')
              setTriggerQueue((q) => {
                const rest = q.slice(1)
                return isChainable && !rest.includes(nextId!)
                  ? [nextId!, ...rest]
                  : rest
              })
            }}
            onOpenCases={openCaseWindow}
            onUnlockCase={unlockCase}
            onUnlockOperation={() => setOperationUnlocked(true)}
            onOpenAchievements={() => setAchievementsOpen(true)}
          />
        </div>
      )}

      {/* Game-flow sidecar: only renders when the current node is a message.
          `key` resets drag state whenever a new message takes the slot, so
          each notification re-appears at its editor-defined locationX/Y. */}
      {messageNode && !triggerHead && (
        <div className={styles.messageOverlay}>
          <BossMessageSlot
            key={messageNode.id}
            data={messageNode.data}
            onAdvance={() => advance()}
            onOpenCases={openCaseWindow}
            onUnlockCase={unlockCase}
            onUnlockOperation={() => setOperationUnlocked(true)}
            onOpenAchievements={() => setAchievementsOpen(true)}
          />
        </div>
      )}

      {/* Scheduled subtitles for the active voice message. The walker's
          message wins over a trigger-queue message (matches BossMessage
          stacking above). Subtitles auto-tick from when they mount, so
          we key on the node id to restart the timer per message. */}
      {(() => {
        const activeVoice = (triggerHead?.data.messageType === 'voice' ? triggerHead : null)
          ?? (messageNode?.data.messageType === 'voice' ? messageNode : null)
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
    {bgMusic}
    </>
  )
}

/** Full-screen win stop: image fills the viewport width keeping its
 *  aspect ratio, and a decision bar fills the remaining height with
 *  a Next button on the right. The `variant` selects which image to
 *  render (set per result node in the editor). Plays the notification
 *  chime on mount. */
function WinScreenStop({
  onNext,
  variant,
  src,
  imageBlobId,
  soundId,
  soundSrc,
  soundBlobId,
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
  // Click-anywhere-to-advance: the player can either click the Next
  // button or click anywhere on the win screen to move on. The button
  // still works on its own because we let its click bubble up.
  function handleAdvance(e: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>) {
    if ('key' in e && e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    onNext()
  }

  return (
    <div
      className={styles.winStop}
      role="button"
      tabIndex={0}
      onClick={handleAdvance}
      onKeyDown={handleAdvance}
      aria-label="Continue to the next screen"
    >
      <WinScreenComponent
        className={styles.winScreen}
        variant={variant}
        src={src}
        blobId={imageBlobId}
      />
      <div className={styles.winBar}>
        <p className={styles.winBarText}>Good job!</p>
        <button type="button" className={styles.winNext} onClick={onNext}>
          Next
        </button>
      </div>
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
  onAdvance,
  onOpenCases,
  onUnlockCase,
  onUnlockOperation,
  onOpenAchievements,
}: {
  data: MessageNodeData
  onAdvance: () => void
  onOpenCases: (targetCaseId?: string) => void
  onUnlockCase: (caseId: string) => void
  onUnlockOperation: () => void
  onOpenAchievements: () => void
}) {
  // Drag position. `null` = use the editor's locationX/locationY (%).
  // Once dragged, switches to absolute pixel coords.
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const slotRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{
    startX: number; startY: number; originX: number; originY: number
  } | null>(null)
  // Set while a drag is in progress so the parent click handler (text-only
  // dismiss) doesn't fire on the mouseup that ends the drag.
  const justDraggedRef = useRef(false)

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
    if (data.messageType === 'link' && data.buttonLinkType === 'url' && data.buttonUrl) {
      window.location.assign(data.buttonUrl)
      return
    }
    if (data.messageType === 'link' && data.buttonLinkType === 'case') {
      // Open the Cases window AND advance the flow so the case node
      // becomes current (and the decision buttons become live).
      onOpenCases()
      onAdvance()
      return
    }
    if (data.messageType === 'link' && data.buttonLinkType === 'newCase') {
      // Force-unlock the target case, open Cases on that tab, and
      // advance the walker (same as the 'case' branch otherwise).
      if (data.targetCaseId) {
        onUnlockCase(data.targetCaseId)
        onOpenCases(data.targetCaseId)
      } else {
        onOpenCases()
      }
      onAdvance()
      return
    }
    if (data.messageType === 'link' && data.buttonLinkType === 'operation') {
      // Unlock the Operation desktop icon (player still has to click it).
      onUnlockOperation()
      onAdvance()
      return
    }
    if (data.messageType === 'link' && data.buttonLinkType === 'achievements') {
      onOpenAchievements()
      onAdvance()
      return
    }
    onAdvance()
  }

  /* --- Drag ----------------------------------------- */
  function onMouseDown(e: ReactMouseEvent<HTMLDivElement>) {
    // Buttons + links keep their own click handlers — don't start a drag.
    if ((e.target as HTMLElement).closest('button, a')) return
    const el = slotRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: rect.left,
      originY: rect.top,
    }
    // Defer marking "dragged" until the pointer actually moves a few
    // pixels — a stationary mousedown+up should still register as a click.
    justDraggedRef.current = false
    e.preventDefault()
  }

  useEffect(() => {
    function onMove(e: MouseEvent) {
      const d = dragRef.current
      if (!d) return
      const dx = e.clientX - d.startX
      const dy = e.clientY - d.startY
      // Tiny-jitter dead-zone — don't start dragging until the user
      // has clearly moved the pointer.
      if (!justDraggedRef.current && Math.abs(dx) + Math.abs(dy) < 4) return
      justDraggedRef.current = true
      const el = slotRef.current
      const w = el?.offsetWidth ?? 0
      const margin = 100 // always keep this much of the card on screen
      const x = Math.max(-w + margin, Math.min(window.innerWidth - margin, d.originX + dx))
      const y = Math.max(0, Math.min(window.innerHeight - 50, d.originY + dy))
      setPos({ x, y })
      // Suppress text-selection during drag
      const sel = typeof getSelection !== 'undefined' ? getSelection() : null
      if (sel && !sel.isCollapsed) sel.removeAllRanges()
    }
    function onUp() { dragRef.current = null }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
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
        {...messageDataToBossProps(data, onClick, replayVoice)}
        {...(data.messageType === 'voice' ? { playKey } : {})}
      />
    </div>
  )
}
