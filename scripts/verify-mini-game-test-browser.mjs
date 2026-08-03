import fs from 'node:fs'

const debuggerUrl = process.env.CHROME_DEBUG_URL ?? 'http://127.0.0.1:9223'
const testUrl = process.env.MINI_GAME_TEST_URL
  ?? 'http://127.0.0.1:4174/mini-game-test/?version=optimized'
const screenshotPath = process.env.MINI_GAME_TEST_SCREENSHOT
  ?? '/tmp/mini-game-test-optimized.png'

const targets = await fetch(`${debuggerUrl}/json/list`).then((response) => response.json())
const pageTarget = targets.find((target) => target.type === 'page')
if (!pageTarget?.webSocketDebuggerUrl) {
  throw new Error(`No Chrome page target found at ${debuggerUrl}`)
}

const socket = new WebSocket(pageTarget.webSocketDebuggerUrl)
const pending = new Map()
const eventHandlers = new Map()
let nextCommandId = 1

await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true })
  socket.addEventListener('error', reject, { once: true })
})

socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data)
  if (message.id) {
    const command = pending.get(message.id)
    if (!command) return
    pending.delete(message.id)
    if (message.error) command.reject(new Error(message.error.message))
    else command.resolve(message.result)
    return
  }

  const handlers = eventHandlers.get(message.method) ?? []
  for (const handler of handlers) handler(message.params)
})

function send(method, params = {}) {
  const id = nextCommandId++
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })
}

function on(method, handler) {
  const handlers = eventHandlers.get(method) ?? []
  handlers.push(handler)
  eventHandlers.set(method, handlers)
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function evaluate(expression) {
  const response = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  })
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.text ?? 'Browser evaluation failed')
  }
  return response.result.value
}

async function waitForValue(expression, predicate, timeoutMs, label) {
  const startedAt = Date.now()
  let lastValue
  while (Date.now() - startedAt < timeoutMs) {
    lastValue = await evaluate(expression)
    if (predicate(lastValue)) return lastValue
    await sleep(50)
  }
  throw new Error(`Timed out waiting for ${label}; last value: ${JSON.stringify(lastValue)}`)
}

const requests = []
const browserErrors = []
on('Network.requestWillBeSent', ({ request }) => requests.push(request.url))
on('Runtime.exceptionThrown', ({ exceptionDetails }) => {
  browserErrors.push(exceptionDetails.exception?.description ?? exceptionDetails.text)
})
on('Log.entryAdded', ({ entry }) => {
  if (entry.level === 'error') browserErrors.push(entry.text)
})

await Promise.all([
  send('Page.enable'),
  send('Runtime.enable'),
  send('Network.enable'),
  send('Log.enable'),
])
await send('Network.setCacheDisabled', { cacheDisabled: true })
await send('Network.emulateNetworkConditions', {
  offline: false,
  latency: 100,
  downloadThroughput: 500_000,
  uploadThroughput: 500_000,
  connectionType: 'cellular3g',
})
await send('Emulation.setDeviceMetricsOverride', {
  width: 1440,
  height: 1000,
  deviceScaleFactor: 1,
  mobile: false,
})

const optimizedRequestStart = requests.length
await send('Page.navigate', { url: testUrl })

await waitForValue(
  `Boolean(document.querySelector('[data-testid="optimized-mini-game"]'))`,
  Boolean,
  10_000,
  'the optimized component',
)

let sawLoadingGate = false
const assetStates = []
const readinessStartedAt = Date.now()
while (Date.now() - readinessStartedAt < 15_000) {
  const state = await evaluate(`(() => {
    const root = document.querySelector('[data-testid="optimized-mini-game"]')
    const start = document.querySelector('[data-testid="start-game"]')
    return { state: root?.getAttribute('data-assets-state'), disabled: start?.disabled ?? null }
  })()`)
  assetStates.push(state)
  if (state.state === 'loading' && state.disabled === true) sawLoadingGate = true
  if (state.state === 'ready' && state.disabled === false) break
  if (state.state === 'error') throw new Error('Optimized artwork entered its error state')
  await sleep(50)
}

const readyState = assetStates.at(-1)
if (readyState?.state !== 'ready' || readyState.disabled !== false) {
  throw new Error(`Optimized artwork did not become ready: ${JSON.stringify(readyState)}`)
}
if (!sawLoadingGate) {
  throw new Error('Start was not observed disabled while critical artwork was loading')
}

