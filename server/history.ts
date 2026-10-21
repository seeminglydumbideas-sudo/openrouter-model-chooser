// Shared by the Vite dev server (vite.config.ts) and the container server
// (server/server.ts): keeps one OpenRouter snapshot per day, so the 2D Matrix
// can replay how the market moved.
//
//   GET  /__history              → { directory, days: DaySummary[] }   (the UI probes this)
//   GET  /__history/YYYY-MM-DD   → that day's record (gzip-encoded JSON)
//   POST /__history              ← { models: OpenRouterModelRaw[], imageApiModels: string[] }
//
// Records are <dir>/YYYY-MM-DD.json.gz (history/ by default, HISTORY_DIR
// overrides it): { date, fetchedAt, synthetic?, models, imageApiModels }, models
// being the raw /api/v1/models payload. At most one record per day: a POST
// replaces today's record (UTC date, chosen server-side — the client never
// names a file). ~90 KB per day gzipped. The server also fetches on its own
// (startHistoryRecorder), so no open browser tab is needed.
import type { IncomingMessage, ServerResponse } from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import { gunzipSync, gzipSync } from 'node:zlib'

export const HISTORY_ROUTE = '/__history'
const MAX_BYTES = 32 * 1024 * 1024
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const FILE_RE = /^(\d{4}-\d{2}-\d{2})\.json\.gz$/

export interface HistoryRecord {
  date: string
  fetchedAt: string
  synthetic?: boolean
  models: RawModel[]
  imageApiModels: string[]
}

interface RawModel {
  id: string
  pricing?: { prompt?: string; completion?: string }
  benchmarks?: { artificial_analysis?: Record<string, number | null | undefined> }
}

// What the timeline histogram plots: changes vs. the previous recorded day.
export interface DaySummary {
  date: string
  synthetic: boolean
  count: number
  added: number
  removed: number
  repriced: number
  rescored: number
}

export function resolveHistoryDir(root: string): string {
  return path.resolve(root, process.env.HISTORY_DIR ?? 'history')
}

export function encodeRecord(record: HistoryRecord): Buffer {
  return gzipSync(JSON.stringify(record))
}

const priceKey = (m: RawModel) => `${m.pricing?.prompt}|${m.pricing?.completion}`
const scoreKey = (m: RawModel) => {
  const aa = m.benchmarks?.artificial_analysis
  return `${aa?.intelligence_index}|${aa?.coding_index}|${aa?.agentic_index}`
}

// Per-file fingerprints, cached by mtime so the index is cheap to rebuild.
interface Fingerprint { mtimeMs: number; synthetic: boolean; models: Map<string, { price: string; score: string }> }
const fingerprints = new Map<string, Fingerprint>()

async function fingerprint(file: string): Promise<Fingerprint> {
  const { mtimeMs } = await fs.stat(file)
  const cached = fingerprints.get(file)
  if (cached?.mtimeMs === mtimeMs) return cached
  const record = JSON.parse(gunzipSync(await fs.readFile(file)).toString('utf8')) as HistoryRecord
  const fp: Fingerprint = {
    mtimeMs,
    synthetic: !!record.synthetic,
    models: new Map(record.models.map(m => [m.id, { price: priceKey(m), score: scoreKey(m) }])),
  }
  fingerprints.set(file, fp)
  return fp
}

async function summarize(dir: string): Promise<DaySummary[]> {
  const names = (await fs.readdir(dir).catch(() => [] as string[])).filter(n => FILE_RE.test(n)).sort()
  const days: DaySummary[] = []
  let prev: Fingerprint | null = null
  for (const name of names) {
    let fp: Fingerprint
    try {
      fp = await fingerprint(path.join(dir, name))
    } catch {
      continue // unreadable/corrupt record: skip it rather than break the timeline
    }
    const day: DaySummary = { date: FILE_RE.exec(name)![1], synthetic: fp.synthetic, count: fp.models.size, added: 0, removed: 0, repriced: 0, rescored: 0 }
    if (prev) {
      for (const [id, now] of fp.models) {
        const before = prev.models.get(id)
        if (!before) day.added++
        else {
          if (before.price !== now.price) day.repriced++
          if (before.score !== now.score) day.rescored++
        }
      }
      for (const id of prev.models.keys()) if (!fp.models.has(id)) day.removed++
    }
    days.push(day)
    prev = fp
  }
  return days
}

