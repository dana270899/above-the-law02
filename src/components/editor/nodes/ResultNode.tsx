import { useRef } from 'react'
import { Handle, Position, useReactFlow } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import type { ResultFlowNode } from '@/types/editor'
import { WIN_SCREENS, DEFAULT_WIN_SCREEN_ID } from '@/lib/winScreens'
import { WIN_SOUNDS, DEFAULT_WIN_SOUND_ID, WIN_SOUND_NONE } from '@/lib/winSounds'
import {
  saveAudioBlob,
  removeAudioBlob,
  makeAudioBlobId,
  makeImageBlobId,
} from '@/lib/audioBlobStore'

const CUSTOM_OPTION_VALUE = '__custom__'

export function ResultNode({ id, data }: NodeProps<ResultFlowNode>) {
  const { updateNodeData } = useReactFlow()
  const imageFileInputRef = useRef<HTMLInputElement | null>(null)
  const soundFileInputRef = useRef<HTMLInputElement | null>(null)
  const isWin = data.resultType === 'win'

  // ─── Image picker state ────────────────────────────────────
  // A custom image can live in two places — IndexedDB (new uploads,
  // referenced by id) or a legacy data URL stored directly on the node.
  // Either one overrides the registry selection.
  const hasCustomImage =
    (typeof data.winImageCustomId === 'string' && data.winImageCustomId.length > 0) ||
    (typeof data.winImageCustom === 'string' && data.winImageCustom.length > 0)
  const winImageId = hasCustomImage
    ? CUSTOM_OPTION_VALUE
    : (data.winImage ?? DEFAULT_WIN_SCREEN_ID)
  const customImageLabel = data.winImageCustomLabel ?? 'Custom (uploaded)'

  function handleImageSelectChange(next: string) {
    if (next === CUSTOM_OPTION_VALUE) return
    // Switching to a registry option clears any custom upload, including
    // the IndexedDB blob, so the registry choice actually takes effect.
    const prevId = data.winImageCustomId
    if (typeof prevId === 'string' && prevId.length > 0) {
      removeAudioBlob(prevId).catch(() => { /* ignore */ })
    }
    updateNodeData(id, {
      winImage: next,
      winImageCustom: undefined,
      winImageCustomLabel: undefined,
      winImageCustomId: undefined,
    })
  }

  function handleImageUploadClick() {
    imageFileInputRef.current?.click()
  }

  function handleImageFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const blobId = makeImageBlobId()
    saveAudioBlob(blobId, file)
      .then(() => {
        const prevId = data.winImageCustomId
        if (typeof prevId === 'string' && prevId.length > 0 && prevId !== blobId) {
          removeAudioBlob(prevId).catch(() => { /* ignore */ })
        }
        updateNodeData(id, {
          winImageCustomId: blobId,
          winImageCustomLabel: file.name,
          // Clear any legacy data URL so the runtime picks up the blob.
          winImageCustom: undefined,
        })
      })
      .catch(() => {
        alert(
          'Could not save the image. Your browser may have blocked IndexedDB ' +
            '(private mode?) or run out of disk space.',
        )
      })
    e.target.value = ''
  }

  function clearCustomImage() {
    const prevId = data.winImageCustomId
    if (typeof prevId === 'string' && prevId.length > 0) {
      removeAudioBlob(prevId).catch(() => { /* ignore */ })
    }
    updateNodeData(id, {
      winImageCustom: undefined,
      winImageCustomLabel: undefined,
      winImageCustomId: undefined,
    })
  }

  // ─── Sound picker state ────────────────────────────────────
  // A custom sound can live in two places — IndexedDB (new uploads,
  // referenced by id) or a legacy data URL stored directly on the node.
  // Either one overrides the registry selection.
  const hasCustomSound =
    (typeof data.winSoundCustomId === 'string' && data.winSoundCustomId.length > 0) ||
    (typeof data.winSoundCustom === 'string' && data.winSoundCustom.length > 0)
  const winSoundId = hasCustomSound
    ? CUSTOM_OPTION_VALUE
    : (data.winSound ?? DEFAULT_WIN_SOUND_ID)
  const customSoundLabel = data.winSoundCustomLabel ?? 'Custom (uploaded)'

  function handleSoundSelectChange(next: string) {
    if (next === CUSTOM_OPTION_VALUE) return
    // Switching back to a registry/none option clears the custom upload
    // (both the IndexedDB blob and any legacy data URL).
    const prevId = data.winSoundCustomId
    if (typeof prevId === 'string' && prevId.length > 0) {
      removeAudioBlob(prevId).catch(() => { /* ignore */ })
    }
    updateNodeData(id, {
      winSound: next,
      winSoundCustom: undefined,
      winSoundCustomLabel: undefined,
      winSoundCustomId: undefined,
    })
  }

  function handleSoundUploadClick() {
    soundFileInputRef.current?.click()
  }

  function handleSoundFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const blobId = makeAudioBlobId()
    saveAudioBlob(blobId, file)
      .then(() => {
        // Replace any previously stored blob from this node so we don't
        // leak orphans in IndexedDB.
        const prevId = data.winSoundCustomId
        if (typeof prevId === 'string' && prevId.length > 0 && prevId !== blobId) {
          removeAudioBlob(prevId).catch(() => { /* ignore */ })
        }
        updateNodeData(id, {
          winSoundCustomId: blobId,
          winSoundCustomLabel: file.name,
          // Clear the legacy data URL field so the runtime picks up the
          // new blob via id rather than a stale data URL.
          winSoundCustom: undefined,
        })
      })
      .catch(() => {
        alert(
          'Could not save the audio file. Your browser may have blocked IndexedDB ' +
            '(private mode?) or run out of disk space.',
        )
      })
    e.target.value = ''
  }

  function clearCustomSound() {
    const prevId = data.winSoundCustomId
    if (typeof prevId === 'string' && prevId.length > 0) {
      removeAudioBlob(prevId).catch(() => { /* ignore */ })
    }
    updateNodeData(id, {
      winSoundCustom: undefined,
      winSoundCustomLabel: undefined,
      winSoundCustomId: undefined,
    })
  }

  return (
    <div style={{
      background: isWin ? '#e1f5e8' : '#fceaea',
      border: `2px solid ${isWin ? '#0f6e56' : '#a32d2d'}`,
      borderRadius: 8, padding: '10px 16px', minWidth: 180,
      fontFamily: 'sans-serif',
    }}>
      <Handle type="target" position={Position.Top} />
      <div style={{ fontWeight: 700, fontSize: 13, color: isWin ? '#0f6e56' : '#a32d2d' }}>
        {isWin ? '✅ Win' : '❌ Lose'}
      </div>
      <div style={{ fontSize: 11, color: '#555', marginTop: 4, marginBottom: 8 }}>{data.label}</div>

      {/* Win-screen image picker — only shown on win results. Author
          either picks a registry image OR uploads a new one for THIS
          node. The upload is stored as a data URL on the node and
          overrides the registry choice. */}
      {isWin && (
        <div className="nodrag" style={{ marginBottom: 8 }}>
          <label
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 11, color: '#0f6e56', marginBottom: 4,
            }}
          >
            Image:
            <select
              className="nodrag"
              value={winImageId}
              onChange={(e) => handleImageSelectChange(e.target.value)}
              style={{
                flex: 1, font: 'inherit', padding: '1px 4px',
                border: '1px solid #b6dcc6', borderRadius: 3,
                background: '#fff', color: '#0f6e56',
              }}
            >
              {WIN_SCREENS.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
              {hasCustomImage && (
                <option value={CUSTOM_OPTION_VALUE}>{customImageLabel}</option>
              )}
            </select>
          </label>

          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button
              type="button"
              className="nodrag"
              onClick={handleImageUploadClick}
              style={{
                font: 'inherit', fontSize: 11, padding: '2px 8px',
                border: '1px solid #b6dcc6', borderRadius: 3,
                background: '#fff', color: '#0f6e56', cursor: 'pointer',
              }}
            >
              ⬆ Upload new image
            </button>
            {hasCustomImage && (
              <button
                type="button"
                className="nodrag"
                onClick={clearCustomImage}
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
              ref={imageFileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageFileChange}
              style={{ display: 'none' }}
            />
          </div>
          {hasCustomImage && (
            <div
              style={{
                fontSize: 10, color: '#555', marginTop: 4,
                maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={customImageLabel}
            >
              📎 {customImageLabel}
            </div>
          )}
        </div>
      )}

      {/* Win-screen sound picker — mirrors the image picker. "None"
          plays no sound; registry entries pick a bundled clip;
          uploads override both. */}
      {isWin && (
        <div className="nodrag" style={{ marginBottom: 8 }}>
          <label
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 11, color: '#0f6e56', marginBottom: 4,
            }}
          >
            Sound:
            <select
              className="nodrag"
              value={winSoundId}
              onChange={(e) => handleSoundSelectChange(e.target.value)}
              style={{
                flex: 1, font: 'inherit', padding: '1px 4px',
                border: '1px solid #b6dcc6', borderRadius: 3,
                background: '#fff', color: '#0f6e56',
              }}
            >
              <option value={WIN_SOUND_NONE}>🔇 None</option>
              {WIN_SOUNDS.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
              {hasCustomSound && (
                <option value={CUSTOM_OPTION_VALUE}>{customSoundLabel}</option>
              )}
            </select>
          </label>

          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button
              type="button"
              className="nodrag"
              onClick={handleSoundUploadClick}
              style={{
                font: 'inherit', fontSize: 11, padding: '2px 8px',
                border: '1px solid #b6dcc6', borderRadius: 3,
                background: '#fff', color: '#0f6e56', cursor: 'pointer',
              }}
            >
              ⬆ Upload new sound
            </button>
            {hasCustomSound && (
              <button
                type="button"
                className="nodrag"
                onClick={clearCustomSound}
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
              ref={soundFileInputRef}
              type="file"
              accept="audio/*"
              onChange={handleSoundFileChange}
              style={{ display: 'none' }}
            />
          </div>
          {hasCustomSound && (
            <div
              style={{
                fontSize: 10, color: '#555', marginTop: 4,
                maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={customSoundLabel}
            >
              📎 {customSoundLabel}
            </div>
          )}
        </div>
      )}

      <a
        href={`/?startCase=${data.caseId}`}
        target="_blank"
        rel="noreferrer"
        style={{ fontSize: 11, color: isWin ? '#0f6e56' : '#a32d2d', textDecoration: 'underline' }}
      >
        ▶ Play from this case
      </a>
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}
