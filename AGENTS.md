# AGENTS.md

Working notes for this repo. Last substantive session: **2026-10-19**.

---

## 1. What this project is

**OpenRouter Model Chooser** — a React 19 + TypeScript + Vite SPA that plots OpenRouter's ~450 models
on a cost-vs-capability matrix, identifies good-value picks mathematically, and generates OpenCode
configuration from those picks.

```bash
npm run dev      # vite dev server
npm run build    # tsc -b && vite build
npx oxlint       # lint
```

Data: `src/data/snapshot.json` (bundled fallback) is replaced at runtime by a live fetch from
`https://openrouter.ai/api/v1/models`. **Live picks drift** — a model that wins today may not next
week. That is why config is generated, not hand-written.

Four tabs: **2D Matrix** (scatter plot) · **OpenCode Config** (generator) · **Catalog Table** ·
**Methodology** (`MethodologyView.tsx` — documents every formula below, with references).

---

## 2. The recommendation formulas — and why they look like that

All live in `src/services/modelService.ts`. **X axis is always Blended Cost**
(`(3×prompt + completion) / 4`), log-scaled. Y is any capability metric.

| Pick | How it is computed |
|---|---|
| **Pareto frontier** | Standard dominance: nothing is both cheaper-or-equal and better-or-equal. |
| **Best Budget Knee** | Kneedle (Satopaa et al. 2011) on a budget window: `max($2.50, 10× cheapest)`. |
| **Value Recovery** | See below — the hard one. |
| **SOTA** | Simply the **last point on the Pareto frontier** (highest score at any price). |

### Value Recovery — three iterations, keep the history

The problem: find a *meaningfully better* alternative above the Budget Knee without landing on the
most expensive flagship.

1. **Rejected — "Best Step-Up" (fixed price ceiling).** Capped candidates at `5× Budget Knee` +
   required a significance threshold. **Failed against live data**: real pricing has a cliff
   (budget cluster $0.03–$0.12, then nothing until $2+). A 5× ceiling on a $0.12 knee caps at $0.60
   and matches nothing. *A fixed multiplier tuned on one dataset does not survive a lumpy market.*
2. **Local slope, ranked by ratio.** Compute marginal rate `Δscore / Δlog₁₀(cost)` between adjacent
   frontier points; find a dip-then-rebound. **Bug:** ranking by `rebound/dip` ratio rewarded
   *escaping a terrible dip* over *being a good deal* — on the Agentic axis it picked Fable 5.1
   (rebound 6.0 from a 0.19 dip = 31×) over Qwen 3.8 Max (18.7 from 1.9 = 9.6×), even though Qwen's
   segment was objectively the best on the frontier.
3. **Current — ranked by absolute rate, discounted by boundary distance.** Still requires
   `ratio > 1.3` to qualify as a real rebound, but ranks by absolute slope × a weight that fades
   toward the edges of the price range:

```
boundaryDistance = min(dist to cheapest, dist to priciest) / (half the log-cost range)
weight           = 0.15 + 0.85 × boundaryDistance      # floor so it handicaps, never disqualifies
score            = reboundSlope × weight
```

**Why the boundary weight exists.** Without it the formula kept picking the single most expensive
model. The user raised the decoy/compromise effect (Huber-Payne-Puto 1982; Simonson 1989) — top-tier
SKUs are often priced as anchors, not value propositions. We could not prove intent from price data,
so we did **not** hard-exclude the priciest model (too speculative; breaks thin frontiers like
Text-to-Image). Instead we used a purely statistical justification: **edge estimates are less
reliable because they have support on only one side** (boundary bias in local regression — Cleveland
1979; Fan & Gijbels 1996). The `0.15` floor exists so a 3-point frontier can still fire.

**Do not "simplify" this back to a ratio ranking or a fixed ceiling — both were tried and failed
against live data.**

