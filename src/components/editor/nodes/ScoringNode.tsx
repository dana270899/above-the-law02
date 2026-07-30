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
    <div style={{ background: '#e8f6e8', border: '2px solid #287a3e', borderRadius: 8, padding: 12, minWidth: 285, fontFamily: 'sans-serif' }}>
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
      <div style={{ marginTop: 11, paddingTop: 9, borderTop: '1px solid #9bc4a5', fontSize: 10, lineHeight: 1.45, color: '#244f30' }}>
        <strong>Speed bonus logic</strong>
        <div>Bonus = max extra × max(0, 1 − active time ÷ time limit), rounded.</div>
        <div style={{ marginTop: 5 }}>
          Active time starts when a case opens. It pauses when Cases is closed or minimized,
          another case is selected, or another desktop app opens. Returning resumes the same timer.
        </div>
        <div style={{ marginTop: 5 }}>
          The first Arrest or Release permanently stops the timer, including retry cases.
          Win screens and post-decision time never count. Wrong answers get no speed bonus.
          Boss messages and Achievements do not pause it.
        </div>
      </div>
    </div>
  )
}