export async function handleHistory(req: IncomingMessage, res: ServerResponse, dir: string): Promise<void> {
  const reply = (status: number, body: object) => {
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(body))
  }
  // Under Vite (connect), req.url has the mount prefix stripped; originalUrl keeps it.
  const full = (req as IncomingMessage & { originalUrl?: string }).originalUrl ?? req.url ?? ''
  const sub = new URL(full, 'http://localhost').pathname.slice(HISTORY_ROUTE.length).replace(/^\/+|\/+$/g, '')

  if (req.method === 'GET' && sub === '') return reply(200, { directory: dir, days: await summarize(dir) })
  if (req.method === 'GET') {
    if (!DAY_RE.test(sub)) return reply(404, { error: 'expected /__history/YYYY-MM-DD' })
    try {
      const body = await fs.readFile(path.join(dir, `${sub}.json.gz`))
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Content-Encoding', 'gzip')
      // Past days never change; today's may be replaced by a later fetch.
      res.setHeader('Cache-Control', sub === new Date().toISOString().slice(0, 10) ? 'no-cache' : 'max-age=86400')
      return void res.end(body)
    } catch {
      return reply(404, { error: `no record for ${sub}` })
    }
  }
  if (req.method !== 'POST' || sub !== '') return reply(405, { error: 'GET or POST only' })

  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BYTES) return reply(413, { error: 'request too large' })
    chunks.push(chunk)
  }
  let body: { models?: unknown; imageApiModels?: unknown }
  try {
    body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    return reply(400, { error: 'expected JSON { models, imageApiModels }' })
  }
  const { models, imageApiModels } = body
  if (!Array.isArray(models) || models.length === 0 || !models.every(m => m && typeof m.id === 'string')
    || !Array.isArray(imageApiModels) || !imageApiModels.every(id => typeof id === 'string')) {
    return reply(400, { error: 'expected JSON { models: [{ id, … }], imageApiModels: string[] }' })
  }

  try {
    const { date, file } = await writeToday(dir, models as RawModel[], imageApiModels)
    reply(200, { date, file, models: models.length })
  } catch (err) {
    reply(500, { error: (err as Error).message })
  }
}

// Replaces today's record (UTC date). Temp file + rename: a reader never sees half a file.
async function writeToday(dir: string, models: RawModel[], imageApiModels: string[]): Promise<{ date: string; file: string }> {
  const now = new Date()
  const date = now.toISOString().slice(0, 10)
  const file = path.join(dir, `${date}.json.gz`)
  await fs.mkdir(dir, { recursive: true })
  const tmp = `${file}.tmp`
  await fs.writeFile(tmp, encodeRecord({ date, fetchedAt: now.toISOString(), models, imageApiModels }))
  await fs.rename(tmp, file)
  return { date, file }
}

// Server-side recorder, so history accumulates while no browser has the page
// open. Every hour it checks today's record and refetches when it is missing
// (new UTC day, first start) or older than HISTORY_FETCH_HOURS (default 12, so
// at least twice a day; 0 disables). Browser visits still save their own fetch.
const CHECK_MS = 60 * 60 * 1000

export function startHistoryRecorder(dir: string, log: (msg: string) => void = console.log): void {
  const hours = Number(process.env.HISTORY_FETCH_HOURS ?? 12)
  if (!(hours > 0)) return
  // Once per directory per process: Vite re-evaluates its config (and this
  // module) on restart, so module state alone would stack timers.
  const started = ((globalThis as { __historyRecorders?: Set<string> }).__historyRecorders ??= new Set())
  if (started.has(dir)) return
  started.add(dir)
  const maxAgeMs = hours * 60 * 60 * 1000

  const check = async () => {
    const today = path.join(dir, `${new Date().toISOString().slice(0, 10)}.json.gz`)
    const age = await fs.stat(today).then(st => Date.now() - st.mtimeMs, () => Infinity)
    if (age < maxAgeMs) return
    try {
      const [modelsRes, imagesRes] = await Promise.all([
        fetch('https://openrouter.ai/api/v1/models', { signal: AbortSignal.timeout(60_000) }),
        fetch('https://openrouter.ai/api/v1/images/models', { signal: AbortSignal.timeout(60_000) }).catch(() => null),
      ])
      if (!modelsRes.ok) throw new Error(`OpenRouter ${modelsRes.status} ${modelsRes.statusText}`)
      const models = ((await modelsRes.json()) as { data?: unknown }).data
      if (!Array.isArray(models) || models.length === 0) throw new Error('unexpected /api/v1/models payload')
      // Without the Image API list, keep the one from the latest record rather than storing none.
      const images = imagesRes?.ok ? ((await imagesRes.json()) as { data?: unknown }).data : null
      const imageApiModels: string[] = Array.isArray(images) ? images.map((m: { id: string }) => m.id) : await latestImageApiModels(dir)
      const { file } = await writeToday(dir, models, imageApiModels)
      log(`[history] recorded ${models.length} models → ${file}`)
    } catch (err) {
      log(`[history] fetch failed, retrying within the hour: ${(err as Error).message}`)
    }
  }

  void check()
  setInterval(() => void check(), CHECK_MS).unref()
}

async function latestImageApiModels(dir: string): Promise<string[]> {
  const latest = (await fs.readdir(dir).catch(() => [] as string[])).filter(n => FILE_RE.test(n)).sort().at(-1)
  if (!latest) return []
  try {
    return (JSON.parse(gunzipSync(await fs.readFile(path.join(dir, latest))).toString('utf8')) as HistoryRecord).imageApiModels
  } catch {
    return []
  }
}
