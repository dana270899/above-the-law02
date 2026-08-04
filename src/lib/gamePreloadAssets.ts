import type { GameFlowNode } from '@/types/editor'
import { getBgMusic } from './bgMusic'
import { OPERATION_SOUND_NONE } from './operationSounds'
import { assetUrl } from './paths'
import { getWinScreen } from './winScreens'
import { getWinSound } from './winSounds'

export interface GamePreloadAsset {
  kind: 'image' | 'audio' | 'video'
  src: string
}

type AssetKind = GamePreloadAsset['kind']

const configuredBase = import.meta.env.BASE_URL.replace(/\/$/, '')

function resolvedAssetUrl(path: string): string {
  // Registry values have already passed through assetUrl(). Keep this helper
  // idempotent for non-root deployments instead of prefixing BASE_URL twice.
  if (
    configuredBase &&
    (path === configuredBase || path.startsWith(`${configuredBase}/`))
  ) {
    return path
  }
  return assetUrl(path)
}

function asset(kind: AssetKind, path: string): GamePreloadAsset {
  return { kind, src: resolvedAssetUrl(path) }
}

function optionalAsset(
  kind: AssetKind,
  source: unknown,
): GamePreloadAsset[] {
  if (typeof source !== 'string') return []
  const trimmed = source.trim()
  return trimmed ? [asset(kind, trimmed)] : []
}

