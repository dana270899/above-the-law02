import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Handle, Position, useReactFlow } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import type { CaseFlowNode } from '@/types/editor'
import {
  CaseWindow,
  DEFAULT_CASE_DATA,
  type CaseWindowData,
} from '@/components/CaseWindow'
import styles from './CaseNode.module.css'

export function CaseNode({ id, data }: NodeProps<CaseFlowNode>) {
  const { updateNodeData, setEdges } = useReactFlow()
  const [editing, setEditing] = useState(false)

  /** Flip the source handle on every outgoing walker edge from this
   *  case: 'arrest' ↔ 'release'. Useful when the player decision that
   *  *should* win this case is the opposite of how the wires were
   *  originally dragged — instead of redoing the connections by hand,
   *  one click swaps both edges at once. Trigger-handle edges are
   *  left alone. */
  function swapArrestRelease() {
    setEdges((eds) => eds.map((e) => {
      if (e.source !== id) return e
      if (e.sourceHandle === 'arrest')  return { ...e, sourceHandle: 'release' }
      if (e.sourceHandle === 'release') return { ...e, sourceHandle: 'arrest' }
      return e
    }))
  }

  const flags: string[] = []
  if (data.hasOperation) flags.push('⚙️ Operation')
  if (data.isBothWin)    flags.push('🔀 Both win')
  if (data.useCamera)    flags.push('📸 Camera')

  function openEditor() {
    if (!data.window) {
      // Lazily seed with the Figma default + this node's case id/title
      const seeded: CaseWindowData = {
        ...DEFAULT_CASE_DATA,
        caseId: data.caseId || DEFAULT_CASE_DATA.caseId,
      }
      updateNodeData(id, { window: seeded })
    }
    setEditing(true)
  }

  /** Apply a patch from the inner CaseWindow editor.
   *  Special-case caseId: keep the node-level `data.caseId` in sync so
   *  the game has a single source of truth. */
  function applyPatch(patch: Partial<CaseWindowData>) {
    const current = data.window ?? DEFAULT_CASE_DATA
    const nodePatch: Partial<CaseFlowNode['data']> = {
      window: { ...current, ...patch },
    }
    if (typeof patch.caseId === 'string') nodePatch.caseId = patch.caseId
    updateNodeData(id, nodePatch)
  }

  /** Update the node-level caseId from the on-node input.
   *  Mirrors into `data.window.caseId` so the case window body stays
   *  in sync with the tab label. */
  function setCaseId(next: string) {
    const trimmed = next
    const windowPatch = data.window
      ? { window: { ...data.window, caseId: trimmed } }
      : {}
    updateNodeData(id, { caseId: trimmed, ...windowPatch })
  }

  return (
    <div style={{
      background: '#e6f1fb', border: '2px solid #185fa5', borderRadius: 8,
      padding: '12px 18px', minWidth: 220, fontFamily: 'sans-serif',
    }}>
      <Handle type="target" position={Position.Top} />

      <div style={{ fontWeight: 700, fontSize: 13, color: '#0c447c', marginBottom: 4 }}>
        Case #
        <input
          type="text"
          className="nodrag"
          value={data.caseId}
          onChange={(e) => setCaseId(e.target.value)}
          aria-label="Case number"
          style={{
            width: 64, marginLeft: 4, padding: '1px 4px',
            border: '1px solid #c2d4e6', borderRadius: 3,
            font: 'inherit', color: '#0c447c', background: '#fff',
          }}
        />
        <span style={{ marginLeft: 8, fontWeight: 400, fontSize: 11, color: '#5b7596' }}>
          (order {data.order})
        </span>
      </div>
      <div style={{ fontSize: 12, color: '#333', marginBottom: 6 }}>{data.title}</div>

      {flags.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
          {flags.map((f) => (
            <span key={f} style={{
              fontSize: 10, background: '#ffd', border: '1px solid #aaa',
              borderRadius: 4, padding: '1px 6px',
            }}>{f}</span>
          ))}
        </div>
      )}

      <button type="button" className={`nodrag ${styles.editBtn}`} onClick={openEditor}>
        Edit case window
      </button>

      <button
        type="button"
        className={`nodrag ${styles.editBtn}`}
        onClick={swapArrestRelease}
        title="Swap which player decision (Arrest / Release) each outgoing edge belongs to"
        style={{ marginTop: 4, background: '#fff4d6', borderColor: '#c48400', color: '#7a4f00' }}
      >
        ⇄ Swap Arrest ↔ Release wires
      </button>

      <label
        className="nodrag"
        style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 11, color: '#0c447c' }}
        title="Replace the ID photo with the player's live webcam for this case"
      >
        <input
          type="checkbox"
          checked={!!data.useCamera}
          onChange={(e) => updateNodeData(id, { useCamera: e.target.checked })}
        />
        Use live webcam in photo slot
      </label>

      <div style={{ marginTop: 6 }}>
        <a
          href={`/game?startCase=${encodeURIComponent(data.caseId)}`}
          target="_blank"
          rel="noreferrer"
          style={{ fontSize: 11, color: '#185fa5', textDecoration: 'underline' }}
        >
          ▶ Play from this case
        </a>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        id="arrest"
        style={{ left: '30%', background: '#faa', border: '2px solid #a32' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="release"
        style={{ left: '70%', background: '#aef', border: '2px solid #26e' }}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#888', marginTop: 4 }}>
        <span>Arrest</span>
        <span>Release</span>
      </div>

      {/* Dedicated source handle for Trigger nodes — sits on the right
          edge so it doesn't get confused with the arrest/release flow
          handles. Trigger nodes drag their input from this handle. */}
      <Handle
        type="source"
        position={Position.Right}
        id="trigger"
        style={{ background: '#fc8', border: '2px solid #c48400' }}
      />
      <span style={{
        position: 'absolute', right: -4, top: '50%', transform: 'translate(100%, -50%)',
        fontSize: 10, color: '#c48400', whiteSpace: 'nowrap', marginLeft: 6,
        pointerEvents: 'none',
      }}>
        ⚡ Triggers
      </span>

      {editing && createPortal(
        <div className={`nodrag nowheel ${styles.backdrop}`} onClick={() => setEditing(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <button type="button" className={styles.closeBtn} onClick={() => setEditing(false)}>
              Close
            </button>
            <CaseWindow
              data={data.window ?? DEFAULT_CASE_DATA}
              editable
              onChange={applyPatch}
              useCamera={!!data.useCamera}
            />
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
