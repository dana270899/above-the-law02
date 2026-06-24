import type { Node, Edge } from '@xyflow/react'
import type { CaseWindowData } from '@/components/CaseWindow'
import type { OperationWindowV2Data } from '@/components/OperationWindowV2'

// Data shapes
export interface LoginNodeData  { nodeType: 'login'; label: string;  [key: string]: unknown }
export interface IntroNodeData  { nodeType: 'intro'; label: string;  [key: string]: unknown }
export interface CaseNodeData   { nodeType: 'case'; caseId: string; title: string; order: number; hasOperation: boolean; isBothWin?: boolean; useCamera?: boolean; window?: CaseWindowData; [key: string]: unknown }
/**
 * OperationNodeData — a stop in the flow where the player must
 * configure an Operation Window V2. Each node carries its own
 * `operationId` so multiple operations can coexist in one game
 * and be linked to independently.
 *
 * The runtime stops the walker on an operation node. The player
 * must pick at least one of every item (counter ≥ 1) and click
 * the Arrest CTA to advance along the outgoing edge. The optional
 * `window` payload mirrors CaseNodeData.window — when present, it
 * overrides the defaults (title, header text, CTA label, per-item
 * click sounds). Counter values are always reset at runtime.
 *
 * `caseId` is kept (optional) for backward compatibility with
 * older saves that tied an operation to a single case.
 */
export interface OperationNodeData {
  nodeType: 'operation'
  operationId: string
  title: string
  caseId?: string
  window?: OperationWindowV2Data
  [key: string]: unknown
}
export interface ResultNodeData {
  nodeType: 'result'
  resultType: 'win' | 'lose'
  caseId: string
  label: string
  /** Win-screen image id (see `lib/winScreens.ts`). Only used when
   *  `resultType === 'win'`. Defaults to the first registered option
   *  when missing or unknown. */
  winImage?: string
  /** Per-node uploaded image as a data URL. Overrides `winImage` when
   *  set. Lets the author attach a new image directly from the editor
   *  node without touching the global registry. Kept for backward
   *  compatibility — new uploads go to IndexedDB via `winImageCustomId`
   *  instead, since data URLs blow out the localStorage quota for
   *  multi-MB images. */
  winImageCustom?: string
  winImageCustomLabel?: string
  /** Per-node uploaded image stored in IndexedDB. Wins over both
   *  `winImageCustom` (data URL) and `winImage` (registry id). Fetched
   *  and converted to an object URL at render time. */
  winImageCustomId?: string
  /** Win-screen sound id (see `lib/winSounds.ts`). Only used when
   *  `resultType === 'win'`. Defaults to the first registered option
   *  when missing or unknown; set to `WIN_SOUND_NONE` to play no sound. */
  winSound?: string
  /** Per-node uploaded audio file as a data URL. Overrides `winSound`
   *  when set — same pattern as `winImageCustom`. Kept for backward
   *  compatibility with earlier uploads; new uploads go to IndexedDB
   *  via `winSoundCustomId` instead, since data URLs blow out the
   *  localStorage quota for anything larger than a short clip. */
  winSoundCustom?: string
  winSoundCustomLabel?: string
  /** Per-node uploaded audio stored in IndexedDB. Wins over both
   *  `winSoundCustom` (data URL) and `winSound` (registry id). The
   *  blob is fetched and converted to an object URL at render time. */
  winSoundCustomId?: string
  /** Optional per-node text overrides for windowed win screens.
   *  Missing values fall back to the built-in copy so older saves keep
   *  rendering exactly as before. */
  winTitle?: string
  winFooterText?: string
  winCtaLabel?: string
  [key: string]: unknown
}
export interface PrizeNodeData  { nodeType: 'prize'; prizeId: string; emoji: string; title: string; [key: string]: unknown }

/**
 * BgMusicNodeData — sits in the graph as a standalone "settings" node
 * (no incoming or outgoing walker edges). The runtime scans the saved
 * graph for the first bgMusic node and plays its track looped behind
 * every screen except the win-result screen.
 *
 * `src` picks a track from the BG_MUSIC registry (see lib/bgMusic.ts);
 * `srcCustom` overrides it with a per-node uploaded data URL.
 * `volume` is the editor-set default in 0..1; the player can override
 * it via the on-screen volume control, but that runtime tweak isn't
 * persisted on the node.
 */