4. **Significance gate (2026-10-19).** Slope over a tiny price gap inflates noise: Coding picked
   Opus 5 off a +0.6-pt step ($8→$10). Now the rebound step must also gain
   `≥ 25%` of `score(frontier max) − score(Budget Knee)` (`VALUE_RECOVERY_MIN_STEP_SHARE`).
   Scale-free, but 25% is a judgement call tuned on one day's data. Effect that day:
   Intelligence → Sonnet 5.5 (unchanged, MiMo near-tie removed); Coding → **Fable 5.1** (priciest —
   the gate removed its only rival, so the boundary weight had nothing to rank against);
   Agentic → none. "No pick" is legitimate; the generator then falls back to Coding Budget for
   `build`. The matrix badge shows the pick's gain vs. the knee (`computePickGain`: Δpts, ×cost,
   pts per cost doubling).

### Rejected: concave hull / "supported solutions"

The MOO literature's supported-vs-non-supported efficient solutions (Steuer 1986; Branke et al. 2004)
assumes you can *blend* two options to reach an intermediate. You cannot mix two models to
approximate a third, so it over-corrects to "just buy the most expensive one." Local slope is the
right level of analysis for a discrete one-shot choice.

---

## 3. OpenCode config generation

Builder: `src/services/opencodeConfig.ts` (`computeAxisSpotlights`, `buildOpenCodeConfig`, pure
functions — testable with `npx tsx`). UI: `src/components/OpenCodeConfigView.tsx`. Emits **OpenCode
2.0 native format**, JSONC. **Layout (2026-10-19): everything generated lives in the project's
`.opencode/`** — `.opencode/opencode.jsonc` (config) and `.opencode/plugins/image-generation.js`
(plugin). OpenCode 2.0 reads both from there with no symlink and no `plugins` entry (verified: config
source `…/.opencode/opencode.jsonc`, plugin loads). This repo uses that layout for testing — **no
root `opencode.json(c)`**, which would be a second config. Earlier layouts, both abandoned: a root
`opencode.jsonc` symlink to `generated/opencode-generated.jsonc`; and a `plugins` config entry
(must name a *directory*, not a file — "configured plugin path must be a directory"). The config
preview is collapsed by default.

