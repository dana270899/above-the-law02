import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import type { LoginFlowNode } from '@/types/editor'
import { appPath } from '@/lib/paths'

export function LoginNode({ data }: NodeProps<LoginFlowNode>) {
  return (
    <div style={{
      background: '#fffdf3',
      border: '2px solid #c8a800',
      borderRadius: 8,
      padding: '12px 18px',
      minWidth: 180,
      fontFamily: 'sans-serif',
    }}>
      {/* No target handle — Login is the game's entry point, nothing flows into it */}

      <div style={{ fontWeight: 700, fontSize: 13, color: '#171717', marginBottom: 4 }}>
        🔑 {data.label}
      </div>
      <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>Login Screen</div>

      <a
        href={appPath('/game')}
        target="_blank"
        rel="noreferrer"
        style={{ fontSize: 11, color: '#c8a800', textDecoration: 'underline' }}
      >
        ▶ Play from here
      </a>

      {/* Source handle — connects forward to the Intro node */}
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}
