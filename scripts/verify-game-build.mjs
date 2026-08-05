import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const distDir = path.resolve(root, 'dist')
const authorGraphPath = path.resolve(root, 'data/editor-state-current.json')
const deployedGraphPath = path.resolve(distDir, 'game-content.json')
const vercelConfigPath = path.resolve(root, 'vercel.json')
const approvedVercelRewrite = {
  source: '/((?!editor(?:/|$)|api/editor(?:[-/]|$)).*)',
  destination: '/index.html',
}
const approvedShowcaseRewrite = {
  source: '/showcase',
  destination: '/showcase.html',
}

const errors = []

function requireFile(filePath, label) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    errors.push(`Missing ${label}: ${path.relative(root, filePath)}`)
    return null
  }
  return fs.readFileSync(filePath)
}

function listFiles(directory) {
  if (!fs.existsSync(directory)) return []
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name)
    return entry.isDirectory() ? listFiles(fullPath) : [fullPath]
  })
}

function findBrowserOnlyMedia(value, jsonPath = '$') {
  if (
    typeof value === 'string' &&
    /^(?:blob:|file:|https?:\/\/(?:localhost|127(?:\.\d{1,3}){3}|\[?::1\]?)(?::|\/|$))/i.test(value)
  ) {
    errors.push(`Local-only URL at ${jsonPath}`)
    return
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => findBrowserOnlyMedia(item, `${jsonPath}[${index}]`))
    return
  }
  if (!value || typeof value !== 'object') return

  const localOnlyFields = new Set([
    'photoCustomId',
    'winImageCustomId',
    'winSoundCustomId',
  ])

  for (const [key, child] of Object.entries(value)) {
    if (localOnlyFields.has(key) && typeof child === 'string' && child.trim()) {
      errors.push(`Browser-only media reference at ${jsonPath}.${key}`)
    }
    findBrowserOnlyMedia(child, `${jsonPath}.${key}`)
  }
}

const indexHtml = requireFile(path.resolve(distDir, 'index.html'), 'game index')
const authorGraph = requireFile(authorGraphPath, 'authoring graph')
const deployedGraph = requireFile(deployedGraphPath, 'deployed graph')

if (authorGraph && deployedGraph && !authorGraph.equals(deployedGraph)) {
  errors.push('The deployed game content differs from the canonical graph.')
}

if (authorGraph) {
  try {
    const parsed = JSON.parse(authorGraph.toString('utf8'))
    if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
      errors.push('The graph must contain nodes and edges arrays.')
    }
    findBrowserOnlyMedia(parsed)
  } catch (error) {
    errors.push(`The authoring graph is invalid JSON: ${error.message}`)
  }
}

for (const directory of ['fonts', 'images', 'sounds']) {
  if (!fs.existsSync(path.resolve(distDir, directory))) {
    errors.push(`Missing deployed asset directory: ${directory}`)
  }
}

const files = listFiles(distDir)
const forbiddenNames = [
  'codex-load-editor-state.html',
  'editor-state-2026-06-24.json',
]

for (const file of files) {
  const relative = path.relative(distDir, file).split(path.sep).join('/')
  const basename = path.basename(file)

  if (
    /^(?:editor(?:\/|$)|api\/editor(?:[-/]|$)|data(?:\/|$)|versions(?:\/|$))/i.test(relative) ||
    /editor/i.test(relative)
  ) {
    errors.push(`Editor-only output path was deployed: ${relative}`)
  }
  if (forbiddenNames.includes(basename)) {
    errors.push(`Editor-only file was deployed: ${relative}`)
  }
  if (/^editor-state-.*\.json$/.test(basename)) {
    errors.push(`Editor-named graph file was deployed: ${relative}`)
  }
  if (basename === '.DS_Store') {
    errors.push(`Finder metadata was deployed: ${relative}`)
  }
  if (basename.endsWith('.map')) {
    errors.push(`Source map was deployed: ${relative}`)
  }

  if (!/\.(?:css|html|js)$/.test(file)) continue
  const contents = fs.readFileSync(file, 'utf8')
  const forbiddenCode = [
    ['editor route', /\/editor(?:\/|\?|\*|["'`])/],
    ['editor state API', /\/api\/editor-state/],
    ['editor versions API', /\/api\/editor-versions/],
    ['editor loading UI', /Loading editor graph/],
  ]

  for (const [label, pattern] of forbiddenCode) {
    if (pattern.test(contents)) {
      errors.push(`Found ${label} in ${relative}`)
    }
  }
}

if (indexHtml && indexHtml.includes('/src/main.tsx')) {
  errors.push('Production index still references the local app entrypoint.')
}

try {
  const vercelConfig = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf8'))
  const rewrites = Array.isArray(vercelConfig.rewrites) ? vercelConfig.rewrites : []
  const hasOnlyApprovedRewrite =
    rewrites.length === 2 &&
    rewrites[0]?.source === approvedShowcaseRewrite.source &&
    rewrites[0]?.destination === approvedShowcaseRewrite.destination &&
    rewrites[1]?.source === approvedVercelRewrite.source &&
    rewrites[1]?.destination === approvedVercelRewrite.destination
  if (!hasOnlyApprovedRewrite) {
    errors.push(
      'Vercel rewrites must contain only the read-only showcase and approved game SPA fallback.',
    )
  }
  const forbiddenCatchAll = rewrites.some(
    (rewrite) =>
      rewrite?.source === '/(.*)' ||
      rewrite?.source === '/:path*' ||
      rewrite?.source === '/(.*)*',
  )
  if (forbiddenCatchAll) {
    errors.push('Vercel still has an unconditional SPA fallback.')
  }
} catch (error) {
  errors.push(`Could not validate vercel.json: ${error.message}`)
}

if (errors.length > 0) {
  console.error('Game-only build verification failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log(`Game-only build verified (${files.length} files).`)
