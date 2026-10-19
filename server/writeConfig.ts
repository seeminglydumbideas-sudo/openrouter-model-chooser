// Shared by the Vite dev server (vite.config.ts) and the container server
// (server/server.ts): backs the OpenCode Config tab's "Write on disk" button.
//
//   GET  /__opencode/write-config  → { directory, files }   (the UI probes this to show the button)
//   POST /__opencode/write-config  ← { files: { "<name>": "<content>", … } }
//
// Everything lands in one directory, fixed server-side: .opencode/ under the
// server's root by default (OPENCODE_DIR_OUT overrides it). OpenCode reads
// .opencode/opencode.jsonc and loads .opencode/plugins/* from there directly.
// Only the names in WRITABLE_FILES are accepted — the client never chooses a
// path. In the container, the directory is a mounted volume; OPENCODE_DIR_HOST
// (set by `make run`) is its host path, reported to the UI instead of /app/….
// It only changes what is displayed, never where files are written.
import type { IncomingMessage, ServerResponse } from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'

export const WRITE_CONFIG_ROUTE = '/__opencode/write-config'
export const WRITABLE_FILES = ['opencode.jsonc', 'plugins/image-generation.js'] as const
const MAX_BYTES = 1024 * 1024

export function resolveOutputDir(root: string): string {
  return path.resolve(root, process.env.OPENCODE_DIR_OUT ?? '.opencode')
}

// Temp file + rename, so OpenCode never reads a half-written file. Symlinks are
// resolved first (renaming onto a link would replace it), and a bind-mounted
// single file can't be replaced by rename (EBUSY/EXDEV): written in place then.
async function writeAtomically(target: string, content: string): Promise<string> {
  const real = await fs.realpath(target).catch(() => target)
  await fs.mkdir(path.dirname(real), { recursive: true })
  const tmp = `${real}.tmp`
  try {
    await fs.writeFile(tmp, content)
    await fs.rename(tmp, real)
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code !== 'EBUSY' && code !== 'EXDEV') throw err
    await fs.rm(tmp, { force: true })
    await fs.writeFile(real, content)
  }
  return real
}

export async function handleWriteConfig(req: IncomingMessage, res: ServerResponse, outputDir: string): Promise<void> {
  const reply = (status: number, body: object) => {
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(body))
  }
  const hostDir = process.env.OPENCODE_DIR_HOST
  const display = (p: string) => hostDir && p.startsWith(outputDir) ? hostDir + p.slice(outputDir.length) : p
  if (req.method === 'GET') return reply(200, { directory: display(outputDir), files: WRITABLE_FILES })
  if (req.method !== 'POST') return reply(405, { error: 'GET or POST only' })

  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BYTES) return reply(413, { error: 'request too large' })
    chunks.push(chunk)
  }

  let files: Record<string, unknown>
  try {
    files = JSON.parse(Buffer.concat(chunks).toString('utf8')).files
  } catch {
    return reply(400, { error: 'expected JSON { files: { name: content } }' })
  }
  if (!files || typeof files !== 'object') return reply(400, { error: 'expected JSON { files: { name: content } }' })
  const names = Object.keys(files)
  const unknown = names.filter(n => !(WRITABLE_FILES as readonly string[]).includes(n) || typeof files[n] !== 'string')
  if (names.length === 0 || unknown.length) return reply(400, { error: `not writable: ${unknown.join(', ') || '(none given)'}` })

  try {
    const written: string[] = []
    for (const name of names) written.push(await writeAtomically(path.join(outputDir, name), files[name] as string))
    reply(200, { written: written.map(display), bytes: size })
  } catch (err) {
    reply(500, { error: (err as Error).message })
  }
}
