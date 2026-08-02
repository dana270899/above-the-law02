import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
import { assetUrl } from '@/lib/paths'
import { ScorePublishScreen } from '@/components/game/ScorePublishScreen/ScorePublishScreen'
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
  const navigate = useNavigate()
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'publishing' | 'published' | 'history-error' | 'error'>('loading')
  const [error, setError] = useState('')
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [publicationProfile, setPublicationProfile] = useState<PlayerProfile | null>(entryMode ? profile : null)
  const rowsRef = useRef<HTMLDivElement | null>(null)
  const effectiveProfile = publicationProfile ?? profile

  const localEntry = useMemo<LeaderboardEntry>(() => ({
    id: 'local-player',
    playerName: effectiveProfile.name,
    photoUrl: effectiveProfile.photoPreviewUrl ?? null,
    score: run.total,
    won: run.won,
    caseBreakdown: run.cases,
    createdAt: new Date().toISOString(),
    isCurrentPlayer: true,
  }), [effectiveProfile, run])

  useEffect(() => {
    let active = true
    async function loadAndPublish() {
      try {
        setError('')
        if (entryMode) {
          const remoteEntries = await fetchLeaderboard(10)
          if (!active) return
          setEntries(remoteEntries)
          setStatus('ready')
          return
        }
        if (!publicationProfile) return
        if (!isLeaderboardConfigured()) {
          throw new Error('Shared ranking is not configured.')
        }
        setStatus('publishing')
        const key = publicationKey ?? `${effectiveProfile.name}:${run.total}:${JSON.stringify(run.cases)}`
        const remoteRequest = fetchLeaderboard().then((remoteEntries) => {
          if (active) setEntries(remoteEntries)
          return remoteEntries
        })
        const [remoteResult, publicationResult] = await Promise.allSettled([
          remoteRequest,
          publicationRequest(key, effectiveProfile, run),
        ])
        if (publicationResult.status === 'rejected') throw publicationResult.reason
        const published = publicationResult.value
        if (!active) return
        if (remoteResult.status === 'rejected') {
          console.warn('The latest shared ranking could not be loaded.', remoteResult.reason)
          setEntries([published])
          setError('Your score was saved, but previous rankings could not be loaded.')
          setStatus('history-error')
          return
        }
        setEntries([
          ...remoteResult.value.filter((entry) => entry.id !== published.id),
          published,
        ])
        setStatus('published')
      } catch (reason) {
        if (!active) return
        const message = reason instanceof Error ? reason.message : String(reason)
        console.warn('The score could not be added to the shared ranking; showing it locally.', message)
        setError(message)
        setStatus('error')
      }
    }
    void loadAndPublish()
    return () => { active = false }
  }, [effectiveProfile, entryMode, publicationKey, publicationProfile, run])

  const hasPublishedEntry = status === 'published' || status === 'history-error'
  const withCurrentPlayer = entryMode || hasPublishedEntry
    ? entries
    : mergeLocalPlayer(entries.filter((entry) => entry.id !== localEntry.id), localEntry)
  const currentPlayerId = entryMode
    ? ''
    : hasPublishedEntry
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

  if (!entryMode && !publicationProfile) {
    return <ScorePublishScreen profile={profile} score={run.total} onPublish={setPublicationProfile} />
  }

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
                <img src={assetUrl('/images/case-window/arrow-forward.svg')} alt="" aria-hidden="true" />
              </button>
              <div className={styles.scrollTrack}>
                <div className={styles.scrollThumb} />
              </div>
              <button type="button" className={styles.scrollDown} onClick={() => scrollRows(1)} aria-label="Scroll ranking down">
                <img src={assetUrl('/images/case-window/arrow-forward.svg')} alt="" aria-hidden="true" />
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
                      <img
                        src={assetUrl('/images/Player.svg')}
                        alt=""
                        className={styles.defaultPlayerPhoto}
                      />
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
              src={assetUrl('/images/Logo.svg')}
              alt=""
              className={styles.rankingBadge}
            />
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
              onClick={() => navigate('/game')}
            >
              {entryMode ? 'Start game' : 'Play again'}
            </button>
            <button
              type="button"
              className={styles.credits}
              onClick={() => navigate('/credits')}
            >
              About &amp; Credits
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
            <h2>{effectiveProfile.name}</h2>
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
