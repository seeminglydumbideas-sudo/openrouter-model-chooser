// Adds an `image_generate` tool that calls OpenRouter's server-side
// `openrouter:image_generation` tool (see
// https://openrouter.ai/docs/guides/features/server-tools/image-generation)
// and writes the resulting image straight to disk.
//
// opencode itself has no built-in support for OpenRouter's server tools, so
// telling an agent's prompt to "invoke OpenRouter's native image_generation
// server tool" does nothing - the model can only call tools opencode actually
// puts in its request. This plugin registers a real tool that does the raw
// HTTP call on the agent's behalf.
import { tool } from "@opencode-ai/plugin"
import fs from "node:fs"
import path from "node:path"
import os from "node:os"

async function getApiKey() {
  if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY
  try {
    const authPath = path.join(os.homedir(), ".local", "share", "opencode", "auth.json")
    const auth = JSON.parse(fs.readFileSync(authPath, "utf8"))
    if (auth?.openrouter?.key) return auth.openrouter.key
  } catch {}
  return null
}

// The exact response envelope for the server tool isn't fully documented, so
// walk the whole JSON body looking for a data: URI or an image URL instead of
// assuming one fixed shape.
function collectImages(node, out = [], seen = new Set()) {
  if (node == null) return out
  if (typeof node === "string") {
    if (node.startsWith("data:image/") && !seen.has(node)) {
      seen.add(node)
      out.push({ kind: "data", value: node })
    } else if (/^https?:\/\/\S+\.(png|jpe?g|webp|gif)(\?\S*)?$/i.test(node) && !seen.has(node)) {
      seen.add(node)
      out.push({ kind: "url", value: node })
    }
    return out
  }
  if (Array.isArray(node)) {
    for (const v of node) collectImages(v, out, seen)
    return out
  }
  if (typeof node === "object") {
    for (const v of Object.values(node)) collectImages(v, out, seen)
  }
  return out
}

const ImageGenerationPlugin = async ({ directory }) => {
  return {
    tool: {
      image_generate: tool({
        description:
          "Generate an image through OpenRouter's server-side image_generation tool and save it to a file. " +
          "Provide a detailed prompt and where to save the result.",
        args: {
          prompt: tool.schema.string().describe("Detailed description of the image to generate"),
          output_path: tool.schema
            .string()
            .describe("Where to save the image (relative to the project directory, or absolute)"),
          image_model: tool.schema
            .string()
            .optional()
            .describe("OpenRouter image-generation model id, e.g. google/gemini-3.1-flash-image or openai/gpt-5-image"),
          router_model: tool.schema
            .string()
            .optional()
            .describe("Tool-calling capable OpenRouter chat model used to trigger the server tool (default openai/gpt-5.2)"),
          aspect_ratio: tool.schema.string().optional(),
          size: tool.schema.string().optional(),
          quality: tool.schema.string().optional(),
        },
        async execute(args, ctx) {
          const apiKey = await getApiKey()
          if (!apiKey) {
            return "No OpenRouter API key found. Set OPENROUTER_API_KEY, or run `opencode auth login` for the openrouter provider."
          }

          const baseDir = ctx.directory || directory
          const outPath = path.isAbsolute(args.output_path) ? args.output_path : path.join(baseDir, args.output_path)

          const parameters = {}
          if (args.image_model) parameters.model = args.image_model
          if (args.aspect_ratio) parameters.aspect_ratio = args.aspect_ratio
          if (args.size) parameters.size = args.size
          if (args.quality) parameters.quality = args.quality

          const body = {
            model: args.router_model || "openai/gpt-5.2",
            messages: [{ role: "user", content: args.prompt }],
            tools: [
              {
                type: "openrouter:image_generation",
                ...(Object.keys(parameters).length ? { parameters } : {}),
              },
            ],
            tool_choice: "required",
          }

          const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          })

          const raw = await res.text()
          let json = null
          try {
            json = JSON.parse(raw)
          } catch {}

          if (!res.ok) {
            return `OpenRouter request failed (HTTP ${res.status}): ${raw.slice(0, 2000)}`
          }
          if (json?.error) {
            return `OpenRouter error: ${JSON.stringify(json.error).slice(0, 2000)}`
          }

          const images = collectImages(json)
          if (images.length === 0) {
            return `No image found in the OpenRouter response. Raw response (truncated):\n${raw.slice(0, 3000)}`
          }

          const [first] = images
          let buf
          if (first.kind === "data") {
            buf = Buffer.from(first.value.split(",")[1], "base64")
          } else {
            const imgRes = await fetch(first.value)
            buf = Buffer.from(await imgRes.arrayBuffer())
          }

          fs.mkdirSync(path.dirname(outPath), { recursive: true })
          fs.writeFileSync(outPath, buf)

          return {
            output: `Saved generated image to ${outPath} (${buf.length} bytes) via ${ctx.agent} [router_model=${body.model}, image_model=${parameters.model || "default"}]`,
            attachments: [
              {
                type: "file",
                mime: "image/png",
                url: `file://${outPath}`,
                filename: path.basename(outPath),
              },
            ],
          }
        },
      }),
    },
  }
}

export const ImageGeneration = ImageGenerationPlugin
export default ImageGenerationPlugin
