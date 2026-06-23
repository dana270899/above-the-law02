import { useEffect, useState } from 'react'
import {
  deleteVersion,
  listVersions,
  renameVersion,
  type GameVersion,
} from '@/lib/versionHistory'
import styles from './VersionsModal.module.css'

/**
 * VERSIONS MODAL
 * Lists all saved snapshots of the editor graph and lets the user
 * restore, rename, or delete each. Restores are always preceded by an
 * automatic "Before restore" snapshot taken by the caller, so a restore
 * itself can never erase work.
 */
export interface VersionsModalProps {
  onClose: () => void
  /** Called after the user picks a version to restore. Caller handles
   *  the pre-restore auto-snapshot and the actual setNodes/setEdges. */
  onRestore: (version: GameVersion) => void
}

export function VersionsModal({ onClose, onRestore }: VersionsModalProps) {
  const [versions, setVersions] = useState<GameVersion[]>([])
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Re-sync from storage on mount in case another tab touched it.
  useEffect(() => {
    refresh()
  }, [])

  async function refresh() {
    try {
      setVersions(await listVersions())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  function startRename(v: GameVersion) {
    setRenamingId(v.id)
    setRenameValue(v.name)
  }
  async function commitRename(id: string) {
    try {
      await renameVersion(id, renameValue)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
    setRenamingId(null)
    refresh()
  }
  function cancelRename() {
    setRenamingId(null)
  }

  async function handleDelete(v: GameVersion) {
    const ok = window.confirm(`Delete version "${v.name}"? This cannot be undone.`)
    if (!ok) return
    try {
      await deleteVersion(v.id)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
    refresh()
  }

  function handleRestore(v: GameVersion) {
    const ok = window.confirm(
      `Restore "${v.name}"? The current editor will be replaced with this snapshot. ` +
      `A backup of the current state will be saved as a new version first.`,
    )
    if (!ok) return
    onRestore(v)
  }

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Saved versions</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">×</button>
        </div>

        {error && <p className={styles.empty}>{error}</p>}

        {versions.length === 0 ? (
          <p className={styles.empty}>
            No versions yet. Use "Save version" in the toolbar to capture a snapshot.
          </p>
        ) : (
          <ul className={styles.list}>
            {versions.map((v) => {
              const date = new Date(v.createdAt)
              const nodeCount = v.graph.nodes.length
              const edgeCount = v.graph.edges.length
              const isRenaming = renamingId === v.id
              return (
                <li key={v.id} className={styles.row}>
                  <div className={styles.rowMain}>
                    {isRenaming ? (
                      <input
                        className={styles.renameInput}
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRename(v.id)
                          if (e.key === 'Escape') cancelRename()
                        }}
                      />
                    ) : (
                      <span className={styles.name}>
                        {v.name}
                        {v.auto && <span className={styles.autoTag}>auto</span>}
                      </span>
                    )}
                    <span className={styles.meta}>
                      {date.toLocaleString()} · {nodeCount} nodes · {edgeCount} edges
                    </span>
                  </div>
                  <div className={styles.actions}>
                    {isRenaming ? (
                      <>
                        <button className={styles.btnPrimary} onClick={() => commitRename(v.id)}>
                          Save
                        </button>
                        <button className={styles.btn} onClick={cancelRename}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <button className={styles.btnPrimary} onClick={() => handleRestore(v)}>
                          Restore
                        </button>
                        <button className={styles.btn} onClick={() => startRename(v)}>
                          Rename
                        </button>
                        <button className={styles.btnDanger} onClick={() => handleDelete(v)}>
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
