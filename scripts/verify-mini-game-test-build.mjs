import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const distDir = path.resolve(root, 'dist')
const testDir = path.resolve(distDir, 'mini-game-test')
const testAssetsDir = path.resolve(testDir, 'assets')
const candidateSourceAssetsDir = path.resolve(
  root,
  'src/mini-game-test/candidate/assets',
)
const errors = []

function listFiles(directory) {
  if (!fs.existsSync(directory)) return []
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name)
    return entry.isDirectory() ? listFiles(fullPath) : [fullPath]
  })
}

function requireFile(filePath, label) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    errors.push(`Missing ${label}: ${path.relative(root, filePath)}`)
    return null
  }
  return fs.readFileSync(filePath)
}

function readPngHeader(filePath) {
  const bytes = fs.readFileSync(filePath)
  const pngSignature = '89504e470d0a1a0a'
  if (bytes.subarray(0, 8).toString('hex') !== pngSignature || bytes.length < 26) {
    return null
  }
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    colorType: bytes[25],
  }
}

function readUint24LE(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16)
}

function readWebpInfo(filePath) {
  const bytes = fs.readFileSync(filePath)
  if (
    bytes.length < 16 ||
    bytes.subarray(0, 4).toString('ascii') !== 'RIFF' ||
    bytes.subarray(8, 12).toString('ascii') !== 'WEBP'
  ) {
    return null
  }

  const info = { width: null, height: null, frames: [], loopCount: null }
  let offset = 12
  while (offset + 8 <= bytes.length) {
    const type = bytes.subarray(offset, offset + 4).toString('ascii')
    const size = bytes.readUInt32LE(offset + 4)
    const dataOffset = offset + 8
    if (dataOffset + size > bytes.length) return null

    if (type === 'VP8X' && size >= 10) {
      info.width = readUint24LE(bytes, dataOffset + 4) + 1
      info.height = readUint24LE(bytes, dataOffset + 7) + 1
    } else if (type === 'VP8L' && size >= 5 && bytes[dataOffset] === 0x2f) {
      const bits = bytes.readUInt32LE(dataOffset + 1)
      info.width = (bits & 0x3fff) + 1
      info.height = ((bits >>> 14) & 0x3fff) + 1
    } else if (type === 'ANIM' && size >= 6) {
      info.loopCount = bytes.readUInt16LE(dataOffset + 4)
    } else if (type === 'ANMF' && size >= 16) {
      info.frames.push({ duration: readUint24LE(bytes, dataOffset + 12) })
    }

    offset = dataOffset + size + (size % 2)
  }
  return info
}

const testIndex = requireFile(path.resolve(testDir, 'index.html'), 'mini-game test index')
requireFile(path.resolve(distDir, 'index.html'), 'normal game index')
requireFile(path.resolve(distDir, 'game-content.json'), 'normal game content')

const testFiles = listFiles(testDir)
const testCodeFiles = testFiles.filter((file) => /\.(?:css|html|js)$/.test(file))
const testCode = testCodeFiles
  .map((file) => fs.readFileSync(file, 'utf8'))
  .join('\n')

const forbiddenRuntimeReferences = [
  ['game content graph', /game-content\.json/i],
  ['public game entry', /main\.game/i],
  ['public game application', /GameApp/],
  ['game content provider', /GameContentProvider/],
  ['normal game preloader', /gamePreloadAssets|preloadGameAssets/],
  ['background music runtime', /backgroundMusic|BackgroundMusic/],
]

for (const [label, pattern] of forbiddenRuntimeReferences) {
  if (pattern.test(testCode)) {
    errors.push(`The isolated test bundle contains a ${label} reference.`)
  }
}

if (testIndex && !testIndex.toString('utf8').includes('noindex')) {
  errors.push('The unlisted test page is missing a noindex directive.')
}

