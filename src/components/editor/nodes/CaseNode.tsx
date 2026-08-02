import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Handle, Position, useReactFlow } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import type { CaseFlowNode, GameFlowEdge, GameFlowNode } from '@/types/editor'
import {
  CaseWindowV2 as CaseWindow,
  DEFAULT_CASE_DATA,
  type CaseWindowData,
} from '@/components/CaseWindow'
import { caseNumberForOrder, moveCaseToOrder } from '@/lib/caseOrder'
import { appPath } from '@/lib/paths'
import styles from './CaseNode.module.css'

export function CaseNode({ id, data }: NodeProps<CaseFlowNode>) {
  const { updateNodeData, setEdges, getNodes, getEdges, setNodes } =
    useReactFlow<GameFlowNode, GameFlowEdge>()
  const [editing, setEditing] = useState(false)
  const [orderDraft, setOrderDraft] = useState(String(data.order))
  const caseNumber = caseNumberForOrder(data.order)
  const caseWindowData: CaseWindowData = {
    ...(data.window ?? DEFAULT_CASE_DATA),
    caseId: caseNumber,
  }

  useEffect(() => {
    setOrderDraft(String(data.order))
  }, [data.order])

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
  if (data.isImportant)  flags.push('⭐ Important')
  if (data.arrestContinuesWithoutDecision) flags.push('↪️ Arrest continues only')

  function openEditor() {
    if (!data.window) {
      // Lazily seed with the Figma default + the order-derived case number.
      const seeded: CaseWindowData = {
        ...DEFAULT_CASE_DATA,
        caseId: caseNumber,
      }
      updateNodeData(id, { window: seeded })
    }
    setEditing(true)
  }

  /** Apply content edits while keeping identity derived from order. */
  function applyPatch(patch: Partial<CaseWindowData>) {
    const current = data.window ?? DEFAULT_CASE_DATA
    updateNodeData(id, {
      window: { ...current, ...patch, caseId: caseNumber },
    })
  }

  function commitOrder() {
    const nextOrder = Number(orderDraft)
    if (Number.isInteger(nextOrder) && nextOrder >= 1) {
      const nextNodes = moveCaseToOrder(getNodes(), getEdges(), id, nextOrder)
      setNodes(nextNodes)
      const movedCase = nextNodes.find((node) => node.id === id)
      setOrderDraft(String(movedCase?.type === 'case' ? movedCase.data.order : data.order))
      return
    }
    setOrderDraft(String(data.order))
  }

  return (
    <div style={{
      background: '#e6f1fb', border: '2px solid #185fa5', borderRadius: 8,
      padding: '12px 18px', minWidth: 220, fontFamily: 'sans-serif',
    }}>
      <Handle type="target" position={Position.Top} />

      <div style={{ fontWeight: 700, fontSize: 13, color: '#0c447c', marginBottom: 4 }}>
        Case #{' '}
        <span
          aria-label="Case number"
          style={{
            display: 'inline-block', minWidth: 48, padding: '1px 4px',
            borderRadius: 3, color: '#0c447c', background: '#d8e9f8',
          }}
        >
          {caseNumber}
        </span>
        <label style={{ marginLeft: 8, fontWeight: 400, fontSize: 11, color: '#5b7596' }}>
          order{' '}
          <input
            type="number"
            className="nodrag nowheel"
            min={1}
            step={1}
            value={orderDraft}
            onChange={(e) => setOrderDraft(e.target.value)}
            onBlur={commitOrder}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') {
                setOrderDraft(String(data.order))
                e.currentTarget.blur()
              }
            }}
            aria-label="Case order"
            style={{
              width: 42, padding: '1px 3px',
              border: '1px solid #c2d4e6', borderRadius: 3,
              font: 'inherit', color: '#0c447c', background: '#fff',
            }}
          />
        </label>
      </div>
      <div style={{ fontSize: 12, color: '#333', marginBottom: 6 }}>Case {data.order}</div>

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

      <label className="nodrag" style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 11, color: '#0c447c' }}>
        <input
          type="checkbox"
          checked={!!data.isImportant}
          onChange={(e) => updateNodeData(id, { isImportant: e.target.checked })}
        />
        Important case
      </label>

      <label
        className="nodrag"
        style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 11, color: '#0c447c' }}
        title="Follow the Arrest wire without changing the case to Arrested"
      >
        <input
          type="checkbox"
          checked={!!data.arrestContinuesWithoutDecision}
          onChange={(e) => updateNodeData(id, { arrestContinuesWithoutDecision: e.target.checked })}
        />
        Arrest continues without arresting
      </label>

      <div style={{ marginTop: 6 }}>
        <a
          href={appPath(`/game?startCase=${encodeURIComponent(caseNumber)}`)}
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
              data={caseWindowData}
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