export interface BgMusicNodeData {
  nodeType: 'bgMusic'
  src?: string
  srcCustom?: string
  srcCustomLabel?: string
  volume: number
  [key: string]: unknown
}
/**
 * TriggerNodeData — graph-based hook for "when player X happens in case
 * C, fire the connected message". A trigger node has one input handle
 * (connected from the case node's `trigger` source handle) and one
 * output handle (connected to a message node, or chain of messages).
 *
 * The runtime never advances the walker THROUGH a trigger node — it's
 * a side branch. When the player performs `triggerType` on case C, the
 * runtime queues every reachable message node behind matching triggers.
 */
export type TriggerType = 'arrest' | 'release' | 'expandRow' | 'attachmentRow'
export interface TriggerNodeData {
  nodeType: 'trigger'
  triggerType: TriggerType
  /** Required for `expandRow` / `attachmentRow` — the suspicion row id. */
  targetRowId?: string
  /** When true on an `arrest`/`release` trigger, after the queued
   *  messages finish the runtime resets the case decision and does NOT
   *  advance the walker — letting the player make a different choice. */
  retry?: boolean
  /** Seconds to wait between the player action firing the trigger and
   *  the downstream messages appearing. Defaults to 0 (no delay). */
  delaySeconds?: number
  [key: string]: unknown
}

/**
 * One timed subtitle cue. `at` is seconds since the voice message
 * appeared. The cue stays on screen until the next cue's `at`, or
 * until `voiceDuration` if it's the last cue. An empty `text` hides
 * the subtitle (useful for ending a line before the next one starts).
 */
export interface SubtitleCue {
  at: number
  text: string
}

export interface MessageNodeData {
  nodeType: 'message'
  messageType: 'text' | 'voice' | 'link'
  content: string              // text body OR audio file path/URL
  /** [legacy] Single subtitle shown UNDER the voice card. Kept for
   *  backward compatibility — new content should use `subtitles`. */
  subtitle?: string
  /** Scheduled bottom-of-desktop subtitles for voice messages.
   *  Renders large white text per Figma 477:18935. */
  subtitles?: SubtitleCue[]
  /** Total length of the voice clip in seconds. Only used to decide
   *  when the LAST subtitle cue ends. Optional — defaults to the last
   *  cue's `at` + 3 seconds. */
  voiceDuration?: number
  buttonLabel: string          // text on the message's button
  /**
   * Where the button leads:
   *   - 'edge'         → follow the message's outgoing edge (default)
   *   - 'url'          → window.location to `buttonUrl`
   *   - 'case'         → open the Cases window on the current/first-unlocked
   *   - 'newCase'      → force-unlock `targetCaseId` AND open Cases on that tab
   *   - 'operation'    → unlock the Operation desktop icon (player still clicks it)
   *   - 'achievements' → open the Achievements window
   * All branches except 'url' also advance the walker via the outgoing edge.
   */
  buttonLinkType: 'edge' | 'url' | 'case' | 'newCase' | 'operation' | 'achievements'
  buttonUrl: string            // only used when buttonLinkType === 'url'
  targetCaseId?: string        // only used when buttonLinkType === 'newCase'
  locationX: number            // horizontal position on screen, 0–100 (% from left)
  locationY: number            // vertical position on screen, 0–100 (% from top)
  /** When true, this message is part of a tutorial step — the runtime
   *  desaturates the rest of the desktop to black-and-white while the
   *  message is on screen, leaving the chosen highlight in color. */
  isTutorial?: boolean
  /** Spotlight target id from `lib/spotlightTargets.ts`. Only applied
   *  when `isTutorial` is true. Empty / undefined = grayscale only,
   *  nothing highlighted. */
  spotlightTargetId?: string
  [key: string]: unknown
}

// Full Node types (Data + Type discriminant) — required by @xyflow/react v12 NodeProps
export type LoginFlowNode     = Node<LoginNodeData, 'login'>
export type IntroFlowNode     = Node<IntroNodeData, 'intro'>
export type CaseFlowNode      = Node<CaseNodeData, 'case'>
export type OperationFlowNode = Node<OperationNodeData, 'operation'>
export type ResultFlowNode    = Node<ResultNodeData, 'result'>
export type PrizeFlowNode     = Node<PrizeNodeData, 'prize'>
export type MessageFlowNode   = Node<MessageNodeData, 'message'>
export type TriggerFlowNode   = Node<TriggerNodeData, 'trigger'>
export type BgMusicFlowNode   = Node<BgMusicNodeData, 'bgMusic'>

export type GameFlowNode = LoginFlowNode | IntroFlowNode | CaseFlowNode | OperationFlowNode | ResultFlowNode | PrizeFlowNode | MessageFlowNode | TriggerFlowNode | BgMusicFlowNode
export type GameFlowEdge = Edge<{ label?: string }>
