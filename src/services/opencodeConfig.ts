import type { ProcessedModel, AxisMetricKey } from '../types/openrouter';
import { calculateParetoFrontier, findMarginalGainWinners, findValueRecoveryModel } from './modelService';

// Blended $/1M from which a model counts as premium: recommended ones get the
// [$$$] tier, off-frontier ones are hidden from the picker. An absolute price,
// not a multiple of the default model's cost — that multiple moves whenever the
// default's price does, and models flipped tier between two runs on the same day.
const PREMIUM_FROM_COST = 5;

// Budget Knee, Value Recovery and SOTA for one task axis, computed with the same
// formulas the scatter plot uses (Pareto frontier + findMarginalGainWinners +
// findValueRecoveryModel). SOTA is the last frontier point: the frontier is
// sorted by cost and its score never decreases, so that is the best score at
// any price.
export interface AxisSpotlight {
  label: string;
  budget: ProcessedModel | null;
  value: ProcessedModel | null;
  sota: ProcessedModel | null;
  pareto: ProcessedModel[];
}

export function computeAxisSpotlights(models: ProcessedModel[]): AxisSpotlight[] {
  const spotlightFor = (label: string, dataset: ProcessedModel[], yKey: AxisMetricKey): AxisSpotlight => {
    const pareto = calculateParetoFrontier(dataset, 'blendedCostPerM', yKey);
    const { budgetKnee } = findMarginalGainWinners(pareto, 'blendedCostPerM', yKey, true, false);
    const value = findValueRecoveryModel(pareto, 'blendedCostPerM', yKey, true, false, budgetKnee);
    const sota = pareto.length > 0 ? pareto[pareto.length - 1] : null;
    return { label, budget: budgetKnee, value, sota, pareto };
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
}

export const cleanModelId = (id?: string) => id ? id.replace(':batch', '').replace(/^openrouter\//, '') : '';

// OpenCode config in OpenCode 2.0's native format (verified against 2.0.32 —
// see AGENTS.md §4). JSONC: OpenCode accepts comments in the file.
//
// Role -> axis/pick mapping. Nothing expensive runs unless the user opts in,
// and the cost of opting in is visible:
//   - build:         Coding (Best Budget). The default primary agent; plan ⇄
//                    build Tab-switching must never touch an expensive model.
//   - plan:          Intelligence (Best Budget). The docs ask for "a faster
//                    model for planning".
//   - build-premium: Coding (Value), an opt-in primary in the Tab cycle, with
//                    its cost in its description, a red colour and a step cap.
//                    Omitted when Coding has no Value Recovery pick.
//   - general:       Agentic (Best Budget). Multi-step tool work, fires often.
//   - explore:       Agentic (Best Budget). Built-in explore has no model of its
//                    own and would otherwise inherit an expensive caller's.
//   - title:         Intelligence (Best Budget). v1's small_model.
//   - /deep command: Intelligence (Value), one question escalated as a
//                    subagent while the session stays cheap. Omitted when
//                    Intelligence has no Value Recovery pick.
//   - top-level model mirrors build.
export function buildOpenCodeConfig(
  models: ProcessedModel[],
  spotlights: AxisSpotlight[],
  generatedAt: string = new Date().toISOString()
): string {
  const findAxis = (label: string) => spotlights.find(s => s.label === label)!;
  const codingAxis = findAxis('Coding');
  const intelligenceAxis = findAxis('Intelligence');
  const agenticAxis = findAxis('Agentic');
  const imageAxis = findAxis('Text-to-Image');
  const textAxes = [intelligenceAxis, codingAxis, agenticAxis];

  const buildModel = codingAxis.budget;
  const planModel = intelligenceAxis.budget;
  const premiumModel = codingAxis.value && codingAxis.value.id !== buildModel?.id ? codingAxis.value : null;
  const generalModel = agenticAxis.budget;
  const titleModel = intelligenceAxis.budget;
  const deepModel = intelligenceAxis.value;
  const imageModel = imageAxis.budget ?? imageAxis.sota;

  const jsonStr = (s: string) => JSON.stringify(s);
  const modelRef = (m: ProcessedModel | null) => m ? `openrouter/${cleanModelId(m.id)}` : 'N/A';
  const refCost = buildModel?.blendedCostPerM ?? 0;
  const multiple = (m: ProcessedModel) => refCost > 0 ? m.blendedCostPerM / refCost : 0;
  const fmtMultiple = (x: number) => x < 10 ? x.toFixed(1).replace(/\.0$/, '') : Math.round(x).toString();
  const fmtCost = (m: ProcessedModel) => `$${m.blendedCostPerM.toFixed(2)}/M`;
  const displayName = (m: ProcessedModel) => m.shortName.replace(/^[^:]+:\s*/, '');

  // Picker labels. Recommended = on any text axis' Pareto frontier, at or above
  // the cheapest Budget Knee (cheaper frontier models are worse value than the
  // knee). Tiers: [✔] a Budget Knee · [$$$] ≥ PREMIUM_FROM_COST · [$$] the rest.
  const knees = new Set(textAxes.map(a => a.budget?.id).filter(Boolean));
  const kneeFloor = Math.min(...textAxes.map(a => a.budget?.blendedCostPerM ?? Infinity));
  const frontierIds = new Set(textAxes.flatMap(a => a.pareto.map(m => m.id)));
  const recommended = new Map<string, ProcessedModel>();
  textAxes.flatMap(a => a.pareto)
    .filter(m => m.blendedCostPerM >= kneeFloor)
    .forEach(m => recommended.set(m.id, m));
  const valueRoles = new Map<string, string[]>();
  textAxes.forEach(a => {
    if (a.value) valueRoles.set(a.value.id, [...(valueRoles.get(a.value.id) ?? []), `${a.label} value pick`]);
  });

  const tierFor = (m: ProcessedModel) =>
    knees.has(m.id) ? '[✔]' : m.blendedCostPerM >= PREMIUM_FROM_COST ? '[$$$]' : '[$$]';
  const labelFor = (m: ProcessedModel) => [
    `${tierFor(m)} ${displayName(m)}`,
    fmtCost(m),
    m.id === buildModel?.id ? 'default' : `×${fmtMultiple(multiple(m))}`,
    ...(valueRoles.get(m.id) ?? []),
  ].join(' · ');

  // Hidden: expensive models with benchmark scores that sit on no text axis'
  // frontier — a cheaper model is at least as good on every axis.
  const hidden = models
    .filter(m => !m.id.endsWith(':batch') && m.blendedCostPerM >= PREMIUM_FROM_COST)
    .filter(m => m.intelligenceIndex !== null || m.codingIndex !== null || m.agenticIndex !== null)
    .filter(m => !frontierIds.has(m.id))
    .sort((a, b) => b.blendedCostPerM - a.blendedCostPerM);

  const sortedRecommended = [...recommended.values()].sort((a, b) => a.blendedCostPerM - b.blendedCostPerM);
  const keyWidth = Math.max(0, ...[...sortedRecommended, ...hidden].map(m => jsonStr(m.id).length + 1));
  const entries = [
    ...sortedRecommended.map(m => ({ m, body: `{ "name": ${jsonStr(labelFor(m))} }`, comment: '' })),
    ...hidden.map(m => ({ m, body: '{ "disabled": true }', comment: ` // ${fmtCost(m)}` })),
  ];
  const lines = entries.map(({ m, body, comment }, i) =>
    `        ${`${jsonStr(m.id)}:`.padEnd(keyWidth)} ${body}${i < entries.length - 1 ? ',' : ''}${comment}`
  );
  const modelEntries = [
    '        // Recommended picks, labelled with their cost impact.',
    ...lines.slice(0, sortedRecommended.length),
    ...(hidden.length ? [
      `        // Hidden: $${PREMIUM_FROM_COST}+/M models on no axis' Pareto frontier — a cheaper`,
      '        // model scores at least as well on Intelligence, Coding and Agentic alike.',
      ...lines.slice(sortedRecommended.length),
    ] : []),
  ].join('\n');

  // image_generate (from the generated plugin) asks before every paid image.
  // The token deny comes after "shell *: allow" because the last match wins:
  // without it an agent can read the token and curl the paid API itself,
  // bypassing that ask — observed on 2026-10-19.
  const guardRules = [
    '{ "action": "image_generate", "resource": "*", "effect": "ask" }',
    '{ "action": "shell", "resource": "*", "effect": "allow" }',
    '{ "action": "shell", "resource": "*openrouter-token*", "effect": "deny" }',
    '{ "action": "shell", "resource": "git push*", "effect": "ask" }',
    '{ "action": "shell", "resource": "git reset --hard*", "effect": "ask" }',
    '{ "action": "shell", "resource": "rm -rf*", "effect": "ask" }',
  ].map(r => `        ${r}`).join(',\n');

  const premiumAgent = premiumModel ? `

    // Opt-in premium primary: in the Tab cycle, but its description and colour
    // say what it costs. "steps" caps agentic iterations per turn.
    "build-premium": {
      "mode": "primary",
      "model": ${jsonStr(modelRef(premiumModel))}, // Coding (Value)
      "description": ${jsonStr(`${tierFor(premiumModel)} ×${fmtMultiple(multiple(premiumModel))} cost vs. build (${fmtCost(premiumModel)}). Coding value pick — use only for work build has failed at.`)},
      "color": "#ef4444",
      "steps": 25,
      "permissions": [
${guardRules}
      ]
    },` : '';

  const commands: string[] = [];
  if (deepModel) commands.push(`    // "/deep <question>" runs one question on the Intelligence value pick as a
    // subagent, then returns to the cheap session model.
    "deep": {
      "description": ${jsonStr(`${tierFor(deepModel)} ×${fmtMultiple(multiple(deepModel))} cost — ask one hard question to ${displayName(deepModel)} (${fmtCost(deepModel)})`)},
      "model": ${jsonStr(modelRef(deepModel))},
      "subagent": true,
      "template": "Think carefully and answer precisely: $ARGUMENTS"
    }`);
  if (imageModel) commands.push(`    // "/image [budget|best] <description> [→ path]" generates one image with the
    // image_generate plugin tool; OpenCode still asks before the paid call.
    "image": {
      "description": ${jsonStr(`Generate an image (budget: ${displayName(imageModel)}; best: ${imageAxis.sota ? displayName(imageAxis.sota) : 'n/a'})`)},
      "agent": "build",
      "template": ${jsonStr("Generate one image with the image_generate tool. Request: $ARGUMENTS\nIf the request starts with 'budget' or 'best', use that as the tier, otherwise use 'budget'. Use the output path if one is given, otherwise pick a sensible one under the project. Report the saved path and cost.")}
    }`);
  const commandsBlock = commands.length ? `

  "commands": {
${commands.join(',\n\n')}
  },` : '';

  const labelWidth = Math.max(...spotlights.map(s => s.label.length));
  const tagWidth = 'Best Budget'.length;
  const pickLines = spotlights.flatMap(({ label, budget, value, sota }) => ([
    ['Best Budget', budget],
    ['Value', value],
    ['SOTA', sota],
  ] as const).map(
    ([tag, model]) => `// ${label.padEnd(labelWidth)} (${tag.padEnd(tagWidth)}): ${model ? model.shortName : 'N/A'}`
  ));

  return `// Generated ${generatedAt} by OpenRouter Model Chooser
${pickLines.join('\n')}
//
// .opencode/opencode.jsonc — OpenCode 2.0 native config. Prices are blended $/1M tokens ((3×input + output) / 4);
// "×N" is the cost multiple vs. the default model. Regenerate: picks drift with
// live pricing. No "$schema": https://opencode.ai/config.json is the v1 schema.
{
  "model": ${jsonStr(modelRef(buildModel))}, // mirrors build: Coding (Best Budget)
  "default_agent": "build",

  // Only OpenRouter may be used.
  "policies": [
    { "action": "provider.use", "resource": "*", "effect": "deny" },
    { "action": "provider.use", "resource": "openrouter", "effect": "allow" }
  ],

  // "name" is what the /model picker shows; "disabled": true hides a model.
  // v2 has no allowlist — models not listed here stay visible, unlabelled.
  "providers": {
    "openrouter": {
      // Token from .openrouter-token in the project root. {file:} resolves from
      // this file's directory (.opencode/), hence "../". A missing file just
      // leaves the key empty.
      "settings": { "apiKey": "{file:../.openrouter-token}" },
      "models": {
${modelEntries}
      }
    }
  },

  // Ordered rules, the last match wins. image_generate is denied by default and
  // set to "ask" on build and build-premium (see guardRules). Agents may not
  // read the token: OpenCode and the plugin read it themselves.
  "permissions": [
    { "action": "image_generate", "resource": "*", "effect": "deny" },
    { "action": "read", "resource": "*openrouter-token*", "effect": "deny" },
    { "action": "edit", "resource": "*openrouter-token*", "effect": "deny" },
    { "action": "edit", "resource": "*.lock", "effect": "deny" },
    { "action": "edit", "resource": "package-lock.json", "effect": "deny" }
  ],

  "agents": {
    "build": {
      "model": ${jsonStr(modelRef(buildModel))}, // Coding (Best Budget)
      "permissions": [
${guardRules}
      ]
    },
    "plan": {
      "model": ${jsonStr(modelRef(planModel))} // Intelligence (Best Budget)
    },${premiumAgent}

    // Pinned so they never inherit an expensive caller's model.
    "general": { "model": ${jsonStr(modelRef(generalModel))} }, // Agentic (Best Budget)
    "explore": { "model": ${jsonStr(modelRef(generalModel))} }, // Agentic (Best Budget)
    "title":   { "model": ${jsonStr(modelRef(titleModel))} }  // Intelligence (Best Budget); v1's small_model
  },${commandsBlock}

  "compaction": { "auto": true }
}
`;
}

// OpenCode 2.0 plugin adding an `image_generate` tool. It calls OpenRouter's
// Image API directly (POST /api/v1/images): one billed model per image, unlike
// the earlier openrouter:image_generation server tool, which also billed a chat
// model to trigger it. The two tiers are baked in from the Text-to-Image picks
// at generation time. The token is read from .openrouter-token in the project
// root — the same file the generated config hands OpenCode itself.
// Generated as .opencode/plugins/image-generation.js, next to .opencode/opencode.jsonc.
//
// 2.0 plugin format (verified on 2.0.32): a default-exported { id, setup }
// object; tools are added through ctx.tool.transform with JSON Schema input.
// No imports, so nothing to install — the 1.x format's @opencode-ai/plugin
// import fails to resolve on 2.0, and 2.0 rejects 1.x-style exports anyway.
export function buildImagePlugin(budgetModelId: string, bestModelId: string): string {
  return `// Generated by OpenRouter Model Chooser. Adds the \`image_generate\` tool
// (OpenCode 2.0 plugin format — no dependencies). OpenCode loads it from
// <project>/.opencode/plugins/ or, user-wide, ~/.config/opencode/plugins/.
import fs from "node:fs/promises"
import path from "node:path"

const MODELS = {
  budget: ${JSON.stringify(budgetModelId)}, // Text-to-Image Budget Knee
  best: ${JSON.stringify(bestModelId)}, // Text-to-Image SOTA
}

// Project root first; then the config directory this file sits in
// (<project>/.opencode or ~/.config/opencode for a user-wide install); then
// two levels up, the project root when it lives in <project>/.opencode/plugins/.
async function readToken(root) {
  const here = import.meta.dirname
  for (const dir of [root, path.join(here, ".."), path.join(here, "..", "..")]) {
    try {
      const token = (await fs.readFile(path.join(dir, ".openrouter-token"), "utf8")).trim()
      if (token) return token
    } catch {}
  }
  return process.env.OPENROUTER_API_KEY || null
}

export default {
  id: "openrouter-model-chooser.image-generation",
  async setup(ctx) {
    const root = ctx.location.project?.directory ?? ctx.location.directory
    await ctx.tool.transform((editor) => {
      editor.add({
        name: "image_generate",
        description:
          "Generate an image from a text prompt and save it to a file. Costs money per image. " +
          "Use tier 'budget' unless the user asks for the highest quality.",
        input: {
          type: "object",
          properties: {
            prompt: { type: "string", description: "Detailed description of the image" },
            output_path: { type: "string", description: "Where to save it, relative to the project root" },
            tier: { type: "string", enum: ["budget", "best"], description: \`budget: \${MODELS.budget} (default), best: \${MODELS.best}\` },
            aspect_ratio: { type: "string", description: "e.g. 1:1, 16:9, 3:2" },
          },
          required: ["prompt", "output_path"],
          additionalProperties: false,
        },
        async execute(input, context) {
          const token = await readToken(root)
          if (!token) return { content: "No OpenRouter token: put it in .openrouter-token in the project root, or set OPENROUTER_API_KEY." }

          const model = MODELS[input.tier ?? "budget"]
          const res = await fetch("https://openrouter.ai/api/v1/images", {
            method: "POST",
            signal: context.signal,
            headers: { Authorization: \`Bearer \${token}\`, "Content-Type": "application/json" },
            body: JSON.stringify({ model, prompt: input.prompt, ...(input.aspect_ratio ? { aspect_ratio: input.aspect_ratio } : {}) }),
          })
          const json = await res.json().catch(() => null)
          if (!res.ok) return { content: \`OpenRouter Image API error (HTTP \${res.status}): \${JSON.stringify(json?.error ?? json).slice(0, 1000)}\` }

          const image = json?.data?.[0]
          if (!image?.b64_json) return { content: \`No image in the response: \${JSON.stringify(json).slice(0, 1000)}\` }

          const outPath = path.resolve(root, input.output_path)
          await fs.mkdir(path.dirname(outPath), { recursive: true })
          const bytes = Buffer.from(image.b64_json, "base64")
          await fs.writeFile(outPath, bytes)

          const cost = typeof json.usage?.cost === "number" ? \` · cost $\${json.usage.cost.toFixed(4)}\` : ""
          return { content: \`Saved \${outPath} (\${image.media_type ?? "image"}, \${bytes.length} bytes) · model \${model}\${cost}\` }
        },
      })
    })
  },
}
`;
}
