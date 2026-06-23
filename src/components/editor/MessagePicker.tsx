import { useState } from 'react'

/**
 * MESSAGE PICKER
 * A small reusable control for editing a list of message-node ids
 * referenced from another node's data (e.g. CaseNode's messagesOnArrest,
 * SuspicionRow's messagesOnExpand). Shows the current selection as
 * removable chips plus a dropdown + Add button for new picks.
 *
 * The available options come from the parent (the picker does NOT call
 * React Flow itself) so it works both inside the canvas (CaseNode) and
 * inside the modal CaseWindow editor.
 */

export interface MessagePickerOption {
  id: string
  preview: string
}

export interface MessagePickerProps {
  label: string
  selected: string[]
  available: MessagePickerOption[]
  onChange: (next: string[]) => void
}

export function messagePreview(content: string): string {
  const trimmed = (content ?? '').trim().replace(/\s+/g, ' ')
  if (trimmed.length <= 28) return trimmed
  return trimmed.slice(0, 27) + '…'
}

export function MessagePicker({
  label,
  selected,
  available,
  onChange,
}: MessagePickerProps) {
  const [pickerId, setPickerId] = useState<string>('')
  const remaining = available.filter((a) => !selected.includes(a.id))

  function add() {
    if (!pickerId) return
    if (selected.includes(pickerId)) return
    onChange([...selected, pickerId])
    setPickerId('')
  }

  function remove(idToRemove: string) {
    onChange(selected.filter((s) => s !== idToRemove))
  }

  return (
    <div style={{ marginBottom: 8, fontSize: 11, color: '#0c447c' }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>

      {selected.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
          {selected.map((sid) => {
            const opt = available.find((a) => a.id === sid)
            const text = opt ? (opt.preview || sid) : `${sid} (missing)`
            return (
              <span
                key={sid}
                className="nodrag"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: 10, background: '#dff0ff',
                  border: '1px solid #7ea9d1', borderRadius: 4,
                  padding: '1px 4px 1px 6px', color: '#0c447c',
                }}
              >
                💬 {text}
                <button
                  type="button"
                  className="nodrag"
                  onClick={() => remove(sid)}
                  aria-label={`Remove message ${sid}`}
                  style={{
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: '#0c447c', font: 'inherit', padding: 0, lineHeight: 1,
                  }}
                >×</button>
              </span>
            )
          })}
        </div>
      )}

      <div style={{ display: 'flex', gap: 4 }}>
        <select
          className="nodrag"
          value={pickerId}
          onChange={(e) => setPickerId(e.target.value)}
          disabled={remaining.length === 0}
          style={{
            flex: 1, minWidth: 0, fontSize: 11, padding: '1px 4px',
            border: '1px solid #c2d4e6', borderRadius: 3, background: '#fff',
            color: '#0c447c',
          }}
        >
          <option value="">
            {remaining.length === 0
              ? 'No message nodes available'
              : 'Pick a message node…'}
          </option>
          {remaining.map((r) => (
            <option key={r.id} value={r.id}>
              {r.preview || r.id}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="nodrag"
          onClick={add}
          disabled={!pickerId}
          style={{
            fontSize: 11, padding: '1px 8px',
            background: pickerId ? '#185fa5' : '#9ab',
            color: '#fff', border: 'none', borderRadius: 3,
            cursor: pickerId ? 'pointer' : 'not-allowed',
          }}
        >+ Add</button>
      </div>
    </div>
  )
}
