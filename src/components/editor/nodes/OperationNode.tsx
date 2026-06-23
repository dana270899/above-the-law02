import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Handle, Position, useReactFlow } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import type { OperationFlowNode } from '@/types/editor'
import {
  OperationWindowV2,
  DEFAULT_OPERATION_V2_DATA,
  ITEM_KEYS,
  ITEM_LABELS,
  type OperationWindowV2Data,
  type OperationItemKey,
  type OperationCounters,
} from '@/components/OperationWindowV2'
import {
  OPERATION_SOUNDS,
  OPERATION_SOUND_NONE,
} from '@/lib/operationSounds'
import { appPath, assetUrl } from '@/lib/paths'
import styles from './CaseNode.module.css'

/**
 * OperationNode — graph node that wraps an OperationWindowV2.
 *
 * Edits here propagate to every place the operation runs (the
 * editor preview, the runtime stop in GamePage). The operation
 * is identified by `operationId` so the game can support more
 * than one operation; the runtime opens the V2 window for the
 * node the walker is currently on.
 *
 * Layout mirrors CaseNode (same modal pattern) so the editor's
 * UX is consistent between the two window-shaped node types.
 */
export function OperationNode({ id, data }: NodeProps<OperationFlowNode>) {
  const { updateNodeData } = useReactFlow()
  const [editing, setEditing] = useState(false)

  // Local-only counter state for the editor preview. Counters are
  // a runtime concern — adjustments inside the editor shouldn't
  // bake numbers into the saved node data, which would then ship
  // to players with items pre-selected. Editing the copy fields
  // (title / header text / CTA label / per-item sounds) still
  // persists via updateWindow() below.
  const [previewCounters, setPreviewCounters] = useState<OperationCounters>(
    () => DEFAULT_OPERATION_V2_DATA.counters,
  )
  function changePreviewCounter(key: OperationItemKey, value: number) {
    setPreviewCounters((prev) => ({ ...prev, [key]: value }))
  }

  function openEditor() {
    if (!data.window) {
      const seeded: OperationWindowV2Data = { ...DEFAULT_OPERATION_V2_DATA }
      updateNodeData(id, { window: seeded })
    }
    setEditing(true)
  }

  function setOperationId(next: string) {
    updateNodeData(id, { operationId: next.trim() })
  }

  function setTitle(next: string) {
    updateNodeData(id, { title: next })
  }

  function updateWindow(patch: Partial<OperationWindowV2Data>) {
    const current = data.window ?? DEFAULT_OPERATION_V2_DATA
    // Never persist counter state from the editor preview —
    // counters are runtime state, not design data.
    const { counters: _droppedCounters, ...persistablePatch } = patch
    void _droppedCounters
    updateNodeData(id, { window: { ...current, ...persistablePatch } })
  }

  /** Pick / change the click sound for one item. Empty string
   *  means "use the default"; the `OPERATION_SOUND_NONE` sentinel
   *  means "play nothing". */
  function setItemSound(key: OperationItemKey, value: string) {
    const current = data.window ?? DEFAULT_OPERATION_V2_DATA
    const nextSounds = { ...(current.itemSounds ?? {}) }
    if (!value) delete nextSounds[key]
    else nextSounds[key] = value
    updateWindow({ itemSounds: nextSounds })
  }

  /** Play a sound URL once. Used by the preview button next to
   *  each picker so the editor user can hear the choice. */
  function previewSound(src: string) {
    if (!src || src === OPERATION_SOUND_NONE) return
    try {
      const a = new Audio(assetUrl(src))
      a.play().catch(() => { /* autoplay blocked — ignore */ })
    } catch { /* ignore */ }
  }

  return (
    <div style={{
      background: '#fae8e0', border: '2px solid #993c1d', borderRadius: 8,
      padding: '12px 18px', minWidth: 220, fontFamily: 'sans-serif',
    }}>
      <Handle type="target" position={Position.Top} />

      <div style={{ fontWeight: 700, fontSize: 13, color: '#993c1d', marginBottom: 4 }}>
        ⚙️ Operation
        <input
          type="text"
          className="nodrag"
          value={data.operationId}
          onChange={(e) => setOperationId(e.target.value)}
          aria-label="Operation id"
          style={{
            width: 96, marginLeft: 6, padding: '1px 4px',
            border: '1px solid #d8b09a', borderRadius: 3,
            font: 'inherit', color: '#993c1d', background: '#fff',
          }}
        />
      </div>

      <input
        type="text"
        className="nodrag"
        value={data.title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Operation title"
        style={{
          width: '100%', marginBottom: 8, padding: '2px 6px',
          border: '1px solid #d8b09a', borderRadius: 3,
          font: 'inherit', fontSize: 12, color: '#333', background: '#fff',
        }}
      />

      <button type="button" className={`nodrag ${styles.editBtn}`} onClick={openEditor}>
        Edit operation window
      </button>

      <div style={{ marginTop: 6 }}>
        <a
          href={appPath(`/game?startOperation=${encodeURIComponent(data.operationId)}`)}
          target="_blank"
          rel="noreferrer"
          style={{ fontSize: 11, color: '#993c1d', textDecoration: 'underline' }}
        >
          ▶ Preview this operation
        </a>
      </div>

      <Handle type="source" position={Position.Bottom} />

      {editing && createPortal(
        <div className={`nodrag nowheel ${styles.backdrop}`} onClick={() => setEditing(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <button type="button" className={styles.closeBtn} onClick={() => setEditing(false)}>
              Close
            </button>
            {/* Editable preview — the editor user can step the
                counters here to see how the window will look at
                each count, but those changes stay LOCAL (not
                saved) so the live game always starts with every
                item at zero. Copy edits (title, header text, CTA
                label, per-item sounds) still persist via
                updateWindow(). */}
            <OperationWindowV2
              data={{
                ...(data.window ?? DEFAULT_OPERATION_V2_DATA),
                counters: previewCounters,
              }}
              onChangeCounter={changePreviewCounter}
            />

            {/* Per-item sound picker. Each row is one item; the
                dropdown lists every registered sound (see
                src/lib/operationSounds.ts) plus a "Default" entry
                that clears the override, and a "None" entry that
                silences that item entirely. The play button
                previews the current selection. */}
            <div className={styles.soundPicker}>
              <p className={styles.soundPickerTitle}>Item click sounds</p>
              {ITEM_KEYS.map((key) => {
                const stored = data.window?.itemSounds?.[key] ?? ''
                return (
                  <div key={key} className={styles.soundRow}>
                    <span className={styles.soundLabel}>{ITEM_LABELS[key]}</span>
                    <select
                      className={`nodrag ${styles.soundSelect}`}
                      value={stored}
                      onChange={(e) => setItemSound(key, e.target.value)}
                    >
                      <option value="">Default</option>
                      <option value={OPERATION_SOUND_NONE}>None (silent)</option>
                      {OPERATION_SOUNDS.map((s) => (
                        <option key={s.id} value={s.src}>{s.label}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className={`nodrag ${styles.soundPlayBtn}`}
                      onClick={() => previewSound(stored)}
                      disabled={!stored || stored === OPERATION_SOUND_NONE}
                      title="Play preview"
                    >
                      ▶
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
