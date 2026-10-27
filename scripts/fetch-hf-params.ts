// Looks up every open-weight model OpenRouter lists (those with a
// `hugging_face_id`) on the Hugging Face Hub and writes what the matrix needs
// for its "VRAM" bubble size into src/data/hfModels.json:
//
//   node scripts/fetch-hf-params.ts
//
// Per repo: total parameter count and native weight size (from the
// safetensors metadata), whether downloads are gated, and the licence.
// Ids come from the live /api/v1/models plus the bundled snapshot. Parameter
// counts don't change, so a repo already in the file is kept when the Hub
// doesn't answer; run it again when new open models appear.
import fs from 'node:fs/promises'
import path from 'node:path'

interface HfEntry {
  params: number | null
  weightBytes: number | null
  gated: boolean
  license: string | null
}

const root = path.resolve(import.meta.dirname, '..')
const outFile = path.join(root, 'src/data/hfModels.json')

// Bytes per parameter of each safetensors dtype. Packed quantised repos
// (GPTQ/AWQ store int4 in I32) overcount parameters — fine for an estimate.
const DTYPE_BYTES: Record<string, number> = {
  F64: 8, I64: 8, U64: 8, F32: 4, I32: 4, U32: 4,
  F16: 2, BF16: 2, I16: 2, U16: 2,
  F8_E4M3: 1, F8_E5M2: 1, I8: 1, U8: 1, BOOL: 1,
  F4: 0.5, MXFP4: 0.5,
}

interface HubModel {
  safetensors?: { total?: number; parameters?: Record<string, number> }
  gated?: boolean | string
  cardData?: { license?: string }
}

function hfIdsOf(models: Array<{ hugging_face_id?: string | null }>): string[] {
  return models.map(m => m.hugging_face_id?.trim()).filter((id): id is string => !!id)
}

const bundled = JSON.parse(await fs.readFile(path.join(root, 'src/data/snapshot.json'), 'utf8'))
let live: Array<{ hugging_face_id?: string | null }> = []
try {
  const res = await fetch('https://openrouter.ai/api/v1/models')
  live = ((await res.json()) as { data?: typeof live }).data ?? []
} catch (err) {
  console.warn('OpenRouter unavailable, using the bundled snapshot only:', err)
}
const ids = [...new Set([...hfIdsOf(bundled), ...hfIdsOf(live)])].sort()

const previous: Record<string, HfEntry> = JSON.parse(await fs.readFile(outFile, 'utf8').catch(() => '{}'))
const result: Record<string, HfEntry> = {}

async function lookup(id: string): Promise<void> {
  try {
    const res = await fetch(`https://huggingface.co/api/models/${id}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = (await res.json()) as HubModel
    const counts: Record<string, number> = json.safetensors?.parameters ?? {}
    const entries = Object.entries(counts)
    result[id] = {
      params: json.safetensors?.total ?? null,
      weightBytes: entries.length ? entries.reduce((sum, [dtype, n]) => sum + n * (DTYPE_BYTES[dtype] ?? 2), 0) : null,
      gated: !!json.gated,
      license: json.cardData?.license ?? null,
    }
  } catch (err) {
    if (previous[id]) result[id] = previous[id]
    console.warn(`${id}: ${(err as Error).message}${previous[id] ? ' (kept previous entry)' : ''}`)
  }
}

// A few requests at a time keeps well under the Hub's anonymous rate limit.
const queue = [...ids]
await Promise.all(Array.from({ length: 6 }, async () => {
  for (let id = queue.shift(); id; id = queue.shift()) await lookup(id)
}))

const sorted = Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)))
await fs.writeFile(outFile, JSON.stringify(sorted, null, 1) + '\n')
const withParams = Object.values(sorted).filter(e => e.params).length
console.log(`${ids.length} Hugging Face ids, ${Object.keys(sorted).length} found, ${withParams} with a parameter count → ${path.relative(root, outFile)}`)
