import React, { useState, useMemo } from 'react';
import type { ProcessedModel, AxisMetricKey } from '../types/openrouter';
import { calculateParetoFrontier, findMarginalGainWinners, findValueRecoveryModel } from '../services/modelService';
import { 
  Copy, Download, Check,
  Terminal, Zap, Trophy, Image as ImageIcon, Plug 
} from 'lucide-react';

interface OpenCodeConfigViewProps {
  models: ProcessedModel[];
  onSelectModelDetail?: (model: ProcessedModel) => void;
}

export const OpenCodeConfigView: React.FC<OpenCodeConfigViewProps> = ({
  models,
  onSelectModelDetail
}) => {
  const [copiedConfig, setCopiedConfig] = useState<boolean>(false);
  const [copiedPlugin, setCopiedPlugin] = useState<boolean>(false);
  const [copiedBudgetMd, setCopiedBudgetMd] = useState<boolean>(false);
  const [copiedSotaMd, setCopiedSotaMd] = useState<boolean>(false);

  // The build/plan/general role model picks used to come from findKneePointModel
  // (Budget Knee only) and an ad-hoc "cheapest with best coding" rule — both
  // superseded by the Budget Knee + Value Recovery formulas used on the scatter
  // plot. Rather than keep shipping picks made with the old, deprecated logic,
  // these roles report "N/A" until they're wired up to the current formulas.

  // Budget Knee, Value Recovery and SOTA for every task axis, computed with the
  // same current formulas the scatter plot uses (Pareto frontier +
  // findMarginalGainWinners + findValueRecoveryModel) — a single source of truth
  // instead of separate, inconsistent picks per axis. Surfaced both as the image
  // sub-agent model picks below and as an informational comment on the config.
  // SOTA is the single highest-scoring model on the Pareto frontier itself — the
  // frontier is sorted by cost ascending and, being Pareto-efficient, score is
  // monotonically non-decreasing along it, so the last entry is always the best
  // score in the whole dataset, at any price.
  interface AxisSpotlight {
    label: string;
    budget: ProcessedModel | null;
    value: ProcessedModel | null;
    sota: ProcessedModel | null;
  }

  const axisSpotlights = useMemo<AxisSpotlight[]>(() => {
    const spotlightFor = (label: string, dataset: ProcessedModel[], yKey: AxisMetricKey): AxisSpotlight => {
      const pareto = calculateParetoFrontier(dataset, 'blendedCostPerM', yKey);
      const { budgetKnee } = findMarginalGainWinners(pareto, 'blendedCostPerM', yKey, true, false);
      const value = findValueRecoveryModel(pareto, 'blendedCostPerM', yKey, true, false, budgetKnee);
      const sota = pareto.length > 0 ? pareto[pareto.length - 1] : null;
      return { label, budget: budgetKnee, value, sota };
    };

    // Matches the 2D Matrix's default dataset exactly for every preset: batch
    // endpoints excluded, and cost > 0 since every preset runs with the X-axis
    // (Blended Cost) log-scaled, which excludes free/zero-cost models. No extra
    // eligibility filters (ELO floors, id exclusions) beyond that — the scatter
    // plot is the reference, and it has none either.
    const eligibleModels = models.filter(m => !m.id.endsWith(':batch') && m.blendedCostPerM > 0);
    return [
      spotlightFor('Coding', eligibleModels.filter(m => m.codingIndex !== null), 'codingIndex'),
      spotlightFor('Agentic', eligibleModels.filter(m => m.agenticIndex !== null), 'agenticIndex'),
      spotlightFor('Intelligence', eligibleModels.filter(m => m.intelligenceIndex !== null), 'intelligenceIndex'),
      spotlightFor(
        'Text-to-Image',
        eligibleModels.filter(m => m.isImageOutput && m.t2iLeaderboardElo !== null),
        't2iLeaderboardElo'
      ),
    ];
  }, [models]);

  const imageSpotlight = axisSpotlights[3];
  const budgetImageModel = imageSpotlight.budget || models.find(m => m.id === 'google/gemini-3.1-flash-lite-image') || models.find(m => m.id === 'google/gemini-2.5-flash-image') || models.find(m => m.isImageOutput && !m.id.includes('/auto'));
  const sotaImageModel = imageSpotlight.sota || models.find(m => m.id === 'google/gemini-3.1-flash-image') || budgetImageModel;

  const cleanId = (id?: string) => id ? id.replace(':batch', '').replace(/^openrouter\//, '') : '';

  const budgetModelId = budgetImageModel ? cleanId(budgetImageModel.id) : 'google/gemini-3.1-flash-lite-image';
  const sotaModelId = sotaImageModel ? cleanId(sotaImageModel.id) : 'google/gemini-3.1-flash-image';

  // OpenRouter bills image generation per output token (raw.pricing.image_output),
  // not per image — there's no token-count-per-image constant to convert that into
  // an actual "$/image" figure, so we report the real billing unit instead of
  // guessing a per-image number.
  const formatImageCost = (m: ProcessedModel | undefined): string => {
    const raw = m?.raw.pricing.image_output;
    if (!raw) return 'pricing not listed';
    const perMillion = parseFloat(raw) * 1_000_000;
    return perMillion === 0 ? 'free' : `$${perMillion.toFixed(2)}/1M output tokens`;
  };

  const budgetImageCost = formatImageCost(budgetImageModel);
  const sotaImageCost = formatImageCost(sotaImageModel);

  const configHeaderComment = useMemo(() => {
    const generatedAt = new Date().toISOString();
    const labelWidth = Math.max(...axisSpotlights.map(s => s.label.length));
    const tagWidth = Math.max('Best Budget'.length, 'Value'.length, 'SOTA'.length);

    const lines = axisSpotlights.flatMap(({ label, budget, value, sota }) => ([
      ['Best Budget', budget],
      ['Value', value],
      ['SOTA', sota],
    ] as const).map(
      ([tag, model]) => `// ${label.padEnd(labelWidth)} (${tag.padEnd(tagWidth)}): ${model ? model.shortName : 'N/A'}`
    ));

    return [`// Generated ${generatedAt}`, ...lines].join('\n');
  }, [axisSpotlights]);

  // 1. Full OpenCode opencode.jsonc role mappings (build, plan, general).
  //
  // Role -> axis/pick mapping, per OpenCode's own docs (https://opencode.ai/docs/agents/,
  // https://opencode.ai/docs/config/):
  //   - build:   Coding (Value)          — Build is the primary agent that actually writes
  //              and executes code (full file/bash access); the docs' own example asks for
  //              "a more capable model for implementation," so it gets the step-up pick
  //              rather than the cheapest one.
  //   - plan:    Intelligence (Best Budget) — Plan is execution-restricted (edits/bash
  //              default to "ask"); it's reasoning/analysis, not doing. The docs' own
  //              example explicitly asks for "a faster model for planning."
  //   - general: Agentic (Best Budget)   — The General subagent ("researching complex
  //              questions and executing multi-step tasks," full tool access) is what the
  //              Agentic Index actually measures, and it can fire many times per session,
  //              so cost matters most here.
  //   - top-level model mirrors build's pick, since Build is the default primary agent
  //     any call without an override falls back to.
  //   - small_model: OpenCode docs say this wants "a cheaper model" for lightweight
  //     tasks like title generation — not coding- or agentic-specific work, so it
  //     reuses Intelligence (Best Budget), the same cheap/general-capability pick
  //     as plan, rather than inventing a fifth axis for a trivial task.
  const findAxis = (label: string) => axisSpotlights.find(s => s.label === label)!;
  const buildModel = findAxis('Coding').value;          // Coding (Value)
  const planModel = findAxis('Intelligence').budget;    // Intelligence (Best Budget)
  const generalModel = findAxis('Agentic').budget;      // Agentic (Best Budget)
  const smallModel = findAxis('Intelligence').budget;   // Intelligence (Best Budget)

  const modelRef = (m: ProcessedModel | null): string => m ? `openrouter/${cleanId(m.id)}` : 'N/A';
  const jsonStr = (s: string) => JSON.stringify(s);

  // This file is JSONC (JSON + `//` line comments), not strict JSON — see the note
  // in the panel below. Built as a template rather than JSON.stringify so each
  // model field can carry its own "why this pick" comment inline.
  const configJsonString = useMemo(() => `${configHeaderComment}
{
  "$schema": "https://opencode.ai/config.v1.json",
  "model": ${jsonStr(modelRef(buildModel))}, // mirrors build: Coding (Value)
  "small_model": ${jsonStr(modelRef(smallModel))}, // Intelligence (Best Budget): lightweight tasks (title generation, etc.)
  "agent": {
    "build": {
      "model": ${jsonStr(modelRef(buildModel))}, // Coding (Value): more capable model for implementation
      "tools": {
        "image_generate": false
      }
    },
    "plan": {
      "model": ${jsonStr(modelRef(planModel))}, // Intelligence (Best Budget): faster model for planning
      "tools": {
        "image_generate": false
      }
    },
    "general": {
      "model": ${jsonStr(modelRef(generalModel))}, // Agentic (Best Budget): cost-conscious, high-frequency subagent
      "tools": {
        "image_generate": false
      }
    }
  }
}`, [configHeaderComment, buildModel, planModel, generalModel, smallModel]);

  // 2. OpenCode Plugin JS Code (image-generation.js from ~/.config/opencode/plugin/image-generation.js)
  const pluginJsText = useMemo(() => `// Adds an \`image_generate\` tool that calls OpenRouter's server-side
// \`openrouter:image_generation\` tool (see
// https://openrouter.ai/docs/guides/features/server-tools/image-generation)
// and writes the resulting image straight to disk.
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

function collectImages(node, out = [], seen = new Set()) {
  if (node == null) return out
  if (typeof node === "string") {
    if (node.startsWith("data:image/") && !seen.has(node)) {
      seen.add(node)
      out.push({ kind: "data", value: node })
    } else if (/^https?:\\/\\/\\S+\\.(png|jpe?g|webp|gif)(\\?\\S*)?$/i.test(node) && !seen.has(node)) {
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
            return "No OpenRouter API key found. Set OPENROUTER_API_KEY, or run \`opencode auth login\` for the openrouter provider."
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
              Authorization: \`Bearer \${apiKey}\`,
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
            return \`OpenRouter request failed (HTTP \${res.status}): \${raw.slice(0, 2000)}\`
          }
          if (json?.error) {
            return \`OpenRouter error: \${JSON.stringify(json.error).slice(0, 2000)}\`
          }

          const images = collectImages(json)
          if (images.length === 0) {
            return \`No image found in the OpenRouter response. Raw response (truncated):\\n\${raw.slice(0, 3000)}\`
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
            output: \`Saved generated image to \${outPath} (\${buf.length} bytes) via \${ctx.agent} [router_model=\${body.model}, image_model=\${parameters.model || "default"}]\`,
            attachments: [
              {
                type: "file",
                mime: "image/png",
                url: \`file://\${outPath}\`,
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
export default ImageGenerationPlugin`, []);

  // Tool-calling-capable "driver" model for the sub-agent frontmatter — previously
  // reused the deprecated codingKnee pick; reports "N/A" until re-wired.
  const chatDriverModelId = "N/A";

  // 3. Sub-agent Markdown Specs
  const budgetMarkdownText = useMemo(() => `---
description: Fast & cost-effective image generation sub-agent using Best Budget Knee model
model: ${chatDriverModelId}
tools:
  image_generate: true
---

You are OpenCode's specialized Budget Image Generation sub-agent.
Your goal is to generate fast, high-quality images using the Best Budget Knee model (\`${budgetModelId}\`, ${budgetImageCost}).

When asked to generate or edit an image:
1. Construct a clear, descriptive visual prompt.
2. Call your \`image_generate\` tool with \`image_model: "${budgetModelId}"\` and specify the \`output_path\` filename (e.g. \`output.png\`).`, [budgetModelId, budgetImageCost, chatDriverModelId]);

  const sotaMarkdownText = useMemo(() => `---
description: High-fidelity SOTA image generation sub-agent using Best SOTA Knee model
model: ${chatDriverModelId}
tools:
  image_generate: true
---

You are OpenCode's specialized SOTA Image Generation sub-agent.
Your goal is to generate photorealistic, high-fidelity images using the Best SOTA Knee model (\`${sotaModelId}\`, ${sotaImageCost}).

When asked to generate high-fidelity images:
1. Construct a hyper-detailed visual prompt specifying lighting, camera angle, texture, and style.
2. Call your \`image_generate\` tool with \`image_model: "${sotaModelId}"\` and specify the \`output_path\` filename (e.g. \`output.png\`).`, [sotaModelId, sotaImageCost, chatDriverModelId]);

  const downloadFile = (filename: string, content: string, type: string = 'text/plain') => {
    const element = document.createElement("a");
    const file = new Blob([content], {type});
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const copyText = (text: string, setter: (val: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
      
      {/* Top Section: OpenCode Configuration (opencode.jsonc) */}
      <div className="glass-panel flex flex-col gap-4 rounded-2xl p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Terminal className="h-6 w-6 text-cyan-400" />
              <h2 className="text-xl font-bold text-white">OpenCode Configuration (`opencode.jsonc`)</h2>
              <span className="rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/40 px-2.5 py-0.5 text-xs font-bold">
                JSONC
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Generated as <strong className="text-violet-300">opencode.jsonc</strong> (OpenCode's JSON-with-comments format, distinct from strict <code className="text-cyan-300">opencode.json</code>) — the
              header and each model line document which axis/pick was used, per the role mapping in "How the Chart Recommends Models."
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => copyText(configJsonString, setCopiedConfig)}
              className="flex items-center gap-1.5 rounded-xl border border-cyan-500/50 bg-cyan-500/15 px-3.5 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-500/25 transition-all shadow-lg shadow-cyan-500/10"
            >
              {copiedConfig ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              <span>{copiedConfig ? 'Copied opencode.jsonc' : 'Copy opencode.jsonc'}</span>
            </button>

            <button
              onClick={() => downloadFile('opencode.jsonc', configJsonString, 'application/jsonc')}
              className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-200 hover:bg-slate-700 hover:text-white transition-colors"
            >
              <Download className="h-4 w-4 text-amber-400" />
              <span>Download opencode.jsonc</span>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <span>Place <code className="text-cyan-300 bg-slate-900 px-1.5 py-0.5 rounded">opencode.jsonc</code> in project root directory:</span>
          <span>Image generation via: <strong className="text-emerald-400">POST https://openrouter.ai/api/v1/chat/completions</strong> (<code className="text-cyan-300">openrouter:image_generation</code> tool call — see plugin below)</span>
        </div>

        <div className="relative rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-cyan-300 overflow-x-auto shadow-inner">
          <pre>{configJsonString}</pre>
        </div>
      </div>

      {/* 2. OpenCode Plugin File Downloader (image-generation.js) */}
      <div className="glass-panel flex flex-col gap-4 rounded-2xl p-4 sm:p-6 border-purple-500/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-3 gap-2">
          <div className="flex items-center gap-2">
            <Plug className="h-5 w-5 text-purple-400" />
            <h3 className="text-base font-bold text-white">OpenCode Tool Plugin (`image-generation.js`)</h3>
            <span className="rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2.5 py-0.5 text-xs font-bold">
              `generate_image` Tool
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => copyText(pluginJsText, setCopiedPlugin)}
              className="flex items-center gap-1.5 rounded-lg border border-purple-500/50 bg-purple-500/15 px-3 py-1.5 text-xs font-bold text-purple-300 hover:bg-purple-500/25 transition-all"
            >
              {copiedPlugin ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedPlugin ? 'Copied JS' : 'Copy Plugin JS'}</span>
            </button>
            <button
              onClick={() => downloadFile('image-generation.js', pluginJsText, 'text/javascript')}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700 hover:text-white transition-colors"
            >
              <Download className="h-3.5 w-3.5 text-amber-400" />
              <span>Download JS</span>
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-300">
          Save as <code className="text-purple-300 bg-slate-900 px-1.5 py-0.5 rounded font-mono">.opencode/plugin/image-generation.js</code> (workspace) or <code className="text-purple-300 bg-slate-900 px-1.5 py-0.5 rounded font-mono">~/.config/opencode/plugin/image-generation.js</code> (global).
        </p>

        <div className="relative rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-[11px] text-purple-300/90 leading-relaxed shadow-inner max-h-56 overflow-y-auto">
          <pre className="whitespace-pre">{pluginJsText}</pre>
        </div>
      </div>

      {/* 3. Sub-Agent Markdown Specs (image_budget.md & image_sota.md) */}
      <div className="glass-panel flex flex-col gap-4 rounded-2xl p-4 sm:p-6 border-pink-500/20">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-pink-400" />
            <h3 className="text-base font-bold text-white">Pareto Knee Sub-Agent Specs (`.opencode/agent/`)</h3>
            <span className="rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/40 px-2.5 py-0.5 text-xs font-bold">
              Sub-Agent Files
            </span>
          </div>
          <span className="text-xs text-slate-400 font-mono">Place in `.opencode/agent/` in workspace</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Sub-agent 1: Budget Knee */}
          <div className="flex flex-col justify-between rounded-xl border border-amber-500/40 bg-slate-900/80 p-4 gap-3">
            <div className="flex items-start justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  <Zap className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="font-bold text-amber-300 text-sm">`image_budget.md`</h4>
                  <p className="text-[10px] text-slate-400">Best Budget Knee Sub-Agent Spec</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => copyText(budgetMarkdownText, setCopiedBudgetMd)}
                  className="flex items-center gap-1 rounded-md bg-amber-500/20 border border-amber-500/40 px-2 py-1 text-[11px] font-bold text-amber-300 hover:bg-amber-500/30 transition-colors"
                >
                  {copiedBudgetMd ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedBudgetMd ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  onClick={() => downloadFile('image_budget.md', budgetMarkdownText)}
                  className="flex items-center gap-1 rounded-md bg-slate-800 border border-slate-700 px-2 py-1 text-[11px] font-bold text-slate-200 hover:bg-slate-700 transition-colors"
                >
                  <Download className="h-3 w-3 text-amber-400" />
                  <span>Download</span>
                </button>
              </div>
            </div>

            {budgetImageModel && (
              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => onSelectModelDetail?.(budgetImageModel)}
                    className="text-slate-300 font-semibold hover:text-amber-300 hover:underline transition-colors text-left"
                  >
                    {budgetImageModel.name}
                  </button>
                  <span className="text-amber-400 font-bold">
                    {budgetImageModel.t2iLeaderboardElo !== null ? `${budgetImageModel.t2iLeaderboardElo} ELO` : 'ELO: N/A'}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-slate-400">{budgetImageModel.id}</div>
              </div>
            )}

            <div className="rounded-lg border border-slate-800 bg-slate-950 p-2.5 font-mono text-[10px] text-amber-300/90 leading-relaxed shadow-inner max-h-40 overflow-y-auto">
              <pre className="whitespace-pre-wrap">{budgetMarkdownText}</pre>
            </div>
          </div>

          {/* Sub-agent 2: SOTA Knee */}
          <div className="flex flex-col justify-between rounded-xl border border-cyan-500/40 bg-slate-900/80 p-4 gap-3">
            <div className="flex items-start justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                  <Trophy className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="font-bold text-cyan-300 text-sm">`image_sota.md`</h4>
                  <p className="text-[10px] text-slate-400">Best SOTA Knee Sub-Agent Spec</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => copyText(sotaMarkdownText, setCopiedSotaMd)}
                  className="flex items-center gap-1 rounded-md bg-cyan-500/20 border border-cyan-500/40 px-2 py-1 text-[11px] font-bold text-cyan-300 hover:bg-cyan-500/30 transition-colors"
                >
                  {copiedSotaMd ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedSotaMd ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  onClick={() => downloadFile('image_sota.md', sotaMarkdownText)}
                  className="flex items-center gap-1 rounded-md bg-slate-800 border border-slate-700 px-2 py-1 text-[11px] font-bold text-slate-200 hover:bg-slate-700 transition-colors"
                >
                  <Download className="h-3 w-3 text-cyan-400" />
                  <span>Download</span>
                </button>
              </div>
            </div>

            {sotaImageModel && (
              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => onSelectModelDetail?.(sotaImageModel)}
                    className="text-slate-300 font-semibold hover:text-cyan-300 hover:underline transition-colors text-left"
                  >
                    {sotaImageModel.name}
                  </button>
                  <span className="text-cyan-400 font-bold">
                    {sotaImageModel.t2iLeaderboardElo !== null ? `${sotaImageModel.t2iLeaderboardElo} ELO` : 'ELO: N/A'}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-slate-400">{sotaImageModel.id}</div>
              </div>
            )}

            <div className="rounded-lg border border-slate-800 bg-slate-950 p-2.5 font-mono text-[10px] text-cyan-300/90 leading-relaxed shadow-inner max-h-40 overflow-y-auto">
              <pre className="whitespace-pre-wrap">{sotaMarkdownText}</pre>
            </div>
          </div>

        </div>
      </div>

      {/* 4. Installation & Usage Instructions */}
      <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-4 text-xs space-y-2">
        <div className="font-bold text-cyan-300 flex items-center gap-1.5">
          <Terminal className="h-4 w-4 text-cyan-400" />
          <span>How to install files in your project workspace:</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-slate-300 font-mono text-[11px] pt-1">
          <div className="bg-slate-900/90 border border-slate-800 p-2.5 rounded-lg space-y-1">
            <div className="text-amber-400 font-sans font-bold">1. Create Folder Structure:</div>
            <div className="text-cyan-300">mkdir -p .opencode/plugin .opencode/agent</div>
            <div className="text-slate-400"># Put image-generation.js in .opencode/plugin/</div>
            <div className="text-slate-400"># Put image_budget.md & image_sota.md in .opencode/agent/</div>
          </div>
          <div className="bg-slate-900/90 border border-slate-800 p-2.5 rounded-lg space-y-1">
            <div className="text-amber-400 font-sans font-bold">2. Trigger Sub-Agents in OpenCode:</div>
            <div className="text-cyan-300">opencode</div>
            <div className="text-emerald-400 font-sans italic pt-0.5">&gt; @image_budget Generate a glowing futuristic cityscape</div>
            <div className="text-cyan-400 font-sans italic">&gt; @image_sota Render an 8k photorealistic logo</div>
          </div>
        </div>
      </div>

    </div>
  );
};
