import { Handle, Position, useReactFlow } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import type { CaseFlowNode, MessageFlowNode, MessageNodeData, SubtitleCue } from '@/types/editor'
import { BossMessage } from '@/components/game/BossMessage/BossMessage'
import { messageDataToBossProps } from '@/lib/messageMapping'
import { SPOTLIGHT_GROUPS, SPOTLIGHT_TARGETS } from '@/lib/spotlightTargets'
import styles from './MessageNode.module.css'

function clampPercent(raw: string): number {
  const n = Number(raw)
  if (Number.isNaN(n)) return 0
  return Math.max(0, Math.min(100, n))
}

export function MessageNode({ id, data }: NodeProps<MessageFlowNode>) {
  const { updateNodeData, getNodes } = useReactFlow()

  function set<K extends keyof MessageNodeData>(field: K, value: MessageNodeData[K]) {
    updateNodeData(id, { [field]: value })
  }

  // For the 'newCase' target picker: list of cases in the graph by caseId.
  const caseOptions = getNodes()
    .filter((n): n is CaseFlowNode => n.type === 'case')
    .map((n) => ({ caseId: n.data.caseId, title: n.data.title }))

  const isVoice = data.messageType === 'voice'
  const isLink = data.messageType === 'link'

  return (
    <div className={styles.wrap}>
      <Handle type="target" position={Position.Top} />

      <div className={styles.title}>💬 Boss Message</div>

      {/* Live preview of the actual in-game design */}
      <div className={`${styles.previewBox} ${isLink ? styles.previewBoxLink : ''}`}>
        <div className={styles.previewScale}>
          <BossMessage {...messageDataToBossProps(data)} />
        </div>
      </div>

      {/* messageType */}
      <div className={styles.label}>Message type</div>
      <select
        className={`nodrag ${styles.field}`}
        value={data.messageType}
        onChange={(e) => set('messageType', e.target.value as MessageNodeData['messageType'])}
      >
        <option value="text">Text</option>
        <option value="voice">Voice</option>
        <option value="link">Link (text + button)</option>
      </select>

      {/* content — text body for text/link, audio path for voice */}
      <div className={styles.label}>
        {isVoice ? 'Audio file path / URL' : 'Message content'}
      </div>
      {isVoice ? (
        <input
          className={`nodrag ${styles.field}`}
          type="text"
          value={data.content}
          placeholder="/audio/boss-1.mp3"
          onChange={(e) => set('content', e.target.value)}
        />
      ) : (
        <textarea
          className={`nodrag ${styles.field} ${styles.textarea}`}
          value={data.content}
          onChange={(e) => set('content', e.target.value)}
        />
      )}

      {isVoice && (
        <>
          <div className={styles.label}>Subtitle (shown under the voice card)</div>
          <textarea
            className={`nodrag ${styles.field} ${styles.textarea}`}
            value={data.subtitle ?? ''}
            onChange={(e) => set('subtitle', e.target.value)}
          />

          {/* Scheduled bottom-of-desktop subtitles. Each cue has a start
              time (seconds from when the message appears) and a line of
              text. The cue stays on screen until the next cue's start,
              or until voiceDuration if it's the last one. */}
          <div className={styles.label}>Voice duration (seconds, optional)</div>
          <input
            className={`nodrag ${styles.field}`}
            type="number"
            min={0}
            step={0.1}
            value={data.voiceDuration ?? ''}
            placeholder="auto: last cue + 3s"
            onChange={(e) => {
              const v = e.target.value.trim()
              set('voiceDuration', v === '' ? undefined : Math.max(0, Number(v)))
            }}
          />

          <div className={styles.label}>Subtitle schedule (bottom of desktop)</div>
          <SubtitleCueEditor
            cues={data.subtitles ?? []}
            onChange={(next) => set('subtitles', next)}
          />
        </>
      )}

      {/* Link-only fields */}
      {isLink && (
        <>
          <div className={styles.label}>Button label</div>
          <input
            className={`nodrag ${styles.field}`}
            type="text"
            value={data.buttonLabel}
            onChange={(e) => set('buttonLabel', e.target.value)}
          />

          <div className={styles.label}>Button leads to</div>
          <select
            className={`nodrag ${styles.field}`}
            value={data.buttonLinkType}
            onChange={(e) => set('buttonLinkType', e.target.value as MessageNodeData['buttonLinkType'])}
          >
            <option value="edge">Connected node (edge)</option>
            <option value="url">URL</option>
            <option value="case">Open Case window</option>
            <option value="newCase">Open a specific case</option>
            <option value="operation">Unlock Operation icon</option>
            <option value="achievements">Open Achievements window</option>
          </select>

          {data.buttonLinkType === 'url' && (
            <>
              <div className={styles.label}>URL</div>
              <input
                className={`nodrag ${styles.field}`}
                type="text"
                value={data.buttonUrl}
                placeholder="/case-2"
                onChange={(e) => set('buttonUrl', e.target.value)}
              />
            </>
          )}

          {data.buttonLinkType === 'newCase' && (
            <>
              <div className={styles.label}>Target case</div>
              <select
                className={`nodrag ${styles.field}`}
                value={data.targetCaseId ?? ''}
                onChange={(e) => set('targetCaseId', e.target.value)}
              >
                <option value="">
                  {caseOptions.length === 0
                    ? 'No case nodes yet'
                    : 'Pick a case…'}
                </option>
                {caseOptions.map((c) => (
                  <option key={c.caseId} value={c.caseId}>
                    Case #{c.caseId}
                    {c.title ? ` — ${c.title}` : ''}
                  </option>
                ))}
              </select>
            </>
          )}
        </>
      )}

      {/* location (% of screen) */}
      <div className={styles.label}>Location on screen (% of viewport)</div>
      <div className={styles.row}>
        <label className={styles.coord}>
          X
          <input
            className={`nodrag ${styles.field}`}
            type="number"
            min={0}
            max={100}
            step={1}
            value={data.locationX}
            onChange={(e) => set('locationX', clampPercent(e.target.value))}
          />
        </label>
        <label className={styles.coord}>
          Y
          <input
            className={`nodrag ${styles.field}`}
            type="number"
            min={0}
            max={100}
            step={1}
            value={data.locationY}
            onChange={(e) => set('locationY', clampPercent(e.target.value))}
          />
        </label>
      </div>

      {/* ─── Tutorial / spotlight ─────────────────────
          Opt-in toggle: when on, the runtime turns the rest of
          the desktop to black-and-white while this message is
          on screen, and (optionally) keeps the chosen element
          in full color. Everything here is additive — leaving
          the toggle off preserves the original behaviour. */}
      <div className={`nodrag ${styles.tutorialPanel}`}>
        <label className={styles.tutorialToggle}>
          <input
            type="checkbox"
            checked={data.isTutorial ?? false}
            onChange={(e) => set('isTutorial', e.target.checked)}
          />
          Tutorial message
        </label>

        {data.isTutorial && (
          <>
            <div className={styles.label}>Highlight (everything else turns B&amp;W)</div>
            <select
              className={`nodrag ${styles.field}`}
              value={data.spotlightTargetId ?? ''}
              onChange={(e) => set('spotlightTargetId', e.target.value || undefined)}
            >
              <option value="">None — just grayscale</option>
              {SPOTLIGHT_GROUPS.map((group) => (
                <optgroup key={group} label={group}>
                  {SPOTLIGHT_TARGETS.filter((t) => t.group === group).map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <div className={styles.tutorialHint}>
              The desktop fades to black-and-white while this message is shown.
              The chosen element stays in color to draw the player's eye.
            </div>
          </>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}

/* ─── Subtitle schedule editor ──────────────────
   One row per cue: At (seconds) + Text + remove.
   Sorts by `at` after every change so playback
   order matches edit order. */
function SubtitleCueEditor({
  cues,
  onChange,
}: {
  cues: SubtitleCue[]
  onChange: (next: SubtitleCue[]) => void
}) {
  function update(i: number, patch: Partial<SubtitleCue>) {
    const next = cues.map((c, idx) => (idx === i ? { ...c, ...patch } : c))
    next.sort((a, b) => a.at - b.at)
    onChange(next)
  }
  function remove(i: number) {
    onChange(cues.filter((_, idx) => idx !== i))
  }
  function add() {
    const nextAt = cues.length === 0
      ? 0
      : Math.max(...cues.map((c) => c.at)) + 1
    onChange([...cues, { at: nextAt, text: '' }])
  }

  return (
    <div className={styles.cueList}>
      {cues.length === 0 && (
        <div className={styles.cueEmpty}>No cues yet.</div>
      )}
      {cues.map((c, i) => (
        <div key={i} className={styles.cueRow}>
          <label className={styles.cueAt}>
            <span>At (s)</span>
            <input
              className={`nodrag ${styles.field}`}
              type="number"
              min={0}
              step={0.1}
              value={c.at}
              onChange={(e) => update(i, { at: Math.max(0, Number(e.target.value) || 0) })}
            />
          </label>
          <label className={styles.cueText}>
            <span>Text</span>
            <input
              className={`nodrag ${styles.field}`}
              type="text"
              value={c.text}
              placeholder="Subtitle line…"
              onChange={(e) => update(i, { text: e.target.value })}
            />
          </label>
          <button
            type="button"
            className={`nodrag ${styles.cueRemove}`}
            onClick={() => remove(i)}
            aria-label="Remove cue"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className={`nodrag ${styles.cueAdd}`}
        onClick={add}
      >
        + Add cue
      </button>
    </div>
  )
}