const hasVersionNavigation = /searchParams\.set\(["']version["']/.test(testCode)
const hasCurrentControl = /data-version["']?:["']current/.test(testCode)
const hasOptimizedControl = /data-version["']?:["']optimized/.test(testCode)
if (!hasVersionNavigation || !hasCurrentControl || !hasOptimizedControl) {
  errors.push('The test bundle is missing reload-separated Current/Optimized navigation.')
}

for (const file of testFiles) {
  const relative = path.relative(testDir, file).split(path.sep).join('/')
  if (file.endsWith('.map')) errors.push(`Source map emitted in test output: ${relative}`)
  if (/game_bg.*\.svg$/i.test(relative)) {
    errors.push(`Unoptimized SVG background emitted in test output: ${relative}`)
  }
}

const emittedAssets = listFiles(testAssetsDir)
const emittedCandidateImages = emittedAssets.filter((file) => /\.(?:png|webp|gif)$/i.test(file))
const unhashedImages = emittedCandidateImages.filter(
  (file) => !/-[A-Za-z0-9_-]{6,}\.(?:png|webp|gif)$/i.test(path.basename(file)),
)

if (emittedCandidateImages.length < 5) {
  errors.push(
    `Expected at least five emitted candidate images, found ${emittedCandidateImages.length}.`,
  )
}
for (const file of unhashedImages) {
  errors.push(`Candidate image URL is not content-hashed: ${path.basename(file)}`)
}

const candidateSourceFiles = listFiles(candidateSourceAssetsDir)
const backgroundSource = candidateSourceFiles.find(
  (file) => /(?:background|game[-_]?bg).*\.png$/i.test(file),
)
if (!backgroundSource) {
  errors.push('Missing the candidate indexed PNG background source.')
} else {
  const header = readPngHeader(backgroundSource)
  if (!header) {
    errors.push('Candidate background is not a valid PNG.')
  } else {
    if (header.width !== 1143 || header.height !== 752) {
      errors.push(
        `Candidate background must be 1143x752; found ${header.width}x${header.height}.`,
      )
    }
    if (header.colorType !== 3) {
      errors.push(`Candidate background must be indexed PNG color type 3; found ${header.colorType}.`)
    }
  }
}

const grandmaSources = candidateSourceFiles.filter((file) => /grandma.*\.webp$/i.test(file))
if (grandmaSources.length !== 3) {
  errors.push(`Expected exactly three candidate WebP grandma sprites; found ${grandmaSources.length}.`)
}
for (const grandmaSource of grandmaSources) {
  const info = readWebpInfo(grandmaSource)
  if (!info) {
    errors.push(`Candidate grandma is not a valid WebP: ${path.basename(grandmaSource)}`)
  } else if (info.width !== 472) {
    errors.push(
      `Candidate grandma must be 2x its 236px runtime width; found ${info.width}px in ${path.basename(grandmaSource)}.`,
    )
  }
}

const hammerSources = candidateSourceFiles.filter((file) => /hammer.*\.webp$/i.test(file))
if (hammerSources.length !== 1) {
  errors.push(`Expected exactly one stable candidate WebP hammer resource; found ${hammerSources.length}.`)
} else {
  const info = readWebpInfo(hammerSources[0])
  if (!info) {
    errors.push('Candidate hammer is not a valid WebP.')
  } else {
    if (info.frames.length !== 9) {
      errors.push(`Candidate hammer must contain nine frames; found ${info.frames.length}.`)
    }
    const invalidDurations = info.frames.filter((frame) => frame.duration !== 40)
    if (invalidDurations.length > 0) {
      errors.push('Every candidate hammer frame must last 40ms.')
    }
    if (info.loopCount !== 1) {
      errors.push(`Candidate hammer must play once; found WebP loop count ${info.loopCount}.`)
    }
  }
}

const candidateImageBytes = candidateSourceFiles
  .filter((file) => /\.(?:png|webp|gif)$/i.test(file))
  .reduce((total, file) => total + fs.statSync(file).size, 0)
if (candidateImageBytes > 700_000) {
  errors.push(
    `Candidate image pack is ${candidateImageBytes.toLocaleString()} bytes; expected no more than 700,000.`,
  )
}

if (errors.length > 0) {
  console.error('Mini-game test build verification failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log(
  `Mini-game test build verified (${testFiles.length} files, ${candidateImageBytes.toLocaleString()} source image bytes).`,
)
