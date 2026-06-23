import { Handle, Position, useReactFlow } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import type {
  CaseFlowNode,
  TriggerFlowNode,
  TriggerNodeData,
  TriggerType,
} from '@/types/editor'

/**
 * TRIGGER NODE — picks a player-choice event on a case and feeds it
 * into a connected message. Topology in the graph:
 *
 *   [Case node] --(trigger handle)--> [Trigger node] --> [Message node]
 *
 * The runtime never walks through this node. When the player performs
 * the configured player choice inside the source case, the runtime
 * collects every message-node id reachable from this trigger's output
 * edge and fires them as an overlay queue before running the original
 * action (arrest, expand row, open footage, …).
 */
const TRIGGER_LABEL: Record<TriggerType, string> = {
  arrest:         'On Arrest',
  release:        'On Release',
  expandRow:      'On suspicion row expand',
  attachmentRow: 'On suspicion attachment',
}

export function TriggerNode({ id, data }: NodeProps<TriggerFlowNode>) {
  const { updateNodeData, getNodes, getEdges } = useReactFlow()

  function set<K extends keyof TriggerNodeData>(field: K, value: TriggerNodeData[K]) {
    updateNodeData(id, { [field]: value })
  }

  // Resolve which case this trigger is wired to (by walking the
  // incoming edge) so the row picker can offer real row ids.
  const incomingCase = (() => {
    const incoming = getEdges().find((e) => e.target === id)
    if (!incoming) return null
    const source = getNodes().find((n) => n.id === incoming.source)
    return source?.type === 'case' ? (source as CaseFlowNode) : null
  })()

  const sourceRows = incomingCase?.data.window?.suspicions ?? []
  const needsRow = data.triggerType === 'expandRow' || data.triggerType === 'attachmentRow'

  return (
    <div style={{
      background: '#fff7e6', border: '2px solid #c48400', borderRadius: 8,
      padding: '10px 14px', minWidth: 220, fontFamily: 'sans-serif',
    }}>
      <Handle type="target" position={Position.Top} />

      <div style={{ fontWeight: 700, fontSize: 13, color: '#7a4f00', marginBottom: 6 }}>
        ⚡ Trigger
      </div>

      <div style={{ fontSize: 11, color: '#7a4f00', marginBottom: 2 }}>When</div>
      <select
        className="nodrag"
        value={data.triggerType}
        onChange={(e) => set('triggerType', e.target.value as TriggerType)}
        style={{
          width: '100%', fontSize: 12, padding: '2px 4px',
          border: '1px solid #d8b66a', borderRadius: 3, background: '#fff',
          color: '#7a4f00', marginBottom: 6,
        }}
      >
        {(Object.keys(TRIGGER_LABEL) as TriggerType[]).map((t) => (
          <option key={t} value={t}>{TRIGGER_LABEL[t]}</option>
        ))}
      </select>

      {needsRow && (
        <>
          <div style={{ fontSize: 11, color: '#7a4f00', marginBottom: 2 }}>
            Suspicion row
            {!incomingCase && (
              <span style={{ color: '#9a6f00', marginLeft: 4 }}>
                (connect a case first)
              </span>
            )}
          </div>
          <select
            className="nodrag"
            value={data.targetRowId ?? ''}
            onChange={(e) => set('targetRowId', e.target.value)}
            disabled={!incomingCase || sourceRows.length === 0}
            style={{
              width: '100%', fontSize: 12, padding: '2px 4px',
              border: '1px solid #d8b66a', borderRadius: 3, background: '#fff',
              color: '#7a4f00',
            }}
          >
            <option value="">
              {sourceRows.length === 0 ? 'No rows on connected case' : 'Pick a row…'}
            </option>
            {sourceRows.map((r) => (
              <option key={r.id} value={r.id}>
                {r.id} — {r.subject || '(no subject)'}
              </option>
            ))}
          </select>
        </>
      )}

      {(data.triggerType === 'arrest' || data.triggerType === 'release') && (
        <label
          className="nodrag"
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 11, color: '#7a4f00', marginTop: 6,
          }}
        >
          <input
            type="checkbox"
            checked={data.retry ?? false}
            onChange={(e) => set('retry', e.target.checked)}
          />
          Retry (don’t advance, clear decision)
        </label>
      )}

      <div style={{ fontSize: 11, color: '#7a4f00', marginTop: 8, marginBottom: 2 }}>
        Delay before fire
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          className="nodrag"
          type="number"
          min={0}
          step={0.1}
          value={data.delaySeconds ?? 0}
          onChange={(e) => {
            const n = Number(e.target.value)
            set('delaySeconds', Number.isFinite(n) && n >= 0 ? n : 0)
          }}
          style={{
            flex: 1, fontSize: 12, padding: '2px 4px',
            border: '1px solid #d8b66a', borderRadius: 3, background: '#fff',
            color: '#7a4f00',
          }}
        />
        <span style={{ fontSize: 11, color: '#7a4f00' }}>seconds</span>
      </div>

      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}
