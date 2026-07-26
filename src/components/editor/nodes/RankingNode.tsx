import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import type { RankingFlowNode } from '@/types/editor'

export function RankingNode({ data }: NodeProps<RankingFlowNode>) {
  return (
    <div style={{ background: '#fff4cc', border: '2px solid #9b6b00', borderRadius: 8, padding: 12, minWidth: 230, fontFamily: 'sans-serif' }}>
      <Handle type="target" position={Position.Top} />
      <strong>🏆 {data.title || 'Final Ranking'}</strong>
      <div style={{ marginTop: 6, fontSize: 11, color: '#6f5300' }}>Connect the final result here.</div>
    </div>
  )
}
