import type { GameFlowNode } from '@/types/editor'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

let assetsForFlowNode: typeof import('./gamePreloadAssets').assetsForFlowNode
let globalFlowAssets: typeof import('./gamePreloadAssets').globalFlowAssets

beforeAll(async () => {
  vi.stubGlobal('window', { location: { pathname: '/' } })
  const module = await import('./gamePreloadAssets')
  assetsForFlowNode = module.assetsForFlowNode
  globalFlowAssets = module.globalFlowAssets
})

afterAll(() => {
  vi.unstubAllGlobals()
})

function flowNode(
  type: GameFlowNode['type'],
  data: Record<string, unknown>,
  id = `${type}-node`,
): GameFlowNode {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    data: { nodeType: type, ...data },
  } as GameFlowNode
}

function sources(node: GameFlowNode) {
  return assetsForFlowNode(node).map((entry) => entry.src)
}

describe('assetsForFlowNode', () => {
  it('extracts nested case photos and footage without preloading ordinary attachment URLs', () => {
    const node = flowNode('case', {
      caseId: '892',
      title: 'Case 892',
      order: 2,
      hasOperation: false,
      window: {
        photoUrl: '/images/custom/person.webp',
        suspicions: [
          {
            id: 'a',
            fileUrl: 'https://example.com/evidence.mp4',
            fileFootageVariant: 'graffiti-video',
          },
          { id: 'b', fileFootageVariant: 'teens-2' },
        ],
      },
    })

    const result = assetsForFlowNode(node)
    expect(result).toContainEqual({ kind: 'image', src: '/images/custom/person.webp' })
    expect(result).toContainEqual({
      kind: 'video',
      src: '/images/footage-window/Graffiti.mp4',
    })
    expect(result).toContainEqual({
      kind: 'image',
      src: '/images/footage-window/Footage_teens02.svg',
    })
    expect(sources(node)).not.toContain('https://example.com/evidence.mp4')
  })

  it('uses message content only for voice audio and never preloads button destinations', () => {
    const voice = flowNode('message', {
      messageType: 'voice',
      content: '/sounds/voice.mp3',
      photoUrl: '/images/message-photo.png',
      buttonLinkType: 'url',
      buttonUrl: 'https://example.com/not-media.mp4',
      buttonLabel: 'Open',
      locationX: 50,
      locationY: 50,
    })
    const text = flowNode('message', {
      messageType: 'text',
      content: '/sounds/looks-like-a-file.mp3',
      buttonLinkType: 'edge',
      buttonUrl: '',
      buttonLabel: '',
      locationX: 50,
      locationY: 50,
    })

    expect(assetsForFlowNode(voice)).toContainEqual({ kind: 'audio', src: '/sounds/voice.mp3' })
    expect(assetsForFlowNode(voice)).toContainEqual({ kind: 'image', src: '/images/message-photo.png' })
    expect(sources(voice)).not.toContain('https://example.com/not-media.mp4')
    expect(sources(text)).not.toContain('/sounds/looks-like-a-file.mp3')
  })

  it('adds the achievements pack for points and achievement-linked messages', () => {
    const points = flowNode('points', { amount: 25 })
    const link = flowNode('message', {
      messageType: 'link',
      content: 'See your progress',
      buttonLinkType: 'achievements',
      buttonUrl: '',
      buttonLabel: 'Open',
      locationX: 50,
      locationY: 50,
    })

    for (const node of [points, link]) {
      expect(sources(node)).toContain('/images/achievements/shield-win.svg')
      expect(sources(node)).toContain('/images/achievements/chevron-new.svg')
    }
  })

  it('honors operation sound overrides, silence, defaults, and deduplication', () => {
    const node = flowNode('operation', {
      operationId: 'op-1',
      title: 'Operation',
      window: {
        itemSounds: {
          boss: '/sounds/custom-minister.mp3',
          forces: '__none__',
          press: '/sounds/custom-press.mp3',
          blindfold: '/sounds/custom-blindfold.mp3',
        },
      },
    })
    const result = sources(node)

    expect(result).toContain('/sounds/custom-minister.mp3')
    expect(result).toContain('/sounds/custom-press.mp3')
    expect(result).toContain('/sounds/custom-blindfold.mp3')
    expect(result).not.toContain('/sounds/Light Switch 01.wav')
    expect(result).not.toContain('/sounds/Light Switch 02.wav')
    expect(result.filter((source) => source === '/sounds/Light Switch 03.wav')).toHaveLength(1)
  })

  it('uses custom result media while retaining the selected variant child assets', () => {
    const node = flowNode('result', {
      resultType: 'win',
      caseId: '893',
      label: 'Win',
      winImage: 'pizza',
      winImageCustom: 'data:image/png;base64,custom',
      winSound: 'notification',
      winSoundCustom: 'data:audio/mpeg;base64,custom',
    })
    const result = assetsForFlowNode(node)

    expect(result).toContainEqual({ kind: 'image', src: 'data:image/png;base64,custom' })
    expect(result).toContainEqual({ kind: 'audio', src: 'data:audio/mpeg;base64,custom' })
    expect(result).toContainEqual({
      kind: 'image',
      src: '/images/win-screens/Pizza/Police.svg',
    })
    expect(sources(node)).not.toContain('/images/win-screens/Pizza/bg.svg')
    expect(sources(node)).not.toContain('/sounds/notification.mp3')
  })

  it('classifies the workshop background as video and includes its full interaction pack', () => {
    const node = flowNode('result', {
      resultType: 'win',
      caseId: '894',
      label: 'Win',
      winImage: 'kippah-cutting-workshop',
      winSound: '__none__',
    })
    const result = assetsForFlowNode(node)

    expect(result).toContainEqual({
      kind: 'video',
      src: '/images/win-screens/KippahCutting/KippahCutting.mp4',
    })
    expect(sources(node)).toContain('/images/win-screens/KippahCutting/Kippah_left_03.svg')
    expect(sources(node)).toContain('/images/win-screens/KippahCutting/Cursor02_Scissors02.svg')
    expect(sources(node)).toContain('/sounds/Scissors.mp3')
    expect(sources(node)).toContain('/sounds/winning points.mp3')
    expect(sources(node)).toContain('/sounds/losing points.mp3')
    expect(sources(node)).not.toContain('/images/win-screens/WinScreen_KippahCutting.png')
    expect(sources(node)).not.toContain('/sounds/notification.mp3')
  })

  it('includes the mini-game and ranking packs only for their matching nodes', () => {
    const miniGame = flowNode('miniGame', { label: 'Whack' })
    const ranking = flowNode('ranking', { title: 'Ranking' })

    expect(sources(miniGame)).toContain('/images/mini-game/game_bg.png')
    expect(sources(miniGame)).toContain('/sounds/Ouch01.mp3')
    expect(sources(ranking)).toContain('/images/ranking-board/Boss on Crocodile.svg')
    expect(sources(ranking)).not.toContain('/images/mini-game/game_bg.png')
  })
})

describe('globalFlowAssets', () => {
  it('mirrors GamePage by using the first bgMusic node and preferring its custom source', () => {
    const first = flowNode('bgMusic', {
      src: 'falafel',
      srcCustom: 'data:audio/wav;base64,custom-music',
      volume: 0.4,
    }, 'music-1')
    const second = flowNode('bgMusic', {
      src: 'falafel',
      volume: 0.4,
    }, 'music-2')

    expect(globalFlowAssets([first, second])).toEqual([
      { kind: 'audio', src: 'data:audio/wav;base64,custom-music' },
    ])
  })

  it('falls back through the background-music registry', () => {
    const music = flowNode('bgMusic', {
      src: 'unknown-track',
      volume: 0.4,
    })

    expect(globalFlowAssets([music])).toEqual([
      { kind: 'audio', src: '/sounds/Falafel Pixel Pursuit.wav' },
    ])
  })

  it('does not replace an explicitly blank custom music source', () => {
    const music = flowNode('bgMusic', {
      src: 'falafel',
      srcCustom: '',
      volume: 0.4,
    })

    expect(globalFlowAssets([music])).toEqual([])
  })
})