await send('Network.emulateNetworkConditions', {
  offline: false,
  latency: 0,
  downloadThroughput: -1,
  uploadThroughput: -1,
  connectionType: 'none',
})

const optimizedRequests = requests.slice(optimizedRequestStart)
const forbiddenRequestPatterns = [
  /game-content\.json/i,
  /main\.game/i,
  /GameApp/,
  /GameContentProvider/,
  /gamePreloadAssets/,
  /backgroundMusic/i,
]
for (const pattern of forbiddenRequestPatterns) {
  const forbidden = optimizedRequests.find((url) => pattern.test(url))
  if (forbidden) throw new Error(`Isolated optimized page requested forbidden resource: ${forbidden}`)
}

const dragCheck = await evaluate(`(async () => {
  const root = document.querySelector('[data-testid="optimized-mini-game"]')
  const title = root?.firstElementChild
  if (!root || !title) return null
  const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve))
  const dragBy = async (dx, dy) => {
    const rect = root.getBoundingClientRect()
    const x = rect.left + 120
    const y = rect.top + 20
    title.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true, buttons: 1, clientX: x, clientY: y,
    }))
    window.dispatchEvent(new MouseEvent('mousemove', {
      bubbles: true, buttons: 1, clientX: x + dx, clientY: y + dy,
    }))
    await nextFrame()
    await nextFrame()
    window.dispatchEvent(new MouseEvent('mouseup', {
      bubbles: true, clientX: x + dx, clientY: y + dy,
    }))
    await nextFrame()
  }
  const before = root.getBoundingClientRect()
  await dragBy(60, 30)
  const moved = root.getBoundingClientRect()
  await dragBy(-60, -30)
  const restored = root.getBoundingClientRect()
  return {
    movedX: Math.round(moved.left - before.left),
    movedY: Math.round(moved.top - before.top),
    restoredX: Math.round(restored.left - before.left),
    restoredY: Math.round(restored.top - before.top),
  }
})()`)
if (
  !dragCheck ||
  Math.abs(dragCheck.movedX - 60) > 3 ||
  Math.abs(dragCheck.movedY - 30) > 3 ||
  Math.abs(dragCheck.restoredX) > 3 ||
  Math.abs(dragCheck.restoredY) > 3
) {
  throw new Error(`requestAnimationFrame drag check failed: ${JSON.stringify(dragCheck)}`)
}

await send('Emulation.setCPUThrottlingRate', { rate: 4 })
await evaluate(`document.querySelector('[data-testid="start-game"]').click()`)

const firstSpawnId = await waitForValue(
  `document.querySelector('[data-whack-grandma]')?.getAttribute('data-spawn-id')`,
  (value) => Boolean(value),
  5_000,
  'the first painted grandma',
)
await evaluate(`document.querySelector('[aria-label="Minimize"]').click()`)
await sleep(900)
await evaluate(`document.querySelector('[aria-label="Restore"]').click()`)
const restoredSpawnId = await waitForValue(
  `document.querySelector('[data-whack-grandma]')?.getAttribute('data-spawn-id')`,
  (value) => Boolean(value),
  5_000,
  'the minimized grandma to repaint after restore',
)
const livesAfterRestore = await evaluate(
  `document.querySelector('[aria-label$="lives left"]')?.getAttribute('aria-label')`,
)
if (restoredSpawnId !== firstSpawnId || livesAfterRestore !== '3 lives left') {
  throw new Error(
    `Minimize/restore consumed an unpainted spawn: ${JSON.stringify({ firstSpawnId, restoredSpawnId, livesAfterRestore })}`,
  )
}

const gameplay = await evaluate(`new Promise((resolve) => {
  const clicked = new Set()
  const names = new Set()
  const startedAt = performance.now()
  const poll = setInterval(() => {
    const grandma = document.querySelector('[data-whack-grandma]')
    const spawnId = grandma?.getAttribute('data-spawn-id')
    if (grandma && spawnId && !clicked.has(spawnId)) {
      clicked.add(spawnId)
      names.add(grandma.alt)
      grandma.click()
    }

    const score = Number(document.querySelector('[data-testid="score"]')?.textContent?.match(/\\d+/)?.[0] ?? 0)
    const timer = document.querySelector('[data-testid="remaining-time"]')?.textContent ?? ''
    if (score >= 50 && names.size === 3 && timer !== '00:30') {
      clearInterval(poll)
      resolve({ score, timer, hits: clicked.size, names: [...names] })
    } else if (performance.now() - startedAt > 12_000) {
      clearInterval(poll)
      resolve({ score, timer, hits: clicked.size, names: [...names], timedOut: true })
    }
  }, 16)
})`)

