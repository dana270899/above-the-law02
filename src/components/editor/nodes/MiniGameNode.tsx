import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import type { MiniGameFlowNode } from '@/types/editor'

export function MiniGameNode({ data }: NodeProps<MiniGameFlowNode>) {
  return (
    <div style={{ background: '#fff4cf', border: '2px solid #9a6b00', borderRadius: 8, padding: 12, minWidth: 220, fontFamily: 'sans-serif' }}>
      <Handle type="target" position={Position.Top} />
      <strong style={{ display: 'block', marginBottom: 5 }}>🎮 {data.label || 'Mini Game'}</strong>
      <div style={{ fontSize: 10, lineHeight: 1.4, color: '#684b08' }}>
        Opens automatically. Closing or choosing the next case continues through the outgoing connection.
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}
