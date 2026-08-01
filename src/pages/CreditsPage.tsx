import { useNavigate } from 'react-router-dom'
import { useGameScale } from '@/hooks/useGameScale'
import { assetUrl } from '@/lib/paths'
import styles from './CreditsPage.module.css'

export function CreditsPage() {
  const navigate = useNavigate()
  const scaleRef = useGameScale()

  return (
    <main ref={scaleRef} className={styles.page}>
      <div className={styles.content}>
        <img
          className={styles.logo}
          src={assetUrl('/images/login-screen/Logo-S.svg')}
          alt="Above the Law"
        />

        <div className={styles.credits}>
          <div className={styles.primaryCredits}>
            <section>
              <h1>About</h1>
              <p>A satirical game inspired by real events in Israel.</p>
              <p>By placing the player in the role of a police chief,<br />the game explores how systems of power shape our lives.</p>
            </section>

            <section>
              <h2>Game Creator</h2>
              <p>Dana Kozlovski</p>
            </section>

            <section>
              <h2>Supervisor</h2>
              <p>Tal Michael Haring</p>
            </section>

            <section>
              <h2>Graduation Project</h2>
              <p>B.Des. in Visual Communication</p>
              <p>HIT - Holon Institute of Technology</p>
              <p>2026</p>
            </section>
          </div>

          <div className={styles.secondaryCredits}>
            <div className={styles.column}>
              <section>
                <h2>Consulting</h2>
                <p>Eitan Eloa</p>
                <p>Naama Benziman</p>
              </section>
              <section>
                <h2>Special Thanks</h2>
                <p>Itai, Adi, and all my friends</p>
                <p>for their support</p>
              </section>
            </div>

            <div className={styles.column}>
              <section>
                <h2>Music</h2>
                <p>Based on &quot;Tamid Ohev Oti&quot;</p>
                <p>by Sasson Shaulov</p>
              </section>
              <section>
                <h2>Font</h2>
                <p>Arbel by Hagilda</p>
              </section>
            </div>
          </div>
        </div>

        <button
          type="button"
          className={styles.returnButton}
          onClick={() => navigate('/game')}
        >
          Return to game
        </button>
      </div>
    </main>
  )
}