function uniqueAssets(assets: readonly GamePreloadAsset[]): GamePreloadAsset[] {
  const seen = new Set<string>()
  return assets.filter(({ kind, src }) => {
    const key = `${kind}:${src}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const CASE_ASSETS: readonly GamePreloadAsset[] = [
  'minimize.svg',
  'close.svg',
  'arrow-forward.svg',
  'arrow-forward-alt.svg',
  'arrow-expanded.svg',
  'arrow.svg',
  'attachment.svg',
  'photo-default.svg',
].map((filename) => asset('image', `/images/case-window/${filename}`))

const DESKTOP_ASSETS: readonly GamePreloadAsset[] = [
  'Cases_Illustration.svg',
  'Operations_Illustration.svg',
  'Operations_Illustration02.svg',
  'Trash_Illustration_S.svg',
  'Whack_Illustration.svg',
].map((filename) => asset('image', `/images/desktop/${filename}`)).concat([
  asset('image', '/images/Logo.svg'),
  asset('image', '/images/operation-window/lock.svg'),
])

const LOGIN_ASSETS: readonly GamePreloadAsset[] = [
  'Logo-S.svg',
  'add_photo_alternate.svg',
  'arrow_forward.svg',
  'Man.svg',
  'Woman.svg',
  'Flower.svg',
  'Gun.svg',
].map((filename) => asset('image', `/images/login-screen/${filename}`))

const BOSS_MESSAGE_ASSETS: readonly GamePreloadAsset[] = [
  'mic.svg',
  'boss-hair.svg',
  'boss-nose.svg',
  'boss-glasses.svg',
  'boss-noseline.svg',
  'boss-mustache.svg',
  'boss-stache2.svg',
  'boss-mouth.svg',
  'boss-cheekL.svg',
  'boss-cheekR.svg',
].map((filename) => asset('image', `/images/boss/${filename}`)).concat([
  asset('audio', '/sounds/notification.mp3'),
])

const ACHIEVEMENTS_ASSETS: readonly GamePreloadAsset[] = [
  'shield.svg',
  'shield-win.svg',
  'chevron-fill.svg',
  'chevron-new.svg',
].map((filename) => asset('image', `/images/achievements/${filename}`)).concat([
  asset('audio', '/sounds/winning points.mp3'),
  asset('audio', '/sounds/losing points.mp3'),
])

const MINI_GAME_ASSETS: readonly GamePreloadAsset[] = [
  'Grandma01_default.svg',
  'Grandma02_default.svg',
  'Grandma03_default.svg',
  'Life-full.svg',
  'Life-empty.svg',
  'Hammer.svg',
  'game_bg.png',
].map((filename) => asset('image', `/images/mini-game/${filename}`)).concat([
  asset('audio', '/sounds/Ouch01.mp3'),
])

const OPERATION_IMAGE_ASSETS: readonly GamePreloadAsset[] = [
  ...CASE_ASSETS.slice(0, 3),
  ...[
    'Boss.svg',
    'Forces.svg',
    'Dog.svg',
    'Press.svg',
    'Blindfold.svg',
    'arc.svg',
    'needle.svg',
  ].map((filename) => asset('image', `/images/operation-window/${filename}`)),
]

const OPERATION_DEFAULT_SOUNDS = {
  boss: assetUrl('/sounds/Light Switch 01.wav'),
  forces: assetUrl('/sounds/Light Switch 02.wav'),
  dogs: assetUrl('/sounds/Light Switch 03.wav'),
  press: assetUrl('/sounds/Light Switch 01.wav'),
  blindfold: assetUrl('/sounds/Light Switch 02.wav'),
} as const

const FOOTAGE_ASSETS: Readonly<Record<string, GamePreloadAsset>> = {
  graffiti: asset('image', '/images/footage-window/Footage_grafitti.svg'),
  'jewish-violence': asset('image', '/images/footage-window/Footage_jewish_violence.svg'),
  'indecent-exposure': asset('image', '/images/footage-window/Footage_indecent_exposure.svg'),
  teens: asset('image', '/images/footage-window/Footage_teens01.svg'),
  'teens-2': asset('image', '/images/footage-window/Footage_teens02.svg'),
  'arab-violence': asset('image', '/images/footage-window/Footage_arab_violence.svg'),
  'graffiti-video': asset('video', '/images/footage-window/Graffiti.mp4'),
}

const RANKING_ASSETS: readonly GamePreloadAsset[] = [
  asset('image', '/images/ranking-board/Boss on Crocodile.svg'),
]

const WIN_CLOSE_ASSET = asset('image', '/images/case-window/close.svg')

function resolvedWinBackground(
  customSource: string | undefined,
  registrySource: string,
): GamePreloadAsset {
  return asset('image', customSource?.trim() || registrySource)
}

function winAssets(node: Extract<GameFlowNode, { type: 'result' }>): GamePreloadAsset[] {
  if (node.data.resultType !== 'win') return []

  const option = getWinScreen(node.data.winImage)
  const customBackground = node.data.winImageCustom?.trim() || undefined
  const assets: GamePreloadAsset[] = [WIN_CLOSE_ASSET, ...ACHIEVEMENTS_ASSETS]

  switch (option.id) {
    case 'punching-dummy':
      assets.push(
        resolvedWinBackground(customBackground, option.src),
        asset('image', '/images/win-screens/PunchingDummy/PunchingDummy_dummy_forward.gif'),
        asset('image', '/images/win-screens/PunchingDummy/PunchingDummy_dummy_reverse.gif'),
      )
      break

    case 'punching-dummy-click':
      assets.push(
        resolvedWinBackground(customBackground, option.src),
        asset('image', '/images/win-screens/PunchingDummy/PunchingDummy_dummy_forward.gif'),
        asset('image', '/images/win-screens/PunchingDummy/PunchingDummy_dummy_reverse.gif'),
        asset('image', '/images/win-screens/PunchingDummy/PunchingDummy_glove_cursor.svg'),
        asset('audio', '/sounds/Punch.mp3'),
      )
      break

    case 'kippah-cutting-workshop': {
      if (customBackground) {
        const customKind = /\.(?:mp4|webm|ogg|mov)(?:\?.*)?$/i.test(customBackground)
          ? 'video'
          : 'image'
        assets.push(asset(customKind, customBackground))
      } else {
        assets.push(asset('video', '/images/win-screens/KippahCutting/KippahCutting.mp4'))
      }
      const root = '/images/win-screens/KippahCutting'
      assets.push(
        asset('image', `${root}/Cursor02_Scissors01.svg`),
        asset('image', `${root}/Cursor02_Scissors02.svg`),
        asset('image', `${root}/trail.svg`),
        asset('image', `${root}/Kippah_hand01.svg`),
        asset('image', `${root}/Kippah_hand02.svg`),
        asset('image', `${root}/Kippah_hand03.svg`),
        asset('image', `${root}/Kippah_left_01.svg`),
        asset('image', `${root}/Kippah_right_01.svg`),
        asset('image', `${root}/Kippah_left_02.svg`),
        asset('image', `${root}/Kippah_right_02.svg`),
        asset('image', `${root}/Kippah_left_03.svg`),
        asset('image', `${root}/Kippah_right_03.svg`),
        asset('audio', '/sounds/Scissors.mp3'),
      )
      break
    }

    case 'bdsm-party':
      // This component owns a layered scene and intentionally does not use
      // the generic win-screen background override.
      assets.push(
        asset('image', '/images/win-screens/BdsmParty/bg.svg'),
        asset('image', '/images/win-screens/BdsmParty/Envelope bg.svg'),
        asset('image', '/images/win-screens/BdsmParty/Envelope.svg'),
        asset('image', '/images/win-screens/BdsmParty/Envelope open.svg'),
        asset('image', '/images/win-screens/BdsmParty/Invitation.svg'),
        asset('image', '/images/win-screens/BdsmParty/stamp.svg'),
        asset('audio', '/sounds/paper.mp3'),
      )
      break

    case 'pizza':
      assets.push(
        resolvedWinBackground(customBackground, option.src),
        asset('image', '/images/win-screens/Pizza/Fight.svg'),
        asset('image', '/images/win-screens/Pizza/Pizza.svg'),
        asset('image', '/images/win-screens/Pizza/Police.svg'),
        asset('audio', '/sounds/Burp.mp3'),
      )
      break

    case 'picnic':
      assets.push(
        resolvedWinBackground(customBackground, option.src),
        asset('image', '/images/win-screens/Picnic/PicnicBag.svg'),
        asset('image', '/images/win-screens/Picnic/Glass01.svg'),
        asset('image', '/images/win-screens/Picnic/Bread.svg'),
        asset('image', '/images/win-screens/Picnic/Wine.svg'),
        asset('image', '/images/win-screens/Picnic/Glass02.svg'),
        asset('image', '/images/win-screens/Picnic/Pesto.svg'),
        asset('image', '/images/win-screens/Picnic/Weapon.svg'),
      )
      break

    case 'eilat':
      assets.push(
        resolvedWinBackground(customBackground, option.src),
        asset('image', '/images/win-screens/Eilat/arm.svg'),
        asset('image', '/images/win-screens/Eilat/chair.svg'),
        asset('image', '/images/win-screens/Eilat/thumb.svg'),
        asset('audio', '/sounds/Platic01.mp3'),
        asset('audio', '/sounds/Platic02.mp3'),
        asset('audio', '/sounds/Platic03.mp3'),
      )
      break

    case 'graffiti':
    case 'kippah-cutting':
    default:
      assets.push(resolvedWinBackground(customBackground, option.src))
      break
  }

  if (node.data.winSoundCustom?.trim()) {
    assets.push(asset('audio', node.data.winSoundCustom))
  } else if (!node.data.winSoundCustomId) {
    const sound = getWinSound(node.data.winSound)
    if (sound) assets.push(asset('audio', sound.src))
  }

  return assets
}

function operationAssets(
  node: Extract<GameFlowNode, { type: 'operation' }>,
): GamePreloadAsset[] {
  const itemSounds = node.data.window?.itemSounds
  const sounds = Object.entries(OPERATION_DEFAULT_SOUNDS).flatMap(
    ([key, defaultSource]) => {
      const override = itemSounds?.[key as keyof typeof OPERATION_DEFAULT_SOUNDS]
      if (override === OPERATION_SOUND_NONE) return []
      return optionalAsset('audio', override ?? defaultSource)
    },
  )
  return [...OPERATION_IMAGE_ASSETS, ...sounds]
}

/**
 * Return every network-backed asset rendered by a flow node itself or by the
 * immediate gameplay surface that node opens. Navigation URLs and ordinary
 * attachment links are deliberately excluded: preloading them would visit a
 * destination that the player may never choose.
 */
export function assetsForFlowNode(node: GameFlowNode): GamePreloadAsset[] {
  const assets: GamePreloadAsset[] = []

  if (node.type === 'login') {
    assets.push(...LOGIN_ASSETS)
  } else if (node.type === 'ranking') {
    assets.push(...RANKING_ASSETS)
  } else {
    assets.push(...DESKTOP_ASSETS)
  }

  switch (node.type) {
    case 'case':
      assets.push(...CASE_ASSETS)
      assets.push(...optionalAsset('image', node.data.window?.photoUrl))
      node.data.window?.suspicions?.forEach((row) => {
        if (!row.fileFootageVariant) return
        const footage = FOOTAGE_ASSETS[row.fileFootageVariant]
        if (footage) assets.push(footage)
      })
      break

    case 'operation':
      assets.push(...operationAssets(node))
      break

    case 'message':
      assets.push(...BOSS_MESSAGE_ASSETS)
      if (node.data.messageType === 'voice') {
        assets.push(...optionalAsset('audio', node.data.content))
      }
      assets.push(...optionalAsset('image', node.data.photoUrl))
      if (node.data.buttonLinkType === 'achievements') {
        assets.push(...ACHIEVEMENTS_ASSETS)
      } else if (node.data.buttonLinkType === 'miniGame') {
        assets.push(...MINI_GAME_ASSETS)
      }
      break

    case 'result':
      assets.push(...winAssets(node))
      break

    case 'miniGame':
      assets.push(...MINI_GAME_ASSETS)
      break

    case 'points':
      assets.push(...ACHIEVEMENTS_ASSETS)
      break
  }

  return uniqueAssets(assets)
}

/**
 * Assets configured outside the connected walker graph. GamePage uses the
 * first background-music node, so this mirrors that precedence exactly.
 */
export function globalFlowAssets(nodes: readonly GameFlowNode[]): GamePreloadAsset[] {
  const musicNode = nodes.find(
    (node): node is Extract<GameFlowNode, { type: 'bgMusic' }> => node.type === 'bgMusic',
  )
  if (!musicNode) return []

  const source = typeof musicNode.data.srcCustom === 'string'
    ? musicNode.data.srcCustom
    : getBgMusic(musicNode.data.src).src
  return uniqueAssets(optionalAsset('audio', source))
}
