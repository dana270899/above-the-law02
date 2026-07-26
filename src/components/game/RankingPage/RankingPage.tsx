import { useEffect, useMemo, useRef, useState } from 'react'
import type { PlayerProfile, PublicationConsent, RunScore } from '@/lib/scoring'
import {
  buildLeaderboardDisplay,
  fetchLeaderboard,
  isLeaderboardConfigured,
  mergeLocalPlayer,
  publishLeaderboardEntry,
  type LeaderboardEntry,
} from '@/lib/leaderboard'
import { appPath, assetUrl } from '@/lib/paths'
import styles from './RankingPage.module.css'

const FAKE_RANKINGS: LeaderboardEntry[] = [
  ['fake-1', 'Alex Stone', '/images/login-screen/Man.svg', 300],
  ['fake-2', 'Maya Bloom', '/images/login-screen/Flower.svg', 290],
  ['fake-3', 'Noa Green', '/images/login-screen/Gun.svg', 270],
  ['fake-4', 'Liam North', '/images/login-screen/Man.svg', 260],
  ['fake-5', 'Ella Rose', '/images/login-screen/Flower.svg', 250],
  ['fake-6', 'Ben Silver', '/images/login-screen/Gun.svg', 240],
  ['fake-7', 'Ari Gold', '/images/login-screen/Man.svg', 230],
  ['fake-8', 'Zoe Lake', '/images/login-screen/Flower.svg', 220],
  ['fake-9', 'Tom Vale', '/images/login-screen/Gun.svg', 210],
  ['fake-10', 'Ivy Moon', '/images/login-screen/Man.svg', 200],
].map(([id, playerName, photoPath, score], index) => ({
  id: String(id),
  playerName: String(playerName),
  photoUrl: assetUrl(String(photoPath)),
  score: Number(score),
  won: false,
  caseBreakdown: [],
  createdAt: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
}))

export function RankingPage({ profile, run }: { profile: PlayerProfile; run: RunScore }) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>(FAKE_RANKINGS)
  const [status, setStatus] = useState<'loading' | 'ready' | 'publishing' | 'published' | 'declined' | 'error'>('loading')
  const [error, setError] = useState('')
  const [consent, setConsent] = useState<PublicationConsent>('pending')
  const [detailsOpen, setDetailsOpen] = useState(false)
  const publicationStartedRef = useRef(false)
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
    fetchLeaderboard()
      .then((next) => {
        setEntries([...FAKE_RANKINGS, ...next])
        setStatus('ready')
      })
      .catch((reason) => {
        setError(reason instanceof Error ? reason.message : String(reason))
        setStatus('error')
      })
  }, [])

  const withCurrentPlayer = status === 'published'
    ? entries
    : mergeLocalPlayer(entries.filter((entry) => entry.id !== localEntry.id), localEntry)
  const currentPlayerId = status === 'published'
    ? entries.find((entry) => entry.isCurrentPlayer)?.id ?? localEntry.id
    : localEntry.id
  const { visible: shown } = buildLeaderboardDisplay(withCurrentPlayer, currentPlayerId)

  async function publish() {
    if (publicationStartedRef.current) return
    publicationStartedRef.current = true
    setConsent('approved')
    setStatus('publishing')
    setError('')
    try {
      const published = await publishLeaderboardEntry({
        playerName: profile.name,
        photo: profile.photo,
        run,
      })
      setEntries((current) => [...current, published])
      setStatus('published')
    } catch (reason) {
      publicationStartedRef.current = false
      setError(reason instanceof Error ? reason.message : String(reason))
      setStatus('error')
    }
  }

  function keepPrivate() {
    setConsent('declined')
    setStatus('declined')
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
                <span aria-hidden="true" />
              </button>
              <div className={styles.scrollTrack}>
                <div className={styles.scrollThumb} />
              </div>
              <button type="button" className={styles.scrollDown} onClick={() => scrollRows(1)} aria-label="Scroll ranking down">
                <span aria-hidden="true" />
              </button>
            </div>

            <div className={styles.rows} ref={rowsRef}>
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
              {status === 'loading' && <p className={styles.loading}>Loading ranking…</p>}
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
              Play again
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
            {status !== 'published' && status !== 'declined' && (
              <>
                <p>Publish your name, photo, score, and case results to the shared ranking?</p>
                <div className={styles.modalActions}>
                  <button type="button" onClick={publish} disabled={status === 'publishing' || !isLeaderboardConfigured()}>
                    {status === 'publishing' ? 'Publishing…' : 'Allow & publish'}
                  </button>
                  <button type="button" onClick={keepPrivate}>Keep private</button>
                </div>
              </>
            )}
            {!isLeaderboardConfigured() && <p className={styles.notice}>Shared ranking is not configured. Your result remains private.</p>}
            {consent === 'declined' && <p className={styles.notice}>Nothing was uploaded.</p>}
            {status === 'published' && <p className={styles.notice}>Your score was published.</p>}
            {error && <p className={styles.notice}>{error}</p>}
          </section>
        </div>
      )}
    </main>
  )
}