**OpenCode tab (2026-10-19 cleanup):** one section. Actions: **Write on disk** (main way) and
**Download config (.zip)** — `.opencode/opencode.jsonc`, `.opencode/plugins/image-generation.js` and
`setup-user-config` (executable), built by `src/services/zip.ts` (stored, no dependency). No copy
button (doesn't work for several files), no plugin section. Text covers: defaults, the `[✔]`/`[$$]`/
`[$$$]` names, where files go per project vs. user-wide. Collapsible `opencode.jsonc` preview.

**`scripts/setup-user-config [SOURCE_DIR=./.opencode]`** (also `make install`, which passes `OPENCODE_DIR`) installs user-wide: merges
`SOURCE_DIR/opencode.jsonc` into `~/.config/opencode/opencode.jsonc` (or existing `opencode.json`;
honours `XDG_CONFIG_HOME`, `OPENCODE_CONFIG_DIR` for tests) and copies the plugin to
`~/.config/opencode/plugins/`. POSIX sh + embedded `python3`. Every added line ends in `// @ormc`; a
re-run first strips those lines, then merges again. Merge rules: objects deep-merged, the user's keys
kept; arrays = user items + generated items not already present; on a scalar conflict the generated
value wins and the user's old value is kept as `// @ormc was=<json>`, restored on the next strip.
Rewrites `apiKey` to `{file:<config dir>/.openrouter-token}` (`~/` form under `$HOME`). Tested:
idempotent re-run, strip-tags == original user config, re-merge after changed picks, OpenCode parses
the result (user's own agent + generated agents present), unique timestamped backups. **Limitation:**
the user's own comments are not preserved (structural merge) — the backup keeps them. The bundled
copy in the UI comes from the same file (`?raw` import).

**"Write on disk"** POSTs `{ files: { "opencode.jsonc", "plugins/image-generation.js" } }` to
`/__opencode/write-config`, handled by `server/writeConfig.ts`: output directory fixed server-side
(default `.opencode/`, `OPENCODE_DIR_OUT` overrides), only those two names accepted (`../` etc.
rejected); symlinks resolved; temp file + rename, direct write if the target is a bind-mounted single
file; 1 MB cap. Two hosts for it: the Vite dev server (`vite.config.ts`) and
the container's `server/server.ts`. The UI probes `GET` on load and only shows the button if it
answers — so it is hidden on plain static hosting.

**Container** (`Dockerfile`, `make container` / `make run`): `node:24-alpine` running
`server/server.ts` directly (Node type stripping, no npm deps) — serves `dist/` + the endpoint on
:8080. Replaced nginx for that reason (~50 MB vs ~20 MB). `make run` mounts `OPENCODE_DIR`
(default `./.opencode`; point it at another project's `.opencode/`) on `/app/.opencode:Z` and passes
`OPENCODE_DIR_HOST` (display only: the UI shows host paths, not `/app/…`), with `--userns=keep-id` on podman / `--user uid:gid`
on docker so files are host-owned. Verified 2026-10-19 with rootless podman: written file uid 1000,
traversal (`/../../etc/passwd`) returns `index.html`, SIGTERM handled (stop in 0.2 s).

**Principle (2026-10-19): defaults are all Budget Knee picks; anything pricier is opt-in and
labelled.** Value picks cost ×50–×250 the knee — worth it for a rare hard question, waste for an
agent's constant background calls.

| Entry | Axis / pick | Reasoning |
|---|---|---|
| `agents.build`, top-level `model` | Coding (**Budget**) | Default primary; plan ⇄ build switching must stay cheap. |
| `agents.plan` | Intelligence (**Budget**) | Docs: "a faster model for planning". |
| `agents.build-premium` | Coding (**Value**) | Opt-in primary: red, cost in description, `steps: 25`. Omitted if no pick. |
| `agents.general`, `agents.explore` | Agentic (**Budget**) | Frequent tool work; pinning `explore` stops it inheriting an expensive caller's model. |
| `agents.title` | Intelligence (**Budget**) | v1's `small_model`. |
| `commands.deep` | Intelligence (**Value**) | `/deep <q>`: one question as a subagent. Omitted if no pick. |
| `commands.image` | Text-to-Image (Budget / SOTA) | `/image [budget\|best] <desc> [→ path]`, runs on `build`. |
| `providers.openrouter.settings.apiKey` | — | `"{file:../.openrouter-token}"` — `{file:}` resolves from the config file's directory (`.opencode/`), so `../` = project root; verified, also when OpenCode starts in a subdirectory. Missing file → empty key, config still loads. The plugin reads the same file (project root, then two levels above itself). |

**Image generation (2026-10-19 rewrite).** `buildImagePlugin` emits `.opencode/plugins/image-generation.js`,
adding an `image_generate` tool that calls OpenRouter's **Image API** (`POST /api/v1/images` →
`data[].b64_json`, `usage.cost`) — **one** billed model per image. Replaced the
`openrouter:image_generation` server tool, which billed a hard-coded chat model (`openai/gpt-5.2`) on
top, plus the sub-agent's own model: three billed models per image. The `image_budget`/`image_sota`
sub-agents are **gone** (they were also broken: `model: N/A`). Tool args `tier: budget|best`, baked in
from the T2I Budget Knee / SOTA. Token: `.openrouter-token` in the project root (git-ignored), else
`OPENROUTER_API_KEY` — v2 keeps `opencode auth` credentials in `opencode.db`, not `auth.json`.
Permissions: global `image_generate: deny`, `ask` on `build`/`build-premium` — so build may decide to
generate an image itself, but each paid call needs the user's click (user's choice).

**OpenCode 2.0 plugin format — verified 2026-10-19 via `~/.local/share/opencode/log/opencode.log`.**
The first generated plugin used the 1.x format and **never loaded** on 2.0: first
`Cannot find package '@opencode-ai/plugin'` (2.0 no longer auto-installs it; latest npm version is
1.19.3), and with it resolved, `Plugin must export a default definition with an id and an effect or
setup function`. The generator now emits the 2.0 format: `export default { id, async setup(ctx) }`,
tool added via `await ctx.tool.transform(editor => editor.add({ name, description, input: <JSON
Schema>, execute(input, context) }))`, returning `{ content: string }`; project root from
`ctx.location.project.directory`; `context.signal` for fetch. **No imports → nothing to install.**
Load success: log shows `loading plugin` with no `failed to load plugin`, and the tool appears in the
editor's tool list next to `read`/`shell`. Docs: `https://opencode.ai/v2/docs/build/plugins/` (v1
docs at `/docs/plugins/` describe the old format). `plugin.list` / `opencode plugin list` show only
npm-package plugins — "No plugins found" even when a local one loads.

