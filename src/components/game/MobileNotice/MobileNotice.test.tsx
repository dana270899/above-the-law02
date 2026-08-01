import { renderToStaticMarkup } from 'react-dom/server'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

let MobileNotice: typeof import('./MobileNotice').MobileNotice

beforeAll(async () => {
  vi.stubGlobal('window', { location: { pathname: '/' } })
  const mobileNoticeModule = await import('./MobileNotice')
  MobileNotice = mobileNoticeModule.MobileNotice
})

afterAll(() => {
  vi.unstubAllGlobals()
})

describe('MobileNotice assets', () => {
  it('uses the lightweight mobile-only artwork', () => {
    const markup = renderToStaticMarkup(<MobileNotice />)

    expect(markup).toContain('/images/mobile-notice/logo.webp')
    expect(markup).toContain('/images/mobile-notice/boss-on-crocodile.webp')
    expect(markup).not.toContain('Logo-S.svg')
    expect(markup).not.toContain('Boss on Crocodile.svg')
  })
})
