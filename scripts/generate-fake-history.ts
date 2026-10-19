// Writes synthetic daily snapshots into the history directory so the 2D Matrix
// timeline has something to show before real records accumulate.
//
//   node scripts/generate-fake-history.ts [--days 30] [--end YYYY-MM-DD]
//
// HISTORY_DIR overrides the target directory (default ./history). Records are
// flagged `synthetic: true`; a real record already on disk is never replaced.
//
// The anchor is the earliest real record in the directory (so the synthetic
// days join the real ones without a jump), else the bundled
// src/data/snapshot.json. It is the last synthetic day's state; --end defaults
// to the day before the anchor record, or yesterday (UTC) for the bundled one.
// Earlier days are derived backwards with a seeded RNG (same output every
// run for the same anchor), following how
// the catalog actually moves day to day:
//   - launches: a few recent models (and promo :free variants) appear partway
//     through, without Artificial Analysis scores for their first days;
//   - retirements: models of the bundled snapshot that the anchor no longer
//     lists (really retired since) disappear partway through;
//   - repricing: ~8% of models change price once, mostly cuts;
//   - rescoring: ~12% of benchmarked models get one index revision;
//   - events cluster on weekdays.
import fs from 'node:fs/promises'
import path from 'node:path'
import { gunzipSync } from 'node:zlib'
import { encodeRecord, resolveHistoryDir, type HistoryRecord } from '../server/history.ts'

interface RawModel {
  id: string
  created?: number
  pricing: Record<string, unknown> & { prompt: string; completion: string; input_cache_read?: string }
  benchmarks?: { artificial_analysis?: Record<string, number | null> }
}

const root = path.resolve(import.meta.dirname, '..')
const args = process.argv.slice(2)
const arg = (name: string) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}
const DAY_MS = 86_400_000
const dir = resolveHistoryDir(root)

async function readRecord(file: string): Promise<HistoryRecord | null> {
  const data = await fs.readFile(file).catch(() => null)
  return data && JSON.parse(gunzipSync(data).toString('utf8'))
}

let anchor: { date: string; models: RawModel[]; imageApiModels: string[] } | null = null
for (const name of (await fs.readdir(dir).catch(() => [] as string[])).filter(n => /^\d{4}-\d{2}-\d{2}\.json\.gz$/.test(n)).sort()) {
  const record = await readRecord(path.join(dir, name))
  if (record && !record.synthetic) {
    anchor = { date: record.date, models: record.models as RawModel[], imageApiModels: record.imageApiModels }
    break
  }
}

const days = Number(arg('days') ?? 30)
const end = arg('end') ?? new Date((anchor ? Date.parse(anchor.date) : Date.now()) - DAY_MS).toISOString().slice(0, 10)
const dates = Array.from({ length: days }, (_, i) => new Date(Date.parse(end) - (days - 1 - i) * DAY_MS).toISOString().slice(0, 10))

// mulberry32: small, seeded, good enough for jitter.
let seed = 20261019
const rand = () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const between = (lo: number, hi: number) => lo + rand() * (hi - lo)
const pick = <T>(items: T[], n: number): T[] => {
  const pool = [...items]
  const out: T[] = []
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0])
  return out
}
// A day index in [from, days-1], weekdays ~3× as likely as weekends.
const eventDay = (from = 1) => {
  const weights: number[] = dates.map((d, i) => (i < from ? 0 : [0, 6].includes(new Date(d).getUTCDay()) ? 0.3 : 1))
  let r = rand() * weights.reduce((a, b) => a + b, 0)
  for (let i = 0; i < weights.length; i++) if ((r -= weights[i]) < 0) return i
  return days - 1
}

const bundled = JSON.parse(await fs.readFile(path.join(root, 'src/data/snapshot.json'), 'utf8')) as RawModel[]
const snapshot = anchor?.models ?? bundled
const imageApiModels = anchor?.imageApiModels ?? JSON.parse(await fs.readFile(path.join(root, 'src/data/imageApiModels.json'), 'utf8')) as string[]
console.log(`anchor: ${anchor ? `real record of ${anchor.date}` : 'bundled src/data/snapshot.json'}`)

