import { defineConfig, type Plugin, type ResolvedConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

const liveGraphPath = path.resolve(__dirname, 'data/editor-state-current.json')
const versionsDir = path.resolve(__dirname, 'data/versions')
const gamePublicDirectories = ['fonts', 'images', 'sounds'] as const

function readBody(req: import('http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.setEncoding('utf8')
    req.on('data', (chunk) => {
      body += chunk
    })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

function sendJson(res: import('http').ServerResponse, status: number, data: unknown): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(data))
}

function writeFileAtomic(filePath: string, contents: string): void {
  const temporaryPath = `${filePath}.${process.pid}.tmp`
  try {
    fs.writeFileSync(temporaryPath, contents)
    fs.renameSync(temporaryPath, filePath)
  } finally {
    if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath)
  }
}

function assertGraph(value: unknown): asserts value is { nodes: unknown[]; edges: unknown[] } {
  if (
    !value ||
    typeof value !== 'object' ||
    !Array.isArray((value as { nodes?: unknown }).nodes) ||
    !Array.isArray((value as { edges?: unknown }).edges)
  ) {
    throw new Error('Expected graph with nodes and edges arrays')
  }
}

function timestampId(date = new Date()): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/[:.]/g, '-')
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

function fileBackedEditorDataPlugin() {
  return {
    name: 'file-backed-editor-data',
    configureServer(server: import('vite').ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ? new URL(req.url, 'http://localhost') : null
        try {
          if (req.method === 'GET' && url?.pathname === '/game-content.json') {
            const raw = fs.existsSync(liveGraphPath)
              ? fs.readFileSync(liveGraphPath, 'utf8')
              : '{"nodes":[],"edges":[]}'
            const graph = JSON.parse(raw)
            assertGraph(graph)
            sendJson(res, 200, graph)
            return
          }
          if (!url?.pathname.startsWith('/api/editor')) return next()

          fs.mkdirSync(path.dirname(liveGraphPath), { recursive: true })
          fs.mkdirSync(versionsDir, { recursive: true })

          if (req.method === 'GET' && url.pathname === '/api/editor-state') {
            const raw = fs.existsSync(liveGraphPath)
              ? fs.readFileSync(liveGraphPath, 'utf8')
              : '{"nodes":[],"edges":[]}'
            sendJson(res, 200, JSON.parse(raw))
            return
          }

          if (req.method === 'POST' && url.pathname === '/api/editor-state') {
            const graph = JSON.parse(await readBody(req))
            assertGraph(graph)
            const raw = JSON.stringify(graph, null, 2)
            writeFileAtomic(liveGraphPath, `${raw}\n`)
            sendJson(res, 200, { ok: true, path: 'data/editor-state-current.json' })
            return
          }

          if (req.method === 'GET' && url.pathname === '/api/editor-versions') {
            const versions = fs
              .readdirSync(versionsDir)
              .filter((file) => file.endsWith('.json'))
              .map((file) => {
                const raw = fs.readFileSync(path.join(versionsDir, file), 'utf8')
                return JSON.parse(raw)
              })
              .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
            sendJson(res, 200, { versions })
            return
          }

          if (req.method === 'POST' && url.pathname === '/api/editor-versions') {
            const payload = JSON.parse(await readBody(req))
            assertGraph(payload.graph)
            const now = new Date()
            const name =
              typeof payload.name === 'string' && payload.name.trim()
                ? payload.name.trim()
                : payload.auto
                  ? `Auto snapshot ${now.toLocaleString()}`
                  : `Version ${now.toLocaleString()}`
            const id = timestampId(now)
            const filename = `${id}-${slugify(name) || 'version'}.json`
            const version = {
              id,
              name,
              createdAt: now.toISOString(),
              auto: Boolean(payload.auto),
              filename,
              graph: payload.graph,
            }
            writeFileAtomic(
              path.join(versionsDir, filename),
              `${JSON.stringify(version, null, 2)}\n`,
            )
            sendJson(res, 200, version)
            return
          }

          if (req.method === 'DELETE' && url.pathname.startsWith('/api/editor-versions/')) {
            const id = decodeURIComponent(url.pathname.replace('/api/editor-versions/', ''))
            const file = fs.readdirSync(versionsDir).find((name) => name.startsWith(`${id}-`))
            if (file) fs.unlinkSync(path.join(versionsDir, file))
            sendJson(res, 200, { ok: true })
            return
          }

          if (req.method === 'PATCH' && url.pathname.startsWith('/api/editor-versions/')) {
            const id = decodeURIComponent(url.pathname.replace('/api/editor-versions/', ''))
            const payload = JSON.parse(await readBody(req))
            const file = fs.readdirSync(versionsDir).find((name) => name.startsWith(`${id}-`))
            if (!file) {
              sendJson(res, 404, { error: 'Version not found' })
              return
            }
            const fullPath = path.join(versionsDir, file)
            const version = JSON.parse(fs.readFileSync(fullPath, 'utf8'))
            version.name = typeof payload.name === 'string' && payload.name.trim()
              ? payload.name.trim()
              : version.name
            writeFileAtomic(fullPath, `${JSON.stringify(version, null, 2)}\n`)
            sendJson(res, 200, version)
            return
          }

          sendJson(res, 404, { error: 'Unknown editor API route' })
        } catch (error) {
          sendJson(res, 500, {
            error: error instanceof Error ? error.message : String(error),
          })
        }
      })
    },
  }
}

