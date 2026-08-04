import { renderToStaticMarkup } from 'react-dom/server'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

let ScorePublishScreen: typeof import('./ScorePublishScreen').ScorePublishScreen
let profileWithFallbackPhoto: typeof import('./ScorePublishScreen').profileWithFallbackPhoto

beforeAll(async () => {
  vi.stubGlobal('window', { location: { pathname: '/' } })
  const scorePublishModule = await import('./ScorePublishScreen')
  ScorePublishScreen = scorePublishModule.ScorePublishScreen
  profileWithFallbackPhoto = scorePublishModule.profileWithFallbackPhoto
})

afterAll(() => {
  vi.unstubAllGlobals()
})

describe('ScorePublishScreen retained camera photo', () => {
  it('opens on the captured preview without starting another countdown', () => {
    const markup = renderToStaticMarkup(
      <ScorePublishScreen
        profile={{
          name: 'Dana',
          photo: new Blob(['portrait'], { type: 'image/jpeg' }),
          photoPreviewUrl: '/captured-ranking-photo.jpg',
        }}
        score={420}
        onPublish={() => undefined}
      />,
    )

    expect(markup).toContain('/captured-ranking-photo.jpg')
    expect(markup).toContain('Your ranking portrait')
    expect(markup).toContain('Take again')
    expect(markup).not.toContain('Say cheese!')
    expect(markup).not.toContain('00:05')
  })

  it('keeps the avatar chosen at login when the camera photo is declined', () => {
    const avatar = new Blob(['avatar'], { type: 'image/svg+xml' })
    const fallbackProfile = {
      name: 'Dana',
      photo: avatar,
      photoPreviewUrl: '/images/login-screen/Flower.svg',
    }

    expect(profileWithFallbackPhoto('  Dana Officer  ', fallbackProfile)).toEqual({
      name: 'Dana Officer',
      photo: avatar,
      photoPreviewUrl: '/images/login-screen/Flower.svg',
    })
  })
})
