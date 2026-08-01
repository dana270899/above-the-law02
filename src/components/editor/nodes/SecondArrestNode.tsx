import { Handle, Position, useReactFlow } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import type { SecondArrestFlowNode } from '@/types/editor'

/** Dedicated decision gate used inside the main graph flow. */
export function SecondArrestNode({ id, data }: NodeProps<SecondArrestFlowNode>) {
  const { updateNodeData } = useReactFlow()
  return (
    <div style={{
      background: '#ffe8e8', border: '2px solid #b42318', borderRadius: 8,
      padding: '12px 14px', minWidth: 230, fontFamily: 'sans-serif',
    }}>
      <Handle type="target" position={Position.Top} />
      <div style={{ fontWeight: 700, fontSize: 13, color: '#8f1710' }}>
        🛑 Wait for Second Arrest
      </div>
      <div style={{ fontSize: 11, color: '#8f1710', marginTop: 6, lineHeight: 1.4 }}>
        Waits for the player to choose Arrest or Release.
      </div>
      <label className="nodrag" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 11, color: '#8f1710' }}>
        <input
          type="checkbox"
          checked={data.resetDecisionOnEnter ?? true}
          onChange={(e) => updateNodeData(id, { resetDecisionOnEnter: e.target.checked })}
        />
        Reset previous decision on enter
      </label>
      <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 14, fontSize: 11, fontWeight: 700, color: '#8f1710' }}>
        <span>Arrest</span>
        <span>Release</span>
      </div>
      <Handle id="arrest" type="source" position={Position.Bottom} style={{ left: '28%' }} />
      <Handle id="release" type="source" position={Position.Bottom} style={{ left: '72%' }} />
    </div>
  )
}