**Cost bypass found (2026-10-19).** The user's "image generation works" was **not** the plugin
(which wasn't installed): build improvised `TOKEN=$(cat .openrouter-token) && curl … /api/v1/images`
through `shell: allow`, skipping the `ask`. Fix: agents may not touch the token —
`read`/`edit` `*openrouter-token*` deny globally, and `shell *openrouter-token*` deny placed **after**
`shell *: allow` in build's rules (last match wins). Rules resolve as intended in `debug agents`;
enforcement at call time not yet observed. A model could still find other routes — the permission
`ask` is a guard against the honest path, not a sandbox.

**Picker labels** (`providers.openrouter.models.<id>.name`). Recommended = on any text axis' frontier
and priced ≥ the cheapest Budget Knee. `[✔]` a Budget Knee · `[$$$]` blended ≥ **$5/M** · `[$$]` the
rest. Label: `tier · name · $/M · ×cost-vs-default · value-pick role`. **Hidden** (`disabled: true`):
blended ≥ $5/M, has a benchmark score, on no text axis' frontier. The `$5/M` line is absolute on
purpose — "×100 the default" flipped two $8 models between tiers when the default's price moved
$0.079 → $0.086 within one day. Symbols were the user's choice (`⚠` was rejected as unclear).

Both the 2D Matrix and this generator **must use the same dataset filter** — they diverged once and
produced different answers for Text-to-Image. The 2D Matrix is the reference:
`!id.endsWith(':batch') && blendedCostPerM > 0` plus the metric-presence check. No ELO floors, no id
exclusions. **Text-to-Image is restricted at the data layer** (`restrictToImageApi` in
`modelService.ts`), so both views get it: only models served by `GET /api/v1/images/models` keep a T2I
score; hand-added `EXTRA_IMAGE_MODELS` it doesn't serve are dropped (11 of 18 on 2026-10-19 — SDXL,
Midjourney, DALL-E 3, several FLUX ids). Bundled fallback: `src/data/imageApiModels.json`. Image API
prices are per image *or* per token, so its models are not added to the cost axis.

---

## 4. OpenCode facts — empirically verified, do not re-derive

### OpenCode 2.0.32 (installed 2026-10-19) — current

Verified with `opencode debug config`, `opencode debug agents`, `opencode models`, and
`opencode api --standalone model.list` (JSON incl. display names), against the schema in
`https://opencode.ai/v2/openapi.json` (`Config.InfoEncoded`).

- **v1 configs still load** — OpenCode translates them; `opencode debug config` shows the result.
  But **`whitelist`/`blacklist` are silently dropped**. v2 has **no model allowlist**: unlisted
  models stay in `/model`. Per-model `"disabled": true` is the only way to hide one.
- **Key renames:** `provider` → `providers`, `agent` → `agents`, `small_model` → `agents.title.model`,
  `enabled_providers` → `policies: [{action: "provider.use", resource, effect}]`.
  Policy actions are only `provider.use`, `tool.use`, `integration.use` — nothing model-level.