/**
 * Production builds use a separate entrypoint that has no import path to the
 * editor. They also copy an explicit allow-list of public game assets instead
 * of publishing every file in `assets/`.
 */
function gameOnlyBuildPlugin(): Plugin {
  let outDir = path.resolve(__dirname, 'dist')

  return {
    name: 'game-only-build',
    configResolved(config: ResolvedConfig) {
      outDir = path.resolve(config.root, config.build.outDir)
    },
    generateBundle(_options, bundle) {
      const forbiddenModules = [
        '/src/App.tsx',
        '/src/pages/EditorPage',
        '/src/pages/DesktopPage',
        '/src/pages/LoginPage',
        '/src/components/editor/',
        '/src/lib/editorStorage',
        '/src/lib/versionHistory',
        '/src/lib/tutorialFlow',
        '/node_modules/@xyflow/',
      ]

      for (const output of Object.values(bundle)) {
        if (output.type !== 'chunk') continue
        for (const moduleId of Object.keys(output.modules)) {
          const normalizedId = moduleId.replace(/\\/g, '/')
          const forbidden = forbiddenModules.find((candidate) =>
            normalizedId.includes(candidate),
          )
          const editorNamedSource = /\/src\/.*editor/i.test(normalizedId)
          if (forbidden || editorNamedSource) {
            this.error(
              `Game-only build imported editor module "${normalizedId}" ` +
              `(matched "${forbidden ?? 'editor-named source module'}").`,
            )
          }
        }
      }
    },
    closeBundle() {
      const builtGameHtml = path.resolve(outDir, 'game.html')
      const productionIndexHtml = path.resolve(outDir, 'index.html')
      if (!fs.existsSync(builtGameHtml)) {
        throw new Error('The game-only HTML entrypoint was not built.')
      }
      fs.renameSync(builtGameHtml, productionIndexHtml)

      for (const directory of gamePublicDirectories) {
        const source = path.resolve(__dirname, 'assets', directory)
        const destination = path.resolve(outDir, directory)
        fs.cpSync(source, destination, {
          recursive: true,
          filter: (entry) => path.basename(entry) !== '.DS_Store',
        })
      }

      fs.copyFileSync(
        liveGraphPath,
        path.resolve(outDir, 'game-content.json'),
      )
    },
  }
}

export default defineConfig(({ command }) => {
  const isLocalDev = command === 'serve'

  return {
    base: '/',
    plugins: [
      react(),
      ...(isLocalDev ? [fileBackedEditorDataPlugin()] : [gameOnlyBuildPlugin()]),
    ],
    // Local development serves the full authoring asset tree. Production uses
    // the allow-list copied by gameOnlyBuildPlugin instead.
    publicDir: isLocalDev ? 'assets' : false,
    build: isLocalDev
      ? undefined
      : {
          // Build from an independent HTML root so the local app's import graph
          // is never discovered by Rollup in the first place.
          rollupOptions: {
            input: path.resolve(__dirname, 'game.html'),
          },
          sourcemap: false,
        },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        'zustand/shallow': path.resolve(
          __dirname,
          './node_modules/@xyflow/react/node_modules/zustand/shallow.js',
        ),
      },
    },
  }
})
