import { renderToStaticMarkup } from 'react-dom/server'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

let AchievementsWindow: typeof import('./AchievementsWindow').AchievementsWindow

beforeAll(async () => {
  vi.stubGlobal('window', { location: { pathname: '/' } })
  const achievementsModule = await import('./AchievementsWindow')
  AchievementsWindow = achievementsModule.AchievementsWindow
})

afterAll(() => {
  vi.unstubAllGlobals()
})

describe('AchievementsWindow entry flicker', () => {
  it('starts forced replays empty without changing accessible score progress', () => {
    const markup = renderToStaticMarkup(
      <AchievementsWindow
        total={420}
        winningTarget={1000}
        forceEntryFlicker
      />,
    )

    expect(markup).toContain('aria-valuenow="420"')
    expect(markup).toContain('data-entry-flicker="empty"')
    expect(markup).toContain('clip-path:inset(100% 0 0)')
  })

  it('starts a tutorial loop in the empty flicker phase', () => {
    const markup = renderToStaticMarkup(
      <AchievementsWindow
        total={750}
        winningTarget={1000}
        loopEntryFlicker
      />,
    )

    expect(markup).toContain('aria-valuenow="750"')
    expect(markup).toContain('data-entry-flicker="empty"')
    expect(markup).toContain('clip-path:inset(100% 0 0)')
  })
})
