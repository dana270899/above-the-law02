import { useEffect, useState } from 'react'
import { Handle, Position, useReactFlow } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import type { PointsFlowNode } from '@/types/editor'

export function PointsNode({ id, data }: NodeProps<PointsFlowNode>) {
  const { updateNodeData } = useReactFlow()
  const amount = Number.isFinite(data.amount) ? Math.round(data.amount) : 0
  const [draft, setDraft] = useState(String(amount))

  useEffect(() => setDraft(String(amount)), [amount])

  function commit(next: string) {
    setDraft(next)
    if (/^-?\d+$/.test(next)) updateNodeData(id, { amount: Number(next) })
  }

  return (
    <div style={{ background: '#eef8ff', border: '2px solid #2673a8', borderRadius: 8, padding: 12, minWidth: 220, fontFamily: 'sans-serif' }}>
      <Handle type="target" position={Position.Top} />
      <strong style={{ display: 'block', marginBottom: 8 }}>🎯 Points</strong>
      <label className="nodrag" style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 8, alignItems: 'center', fontSize: 11 }}>
        Amount
        <input
          type="number"
          step={1}
          value={draft}
          onChange={(event) => commit(event.target.value)}
          onBlur={() => {
            if (!/^-?\d+$/.test(draft)) commit('0')
          }}
        />
      </label>
      <div style={{ marginTop: 8, fontSize: 10, lineHeight: 1.4, color: '#315f7c' }}>
        Positive adds points; negative removes them. Continues automatically.
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}
