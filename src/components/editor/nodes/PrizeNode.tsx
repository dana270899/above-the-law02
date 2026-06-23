import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import type { PrizeFlowNode } from '@/types/editor'

export function PrizeNode({ data }: NodeProps<PrizeFlowNode>) {
  return (
    <div style={{
      background: '#faeede', border: '2px solid #854f0b', borderRadius: 8,
      padding: '10px 16px', minWidth: 160, fontFamily: 'sans-serif',
    }}>
      <Handle type="target" position={Position.Top} />
      <div style={{ fontSize: 22 }}>{data.emoji}</div>
      <div style={{ fontWeight: 700, fontSize: 12, color: '#854f0b', marginTop: 4 }}>{data.title}</div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}