- **Permissions are ordered rule lists**, `{action, resource, effect}`; last match wins (a global deny
  followed by an agent's allow → allowed). Renamed actions: `bash` → `shell`, `task` → `subagent`.
  v1 `tools: {x: false}` and markdown frontmatter `permission:` maps still translate.
- **Per-model `name` overrides the picker label** — verified in `model.list`, not on the TUI screen.
- **Agents gained** `color`, `steps` (iteration cap), `hidden`, `disabled`.
- **Comments work in `.json` too.** No v2 schema URL is published (`config.json` is v1; `v2/config.json`
  404s) — so emit no `$schema`.
- **`opencode debug config` / `debug agents` go through the background service and can show the
  previous file contents** on the first run after an edit. Run twice, or use
  `opencode api --standalone …`. A running TUI needs `opencode service restart` to see changes.
- **`command.list` returns `[]` for every command** (config and `.opencode/commands/*.md`) — so
  `/deep` is unverified via API; check it in the TUI.
- **Credentials:** `opencode auth login` (stored in `~/.local/share/opencode/`) or
  `OPENROUTER_API_KEY`. With neither, every model fails.

### OpenCode 1.18.31 — historical

Verified against **OpenCode 1.18.31** installed locally, using `opencode agent list`,
`opencode debug agent <name>`, `opencode debug config`.

- **`tools:` in frontmatter is DEPRECATED** → use `permission:`. Schema says so outright. The two
  resolve identically (`tools: {x: true}` becomes `permission: {x: allow}` internally).
- **`$schema` is `https://opencode.ai/config.json`** — `config.v1.json` serves an HTML page.
- **`mode:` defaults to `all`** if omitted (clutters the primary picker). Always set it explicitly.
- **Both `.opencode/agent/` and `.opencode/agents/` are discovered.** Docs say plural.
- **Custom primary agents DO get the `task` tool** on 1.18.31 — GitHub issue #14308 does not
  reproduce. A router agent is viable.
- **`permission` supports patterns**, including `task` scoped by *agent name*:
  `task: { "*": allow, "deep-worker": deny }` resolves correctly (enforcement at call time not yet
  proven with a live run).
- **Built-in agents:** `build`, `plan`, `general`, `explore`, `compaction`, `summary`, `title`.
- **Built-in `explore` already has `webfetch: allow` + `websearch: allow`**, but `model: None` —
  it **inherits the caller's model**. An expensive agent delegating to it pays its own rate for grep
  work. *Pin its model in config.* (Outstanding.)
- **Built-in `explore` has `task: false`** — OpenCode disables onward delegation on leaf agents.
  Copy that pattern.
- **Project config shadows global config** entirely.
- Read permissions ship with built-in secret protection: `read *.env -> ask`.

---

## 5. The agent architecture — goals and status

**Goal:** a primary "router" agent that sorts incoming work and delegates to specialists, each pinned
to a model chosen by the formulas above, to optimise cost *and* quality. Covers code and non-code
(math, law, philosophy, hobbies…).

**Agents live in** `/home/user/shares/personal/dev/oss/openrouter-model-chooser-test_project/.opencode/agents/`
— a separate scratch project, deliberately isolated from this repo. This repo's `.opencode/` was
deleted once on purpose, then **recreated on 2026-10-19 at the user's request** to hold the generated
config + plugin (see §3). Still keep hand-written agents out of it — they belong in the scratch
project.

### Status

| # | Agent | Model | $/1M | State |
|---|---|---|---|---|
| 1 | `reasoning` | `openai/gpt-5.6-sol` | 4.00 | ✅ non-code analysis; no tools at all, no web |
| 2 | `code-simple` | `deepseek/deepseek-v4-flash-0731` | 0.075 | ✅ small scoped edits; pattern-gated mutation |
| 3 | `research` | `z-ai/glm-5.3-flash` | 0.143 | ✅ external research w/ sources; read-only |
| 4 | `deep-worker` | `openai/gpt-5.6-sol` | 4.00 | ✅ feature-scale work; only non-leaf so far |
| 5 | `oracle` | Coding (Value) | — | ⬜ **next** — read-only consultant for hard *code* problems |
| 6 | `router` | Intelligence (Budget) | — | ⬜ the primary that sorts (user's TODO calls it "jarvis") |
| 7 | `.opencode/opencode.jsonc` | — | — | ✅ generated (v2 format); `explore` pinned. Not yet wired to agents 1–6 |

Deferred deliberately: a **Momus-style plan reviewer** (only pays off once running autonomously —
right now the human reviews plans) and a **Metis-style gap analyser** (too specialised for one user).

### Conventions for writing these agents

- `description` is **the router's matching surface** — write it for a machine, include an explicit
  negative boundary ("Do NOT use for…"). Mis-routing is the main failure mode.
- Leaf agents get `task: deny`. Only `router` and `deep-worker` delegate.
- Deny irreversible things even on trusted agents: `git push`, `reset --hard`, `checkout --`,
  `rm -rf` → `ask`. Lockfiles → `deny`.
- Prompts stay **~20–35 lines**. Every agent ends with a "your output is relayed, make it
  self-contained" paragraph, because subagent output is consumed by another agent.
- Hard-invariant block per agent, tuned to its failure mode: coding agents get "never delete a
  failing test / never `as any`"; `research` gets "never invent a source, URL, quotation or date".
- Tools and prompt **compose** — removing a tool without telling the agent leaves it guessing.
  (`reasoning` was browsing for legal citations until we denied `webfetch` *and* told it the caller
  would fetch sources instead.)

### Key architectural decision

**Routing ≠ decomposition.** We do not chain `research` → `architect` → `code-simple` to simulate a
deep worker. Chaining loses context at every handoff, leaves the iterate-loop and "is it done?"
judgement ownerless, and puts the cheapest model in charge of the hardest call. Instead the router
makes a *sorting* decision (small vs. deep) and hands deep work over **intact** to `deep-worker`.
This is what oh-my-openagent does — Sisyphus delegates the whole job to Hephaestus.

---

## 6. On oh-my-openagent (cloned at `tmp/oh-my-openagent`)

Studied as prior art. **It is a product, not a config** — 158 MB, 6,271 TS files, 45 packages,
13 of them platform binaries, plus LSP daemons, MCP servers, a memory system, telemetry and a GUI.
The actual agents are **four files** (`sisyphus`, `atlas`, `hephaestus`, `general-agents`).

**Worth stealing:** category-routing indirection (agent → category → model, not agent → model);
fallback chains for unavailable models; the Manual QA Gate standard (*"diagnostics catch type errors,
not logic bugs"*); hard invariants.

**Deliberately not copied:** *prompt families per model*. Their Atlas has 8 variants (326–526 lines
each, ~3,100 total); Hephaestus has 4 (1,174 total). That only pays off shipping to thousands of
users across many providers. We write one prompt per agent.

**Deliberately not copied:** Oracle's *"one clear path — two-option comparisons signal indecision"*.
Correct for architecture, wrong for ethics/policy, where steelmanning opposing positions **is** the
discipline. `reasoning` keeps the opposite rule on purpose.

---

## 7. Open questions

- `default_agent` is a v2 config key (generator sets `"build"`); behaviour not tested in the TUI.
- Coding's Value pick is Fable 5.1, the priciest model (see §2 item 4) — options: accept, exclude
  the frontier's top point, or a min points-per-doubling. Undecided.
- `/deep` command and picker labels not yet seen in the TUI itself.
- Does `task: { "deep-worker": deny }` actually *enforce* at call time, or only resolve?
- Uncommitted: `src/components/OpenCodeConfigView.tsx` has staged + unstaged changes.
