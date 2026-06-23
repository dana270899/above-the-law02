import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

const liveGraphPath = path.resolve(__dirname, 'data/editor-state-current.json')
const staticGraphPath = path.resolve(__dirname, 'assets/editor-state-current.json')
const versionsDir = path.resolve(__dirname, 'data/versions')

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
        if (!url?.pathname.startsWith('/api/editor')) return next()

        try {
          fs.mkdirSync(path.dirname(liveGraphPath), { recursive: true })
          fs.mkdirSync(path.dirname(staticGraphPath), { recursive: true })
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
            fs.writeFileSync(liveGraphPath, `${raw}\n`)
            fs.writeFileSync(staticGraphPath, `${raw}\n`)
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
            fs.writeFileSync(
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
            fs.writeFileSync(fullPath, `${JSON.stringify(version, null, 2)}\n`)
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

export default defineConfig({
  base: '/above-the-law02/',
  plugins: [react(), fileBackedEditorDataPlugin()],
  publicDir: 'assets',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
