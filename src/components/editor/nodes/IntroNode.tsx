import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import type { IntroFlowNode } from '@/types/editor'

export function IntroNode({ data }: NodeProps<IntroFlowNode>) {
  return (
    <div style={{
      background: '#ede9fe', border: '2px solid #534ab7', borderRadius: 8,
      padding: '12px 18px', minWidth: 180, fontFamily: 'sans-serif',
    }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: '#3c3489', marginBottom: 4 }}>
        🎬 {data.label}
      </div>
      <div style={{ fontSize: 11, color: '#666' }}>Opening messages</div>
      <a
        href="/"
        style={{ display: 'block', marginTop: 8, fontSize: 11, color: '#534ab7', textDecoration: 'underline' }}
      >
        ▶ Play from start
      </a>
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}