const hasScores = (m: RawModel) => Object.values(m.benchmarks?.artificial_analysis ?? {}).some(v => typeof v === 'number')
const isFree = (m: RawModel) => m.id.endsWith(':free') || (parseFloat(m.pricing.prompt) === 0 && parseFloat(m.pricing.completion) === 0)
const byCreated = [...snapshot].sort((a, b) => (b.created ?? 0) - (a.created ?? 0))

const launches = new Map<string, { day: number; scoredFrom: number }>()
for (const m of [...pick(byCreated.filter(m => !isFree(m)).slice(0, 40), 12), ...pick(snapshot.filter(m => m.id.endsWith(':free')), 3)]) {
  const day = eventDay(3)
  launches.set(m.id, { day, scoredFrom: Math.min(days - 1, day + 2 + Math.floor(rand() * 6)) })
}
const anchorIds = new Set(snapshot.map(m => m.id))
const retired = pick(bundled.filter(m => !anchorIds.has(m.id)), 10)
const retirements = new Map(retired.map(m => [m.id, eventDay(3)]))

// Price before the change day = today's × factor (>1: it was cut since).
const priceChanges = new Map<string, { day: number; factor: number }>()
for (const m of snapshot) {
  if (isFree(m) || launches.has(m.id) || rand() > 0.08) continue
  priceChanges.set(m.id, { day: eventDay(), factor: rand() < 0.85 ? between(1.15, 2) : between(0.75, 0.9) })
}
// Index revisions before the change day: one shared direction, per-index size.
const scoreChanges = new Map<string, { day: number; deltas: Record<string, number> }>()
for (const m of snapshot) {
  if (!hasScores(m) || rand() > 0.12) continue
  const delta = (rand() < 0.5 ? -1 : 1) * between(0.3, 2)
  const deltas = Object.fromEntries(Object.keys(m.benchmarks!.artificial_analysis!).map(k => [k, delta * between(0.6, 1.4)]))
  scoreChanges.set(m.id, { day: eventDay(), deltas })
}

const formatPrice = (v: number) => (+v.toPrecision(4)).toFixed(12).replace(/\.?0+$/, '')

function modelOnDay(m: RawModel, day: number): RawModel | null {
  const launch = launches.get(m.id)
  if (launch && day < launch.day) return null
  if ((retirements.get(m.id) ?? Infinity) <= day) return null

  const out: RawModel = structuredClone(m)
  if (launch) out.created = Math.floor((Date.parse(dates[launch.day]) + between(13, 19) * 3_600_000) / 1000)
  if (launch && day < launch.scoredFrom && out.benchmarks?.artificial_analysis) delete out.benchmarks.artificial_analysis

  const price = priceChanges.get(m.id)
  if (price && day < price.day) {
    for (const key of ['prompt', 'completion', 'input_cache_read'] as const) {
      const v = parseFloat(out.pricing[key] ?? '')
      if (v > 0) out.pricing[key] = formatPrice(v * price.factor)
    }
  }
  const score = scoreChanges.get(m.id)
  const aa = out.benchmarks?.artificial_analysis
  if (score && aa && day < score.day) {
    for (const key of Object.keys(aa)) {
      if (typeof aa[key] === 'number') aa[key] = Math.round(Math.max(0, aa[key] + score.deltas[key]) * 10) / 10
    }
  }
  return out
}

await fs.mkdir(dir, { recursive: true })
let written = 0
for (const [day, date] of dates.entries()) {
  const file = path.join(dir, `${date}.json.gz`)
  const existing = await readRecord(file)
  if (existing && !existing.synthetic) {
    console.log(`skip ${date}: real record present`)
    continue
  }
  const models = [...snapshot, ...retired].map(m => modelOnDay(m, day)).filter((m): m is RawModel => m !== null)
  const fetchedAt = new Date(Date.parse(date) + between(8, 22) * 3_600_000).toISOString()
  await fs.writeFile(file, encodeRecord({ date, fetchedAt, synthetic: true, models: models as HistoryRecord['models'], imageApiModels }))
  written++
}
console.log(`${written} synthetic day(s) ${dates[0]} … ${dates.at(-1)} → ${dir}`)
console.log(`launches ${launches.size}, retirements ${retirements.size}, repriced ${priceChanges.size}, rescored ${scoreChanges.size}`)
