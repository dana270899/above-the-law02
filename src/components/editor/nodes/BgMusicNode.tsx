import { useRef } from 'react'
import { useReactFlow } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import type { BgMusicFlowNode } from '@/types/editor'
import {
  BG_MUSIC,
  DEFAULT_BG_MUSIC_ID,
  DEFAULT_BG_MUSIC_VOLUME,
} from '@/lib/bgMusic'

const CUSTOM_OPTION_VALUE = '__custom__'

/**
 * BgMusicNode — standalone "settings" node. No handles: it's never
 * walked through. The runtime finds it in the saved graph and plays
 * its track on loop behind every screen except the win-result screen.
 *
 * Author picks a track from the registry (or uploads a custom audio
 * file) and sets the default volume. The in-game volume slider lets
 * the player tweak the playing volume at runtime; that runtime tweak
 * isn't persisted on the node.
 */
export function BgMusicNode({ id, data }: NodeProps<BgMusicFlowNode>) {
  const { updateNodeData } = useReactFlow()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const hasCustom =
    typeof data.srcCustom === 'string' && data.srcCustom.length > 0
  const selectedId = hasCustom
    ? CUSTOM_OPTION_VALUE
    : (data.src ?? DEFAULT_BG_MUSIC_ID)
  const customLabel = data.srcCustomLabel ?? 'Custom (uploaded)'
  const volume = typeof data.volume === 'number' ? data.volume : DEFAULT_BG_MUSIC_VOLUME
  const volumePct = Math.round(volume * 100)

  function handleSelectChange(next: string) {
    if (next === CUSTOM_OPTION_VALUE) return
    updateNodeData(id, {
      src: next,
      srcCustom: undefined,
      srcCustomLabel: undefined,
    })
  }

  function handleUploadClick() {
    fileInputRef.current?.click()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result
      if (typeof dataUrl !== 'string') return
      try {
        updateNodeData(id, {
          srcCustom: dataUrl,
          srcCustomLabel: file.name,
        })
      } catch {
        alert('Audio too large to attach to this node. Try a smaller file.')
      }
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function clearCustom() {
    updateNodeData(id, {
      srcCustom: undefined,
      srcCustomLabel: undefined,
    })
  }

  function handleVolumeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const pct = Number(e.target.value)
    if (!Number.isFinite(pct)) return
    const clamped = Math.max(0, Math.min(100, pct))
    updateNodeData(id, { volume: clamped / 100 })
  }

  return (
    <div style={{
      background: '#eef2ff',
      border: '2px solid #4f46e5',
      borderRadius: 8, padding: '10px 16px', minWidth: 220,
      fontFamily: 'sans-serif',
    }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: '#4f46e5' }}>
        🎵 Background Music
      </div>
      <div style={{ fontSize: 11, color: '#555', marginTop: 4, marginBottom: 8 }}>
        Plays on loop behind every screen except the win screen.
      </div>

      <div className="nodrag" style={{ marginBottom: 8 }}>
        <label
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 11, color: '#4f46e5', marginBottom: 4,
          }}
        >
          Track:
          <select
            className="nodrag"
            value={selectedId}
            onChange={(e) => handleSelectChange(e.target.value)}
            style={{
              flex: 1, font: 'inherit', padding: '1px 4px',
              border: '1px solid #c7d2fe', borderRadius: 3,
              background: '#fff', color: '#4f46e5',
            }}
          >
            {BG_MUSIC.map((opt) => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
            {hasCustom && (
              <option value={CUSTOM_OPTION_VALUE}>{customLabel}</option>
            )}
          </select>
        </label>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            type="button"
            className="nodrag"
            onClick={handleUploadClick}
            style={{
              font: 'inherit', fontSize: 11, padding: '2px 8px',
              border: '1px solid #c7d2fe', borderRadius: 3,
              background: '#fff', color: '#4f46e5', cursor: 'pointer',
            }}
          >
            ⬆ Upload track
          </button>
          {hasCustom && (
            <button
              type="button"
              className="nodrag"
              onClick={clearCustom}
              style={{
                font: 'inherit', fontSize: 11, padding: '2px 8px',
                border: '1px solid #d4b6b6', borderRadius: 3,
                background: '#fff', color: '#a32d2d', cursor: 'pointer',
              }}
            >
              ✕ Clear
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </div>
        {hasCustom && (
          <div
            style={{
              fontSize: 10, color: '#555', marginTop: 4,
              maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={customLabel}
          >
            📎 {customLabel}
          </div>
        )}
      </div>

      <label
        className="nodrag"
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 11, color: '#4f46e5',
        }}
      >
        Volume:
        <input
          className="nodrag"
          type="range"
          min={0}
          max={100}
          step={1}
          value={volumePct}
          onChange={handleVolumeChange}
          style={{ flex: 1 }}
        />
        <span style={{ minWidth: 28, textAlign: 'right' }}>{volumePct}%</span>
      </label>
    </div>
  )
}
