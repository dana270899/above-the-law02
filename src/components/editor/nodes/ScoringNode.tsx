import { useReactFlow } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import type { ScoringFlowNode } from '@/types/editor'

export function ScoringNode({ id, data }: NodeProps<ScoringFlowNode>) {
  const { updateNodeData } = useReactFlow()
  const numberField = (label: string, key: keyof ScoringFlowNode['data']) => (
    <label className="nodrag" style={{ display: 'grid', gridTemplateColumns: '1fr 70px', gap: 8, alignItems: 'center', fontSize: 11 }}>
      {label}
      <input type="number" min={0} value={Number(data[key])} onChange={(event) => updateNodeData(id, { [key]: Math.max(0, Number(event.target.value)) })} />
    </label>
  )

  return (
    <div style={{ background: '#e8f6e8', border: '2px solid #287a3e', borderRadius: 8, padding: 12, minWidth: 245, fontFamily: 'sans-serif' }}>
      <strong style={{ display: 'block', marginBottom: 4 }}>🎯 Global Points</strong>
      <div style={{ marginBottom: 9, fontSize: 10, color: '#356342' }}>Controls every case · no connection needed</div>
      <div style={{ display: 'grid', gap: 5 }}>
        {numberField('Winning target', 'winningTarget')}
        {numberField('Normal / first', 'normalFirstPoints')}
        {numberField('Normal / second', 'normalSecondPoints')}
        {numberField('Important / first', 'importantFirstPoints')}
        {numberField('Important / second', 'importantSecondPoints')}
        <label className="nodrag" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, fontSize: 11 }}>
          <input type="checkbox" checked={data.speedBonusEnabled} onChange={(event) => updateNodeData(id, { speedBonusEnabled: event.target.checked })} />
          Speed bonus for all cases
        </label>
        {data.speedBonusEnabled && (
          <>
            {numberField('Speed time limit', 'speedTimeLimitSeconds')}
            {numberField('Maximum extra points', 'speedMaxBonus')}
          </>
        )}
      </div>
    </div>
  )
}
