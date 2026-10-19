// Container server: serves the built SPA from dist/ and the "Write on disk"
// endpoint. No dependencies — Node 24 runs this TypeScript file directly
// (type stripping). Run from the repo root: node server/server.ts
import http from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import { WRITE_CONFIG_ROUTE, handleWriteConfig, resolveOutputDir } from './writeConfig.ts'

const root = process.cwd()
const distDir = path.resolve(root, 'dist')
const outputDir = resolveOutputDir(root)
const port = Number(process.env.PORT ?? 8080)

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}

async function serveStatic(urlPath: string, res: http.ServerResponse) {
  // Normalise and keep inside dist/; unknown paths fall back to index.html (SPA).
  let decoded: string
  try {
    decoded = decodeURIComponent(urlPath)
  } catch {
    res.statusCode = 400
    return void res.end('Bad request')
  }
  const requested = path.resolve(distDir, '.' + path.posix.normalize(decoded))
  const candidates = requested.startsWith(distDir + path.sep) ? [requested] : []
  candidates.push(path.join(distDir, 'index.html'))

  for (const file of candidates) {
    try {
      const body = await fs.readFile(file)
      res.statusCode = 200
      res.setHeader('Content-Type', MIME[path.extname(file)] ?? 'application/octet-stream')
      res.end(body)
      return
    } catch {
      // try the next candidate
    }
  }
  res.statusCode = 404
  res.end('Not found')
}

const server = http.createServer((req, res) => {
  const urlPath = new URL(req.url ?? '/', 'http://localhost').pathname
  if (urlPath === WRITE_CONFIG_ROUTE) return void handleWriteConfig(req, res, outputDir)
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405
    return void res.end()
  }
  void serveStatic(urlPath, res)
}).listen(port, () => {
  console.log(`Serving ${distDir} on http://0.0.0.0:${port} — writes into: ${outputDir}`)
})

// As the container's PID 1, Node gets no default SIGTERM/SIGINT handling, so
// `podman stop` would wait 10 s and then kill it.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => server.close(() => process.exit(0)))
}
