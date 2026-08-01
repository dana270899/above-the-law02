import { useEffect, useMemo, useRef, useState } from 'react'
import type { PlayerProfile, RunScore } from '@/lib/scoring'
import {
  buildLeaderboardDisplay,
  fetchLeaderboard,
  fetchLeaderboardPhotoUrl,
  isLeaderboardConfigured,
  mergeLocalPlayer,
  publishLeaderboardEntry,
  type LeaderboardEntry,
} from '@/lib/leaderboard'
import { appPath, assetUrl } from '@/lib/paths'
import styles from './RankingPage.module.css'

const publicationRequests = new Map<string, Promise<LeaderboardEntry>>()

function publicationRequest(key: string, profile: PlayerProfile, run: RunScore) {
  const existing = publicationRequests.get(key)
  if (existing) return existing
  const request = publishLeaderboardEntry({
    playerName: profile.name,
    photo: profile.photo,
    run,
  }).catch((reason) => {
    publicationRequests.delete(key)
    throw reason
  })
  publicationRequests.set(key, request)
  return request
}

export function RankingPage({
  profile,
  run,
  entryMode = false,
  publicationKey,
}: {
  profile: PlayerProfile
  run: RunScore
  entryMode?: boolean
  publicationKey?: string
}) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'publishing' | 'published' | 'error'>('loading')
  const [error, setError] = useState('')
  const [detailsOpen, setDetailsOpen] = useState(false)
  const rowsRef = useRef<HTMLDivElement | null>(null)

  const localEntry = useMemo<LeaderboardEntry>(() => ({
    id: 'local-player',
    playerName: profile.name,
    photoUrl: profile.photoPreviewUrl ?? null,
    score: run.total,
    won: run.won,
    caseBreakdown: run.cases,
    createdAt: new Date().toISOString(),
    isCurrentPlayer: true,
  }), [profile, run])

  useEffect(() => {
    let active = true
    async function loadAndPublish() {
      try {
        if (entryMode) {
          const remoteEntries = await fetchLeaderboard(10)
          if (!active) return
          setEntries(remoteEntries)
          setStatus('ready')
          return
        }
        if (!isLeaderboardConfigured()) {
          throw new Error('Shared ranking is not configured.')
        }
        if (run.cases.length !== 7) {
          throw new Error(`The run has ${run.cases.length} of 7 case results, so it cannot be saved yet.`)
        }
        setStatus('publishing')
        const key = publicationKey ?? `${profile.name}:${run.total}:${JSON.stringify(run.cases)}`
        const remoteRequest = fetchLeaderboard().then((remoteEntries) => {
          if (active) setEntries(remoteEntries)
          return remoteEntries
        })
        const [remoteResult, publicationResult] = await Promise.allSettled([
          remoteRequest,
          publicationRequest(key, profile, run),
        ])
        if (publicationResult.status === 'rejected') throw publicationResult.reason
        const remoteEntries = remoteResult.status === 'fulfilled' ? remoteResult.value : []
        if (remoteResult.status === 'rejected') {
          console.warn('The latest shared ranking could not be loaded.', remoteResult.reason)
        }
        const published = publicationResult.value
        if (!active) return
        setEntries((current) => [
          ...remoteEntries.filter((entry) => entry.id !== published.id),
          published,
        ])
        setStatus('published')
      } catch (reason) {
        if (!active) return
        setError(reason instanceof Error ? reason.message : String(reason))
        setStatus('error')
      }
    }
    void loadAndPublish()
    return () => { active = false }
  }, [entryMode, profile, publicationKey, run])

  const withCurrentPlayer = entryMode || status === 'published'
    ? entries
    : mergeLocalPlayer(entries.filter((entry) => entry.id !== localEntry.id), localEntry)
  const currentPlayerId = entryMode
    ? ''
    : status === 'published'
      ? entries.find((entry) => entry.isCurrentPlayer)?.id ?? localEntry.id
      : localEntry.id
  const { visible: shown } = buildLeaderboardDisplay(withCurrentPlayer, currentPlayerId)
  const visiblePhotoRequestKey = shown
    .map((entry) => `${entry.id}:${entry.photoPath ?? ''}:${entry.photoUrl ? 'loaded' : 'pending'}`)
    .join('|')

  useEffect(() => {
    const pending = shown.filter((entry) => entry.photoPath && !entry.photoUrl)
    if (pending.length === 0) return
    let active = true

    void Promise.all(pending.map(async (entry) => ({
      id: entry.id,
      photoUrl: await fetchLeaderboardPhotoUrl(entry.photoPath ?? null),
    }))).then((photos) => {
      if (!active) return
      const photoById = new Map(photos.map((photo) => [photo.id, photo.photoUrl]))
      setEntries((current) => current.map((entry) => {
        const photoUrl = photoById.get(entry.id)
        return photoUrl ? { ...entry, photoUrl } : entry
      }))
    })

    return () => { active = false }
  // Only restart when the visible rows or their photo state changes.
  }, [visiblePhotoRequestKey])

  function scrollRows(direction: -1 | 1) {
    rowsRef.current?.scrollBy({ top: direction * 188, behavior: 'smooth' })
  }

  return (
    <main className={styles.page}>
      <div className={`${styles.blueBar} ${styles.blueBarTop}`} />
      <div className={`${styles.blueBar} ${styles.blueBarBottom}`} />

      <div className={styles.content}>
        <section className={styles.rankingColumn}>
          <h1 className={styles.title} data-text="Ranking">
            <span>Ranking</span>
          </h1>

          <div className={styles.board}>
            <div className={styles.scrollbar}>
              <button type="button" className={styles.scrollUp} onClick={() => scrollRows(-1)} aria-label="Scroll ranking up">
                <span aria-hidden="true" />
              </button>
              <div className={styles.scrollTrack}>
                <div className={styles.scrollThumb} />
              </div>
              <button type="button" className={styles.scrollDown} onClick={() => scrollRows(1)} aria-label="Scroll ranking down">
                <span aria-hidden="true" />
              </button>
            </div>

            <div
              className={styles.rows}
              ref={rowsRef}
              aria-busy={status === 'loading' || status === 'publishing'}
            >
              {shown.map((entry) => (
                <article
                  key={entry.id}
                  className={`${styles.row} ${entry.isCurrentPlayer ? styles.currentRow : ''}`}
                >
                  <span className={styles.rank}>{entry.rank}</span>
                  <span className={styles.playerPhoto}>
                    {entry.photoUrl ? (
                      <img src={entry.photoUrl} alt="" />
                    ) : (
                      <span>{entry.playerName.slice(0, 1).toUpperCase()}</span>
                    )}
                  </span>
                  <span className={styles.playerName}>{entry.playerName}</span>
                  <span className={styles.playerScore}>
                    {entry.score.toLocaleString('en-US')} points
                  </span>
                </article>
              ))}
              {status === 'ready' && shown.length === 0 && <p className={styles.loading}>No saved results yet.</p>}
            </div>
          </div>
        </section>

        <section className={styles.illustrationColumn}>
          <div className={styles.illustrationFrame}>
            <img
              src={assetUrl('/images/ranking-board/Boss on Crocodile.svg')}
              alt=""
              className={styles.illustration}
            />
          </div>
          <div className={styles.ctas}>
            <button
              type="button"
              className={styles.playAgain}
              onClick={() => window.location.assign(appPath('/game'))}
            >
              {entryMode ? 'Start game' : 'Play again'}
            </button>
            <button
              type="button"
              className={styles.credits}
              onClick={() => setDetailsOpen(true)}
            >
              Credits
            </button>
          </div>
        </section>
      </div>

      {detailsOpen && (
        <div className={styles.modalLayer} role="presentation" onMouseDown={() => setDetailsOpen(false)}>
          <section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-label="Score details and privacy"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button type="button" className={styles.modalClose} onClick={() => setDetailsOpen(false)} aria-label="Close">
              ×
            </button>
            <h2>{profile.name}</h2>
            <p className={styles.modalScore}>{run.total.toLocaleString('en-US')} points</p>
            <div className={styles.breakdown}>
              {run.cases.map((item) => (
                <p key={item.caseId}>
                  <span>{item.title}</span>
                  <strong>+{item.totalPoints}</strong>
                </p>
              ))}
            </div>
            {!isLeaderboardConfigured() && <p className={styles.notice}>Shared ranking is not configured. Your result remains private.</p>}
            {status === 'publishing' && <p className={styles.notice}>Saving your result…</p>}
            {status === 'published' && <p className={styles.notice}>Your result was saved to the shared ranking.</p>}
            {error && <p className={styles.notice}>{error}</p>}
          </section>
        </div>
      )}
    </main>
  )
}