if (gameplay.timedOut || gameplay.score < 50 || gameplay.hits < 5 || gameplay.names.length !== 3) {
  throw new Error(`Repeated-hit recovery check failed: ${JSON.stringify(gameplay)}`)
}

await sleep(900)
const metricsText = await evaluate(
  `document.querySelector('[data-testid="frame-metrics"]')?.textContent ?? ''`,
)
const fps = Number(metricsText.match(/(\d+)\s*FPS/)?.[1] ?? 0)
if (fps < 30) throw new Error(`Optimized test measured only ${fps} FPS under 4x CPU throttling`)

const hammerUrls = await evaluate(`[
  ...new Set(performance.getEntriesByType('resource')
    .filter((entry) => entry.initiatorType === 'img')
    .map((entry) => entry.name)
    .filter((name) => /hammer.*\\.webp(?:$|\\?)/i.test(name)))
]`)
if (hammerUrls.length !== 1) {
  throw new Error(`Expected one stable hammer URL; found ${JSON.stringify(hammerUrls)}`)
}

const screenshot = await send('Page.captureScreenshot', { format: 'png' })
fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'))

await send('Emulation.setCPUThrottlingRate', { rate: 1 })
const optimizedTimeOrigin = await evaluate('performance.timeOrigin')
const currentRequestStart = requests.length
await evaluate(`document.querySelector('[data-version="current"]').click()`)

await waitForValue(
  `document.querySelector('[data-testid="mini-game-test"]')?.getAttribute('data-test-version')`,
  (value) => value === 'current',
  15_000,
  'the Current page after a clean reload',
)
const currentTimeOrigin = await evaluate('performance.timeOrigin')
if (currentTimeOrigin === optimizedTimeOrigin) {
  throw new Error('Current/Optimized toggle did not perform a clean document reload')
}

await waitForValue(
  `Boolean(document.querySelector('[data-whack-board]'))`,
  Boolean,
  15_000,
  'the Current mini-game board',
)
await sleep(500)

const currentRequests = requests.slice(currentRequestStart)
if (!currentRequests.some((url) => /(?:baseline\/)?CurrentWhackAMole/i.test(url))) {
  throw new Error('Current toggle did not request the frozen baseline chunk')
}
if (!currentRequests.some((url) => /images\/mini-game\/game_bg\.svg/i.test(url))) {
  throw new Error('Current baseline did not reproduce the existing SVG background request')
}
if (currentRequests.some(
  (url) => /mini-game-test\/candidate|OptimizedWhackAMole|\/assets\/(?:game-bg|grandma-\d+|hammer)-/i.test(url),
)) {
  throw new Error('Current page requested Optimized candidate assets')
}
if (currentRequests.some((url) => /game-content\.json/i.test(url))) {
  throw new Error('Current page requested game-content.json')
}

await evaluate(`document.querySelector('[data-testid="reset-test"]').click()`)
const resetTimeOrigin = await waitForValue(
  'performance.timeOrigin',
  (value) => value !== currentTimeOrigin,
  15_000,
  'Reset to reload the selected version',
)
const resetNavigationType = await waitForValue(
  `performance.getEntriesByType('navigation')[0]?.type`,
  (value) => value === 'reload',
  15_000,
  'Reset navigation type',
)

const errors = [...new Set(browserErrors)].filter(
  (message) => !/favicon\.ico|autoplay|Failed to load resource.*404/i.test(message),
)
if (errors.length > 0) {
  throw new Error(`Browser errors detected: ${errors.join(' | ')}`)
}

console.log(JSON.stringify({
  sawLoadingGate,
  gameplay,
  minimizeRestorePreservedSpawn: restoredSpawnId === firstSpawnId,
  fpsUnder4xCpu: fps,
  metricsText: metricsText.replace(/\s+/g, ' ').trim(),
  optimizedRequestCount: optimizedRequests.length,
  currentRequestCount: currentRequests.length,
  hammerUrls,
  cleanReload: currentTimeOrigin !== optimizedTimeOrigin,
  resetReload: resetTimeOrigin !== currentTimeOrigin && resetNavigationType === 'reload',
  dragCheck,
  screenshotPath,
}, null, 2))

socket.close()
