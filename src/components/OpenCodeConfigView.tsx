import React, { useState, useMemo, useEffect } from 'react';
import type { ProcessedModel } from '../types/openrouter';
import { computeAxisSpotlights, buildOpenCodeConfig, buildImagePlugin } from '../services/opencodeConfig';
import { createZip } from '../services/zip';
import setupUserConfigScript from '../../scripts/setup-user-config?raw';
import { Download, Check, ChevronRight, HardDrive, Terminal } from 'lucide-react';

interface OpenCodeConfigViewProps {
  models: ProcessedModel[];
}

const Code: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <code className="rounded bg-slate-900 px-1.5 py-0.5 font-mono text-cyan-300">{children}</code>
);

export const OpenCodeConfigView: React.FC<OpenCodeConfigViewProps> = ({ models }) => {
  const [showConfig, setShowConfig] = useState<boolean>(false);
  const [diskWrite, setDiskWrite] = useState<{ state: 'idle' | 'writing' | 'done' | 'error'; message?: string }>({ state: 'idle' });
  // Directory the server writes into, or null when no write endpoint exists
  // (static hosting). Served by the Vite dev server and the container server.
  const [diskTarget, setDiskTarget] = useState<string | null>(null);

  useEffect(() => {
    fetch('/__opencode/write-config')
      .then(res => res.ok && res.headers.get('Content-Type')?.includes('application/json') ? res.json() : null)
      .then(body => setDiskTarget(typeof body?.directory === 'string' ? body.directory : null))
      .catch(() => setDiskTarget(null));
  }, []);

  // Budget Knee, Value Recovery and SOTA for every task axis — the same formulas
  // the scatter plot uses. Drives the generated config and the image plugin.
  const axisSpotlights = useMemo(() => computeAxisSpotlights(models), [models]);
  const configJsonString = useMemo(() => buildOpenCodeConfig(models, axisSpotlights), [models, axisSpotlights]);

  // Image plugin tiers: Text-to-Image Budget Knee and SOTA. The T2I dataset only
  // holds models OpenRouter's Image API serves (see modelService), so with no
  // pick there is simply no plugin.
  const imageSpotlight = axisSpotlights.find(a => a.label === 'Text-to-Image')!;
  const budgetImageModel = imageSpotlight.budget ?? imageSpotlight.sota;
  const bestImageModel = imageSpotlight.sota ?? imageSpotlight.budget;
  const pluginJsText = useMemo(
    () => budgetImageModel && bestImageModel ? buildImagePlugin(budgetImageModel.id, bestImageModel.id) : null,
    [budgetImageModel, bestImageModel]
  );
  const defaultModel = axisSpotlights.find(a => a.label === 'Coding')?.budget;

  // Same names as the files in .opencode/ (see server/writeConfig.ts).
  const files = useMemo(() => {
    const out: Record<string, string> = { 'opencode.jsonc': configJsonString };
    if (pluginJsText) out['plugins/image-generation.js'] = pluginJsText;
    return out;
  }, [configJsonString, pluginJsText]);

  const writeConfigToDisk = async () => {
    setDiskWrite({ state: 'writing' });
    try {
      const res = await fetch('/__opencode/write-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setDiskWrite({ state: 'done', message: `Wrote ${body.written.join(', ')}` });
    } catch (err) {
      setDiskWrite({ state: 'error', message: (err as Error).message });
    }
  };

  // Unzipped in a project root it is ready to use there; ./setup-user-config
  // installs the same files user-wide.
  const downloadZip = () => {
    const zip = createZip([
      ...Object.entries(files).map(([name, content]) => ({ name: `.opencode/${name}`, content })),
      { name: 'setup-user-config', content: setupUserConfigScript, executable: true },
    ]);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(zip);
    link.download = 'opencode-config.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
      <div className="glass-panel flex flex-col gap-5 rounded-2xl p-4 sm:p-6 text-sm text-slate-300">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <Terminal className="h-6 w-6 text-cyan-400" />
            <h2 className="text-xl font-bold text-white">OpenCode configuration</h2>
            <span className="rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/40 px-2.5 py-0.5 text-xs font-bold">
              OpenCode 2.0
            </span>
          </div>

          <div className="flex items-center gap-2">
            {diskTarget && (
              <button
                onClick={writeConfigToDisk}
                disabled={diskWrite.state === 'writing'}
                title={`Overwrite ${Object.keys(files).join(' and ')} in ${diskTarget}`}
                className="flex items-center gap-1.5 rounded-xl border border-emerald-500/50 bg-emerald-500/15 px-3.5 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50 transition-all shadow-lg shadow-emerald-500/10"
              >
                {diskWrite.state === 'done' ? <Check className="h-4 w-4 text-emerald-400" /> : <HardDrive className="h-4 w-4" />}
                <span>{diskWrite.state === 'writing' ? 'Writing…' : 'Write on disk'}</span>
              </button>
            )}
            <button
              onClick={downloadZip}
              className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-200 hover:bg-slate-700 hover:text-white transition-colors"
            >
              <Download className="h-4 w-4 text-amber-400" />
              <span>Download config (.zip)</span>
            </button>
          </div>
        </div>

        {diskWrite.message && (
          <div className={`text-xs font-mono ${diskWrite.state === 'error' ? 'text-rose-400' : 'text-emerald-400'}`}>
            {diskWrite.state === 'error' ? `Write failed: ${diskWrite.message}` : `${diskWrite.message}. Run opencode service restart to load it.`}
          </div>
        )}

        <p>
          Every agent defaults to the Budget Knee pick{defaultModel && <> (<strong className="text-white">{defaultModel.shortName}</strong>)</>}.
          Pricier models are opt-in: the <Code>build-premium</Code> agent (switch to it with <kbd className="rounded border border-slate-600 bg-slate-800 px-1.5 py-0.5 font-mono text-xs text-slate-200">Shift+Tab</kbd>,
          like <Code>plan</Code> and <Code>build</Code>), the <Code>/deep</Code> command, or any model picked in <Code>/model</Code>.
        </p>

        <div>
          <h3 className="mb-2 font-bold text-white">Model names in <Code>/model</Code></h3>
          <ul className="flex flex-col gap-1">
            <li><strong className="text-emerald-300">[✔]</strong> Budget Knee — the default.</li>
            <li><strong className="text-amber-300">[$$]</strong> other recommended model.</li>
            <li><strong className="text-rose-300">[$$$]</strong> recommended, but expensive: $5/M or more.</li>
          </ul>
          <p className="mt-2 text-xs text-slate-400">
            Recommended means on a Pareto frontier for Intelligence, Coding or Agentic: no cheaper model scores as well
            on that axis (see the 2D Matrix). Each name also shows the price and the cost multiple vs. the default, e.g.{' '}
            <span className="font-mono text-slate-300">[$$] Some Model · $4.00/M · ×47</span>. Models of $5/M or more that are on no
            frontier are hidden; other unlisted models stay selectable, unlabelled.
          </p>
        </div>

        {pluginJsText && budgetImageModel && bestImageModel && (
          <div>
            <h3 className="mb-2 font-bold text-white">Image generation</h3>
            <p>
              OpenCode can't generate images on its own, so the config comes with a plugin,{' '}
              <Code>plugins/image-generation.js</Code>. OpenCode loads it automatically from the <Code>plugins/</Code> folder next to
              the config; it adds an <Code>image_generate</Code> tool that calls OpenRouter's Image API and saves the image to a file.
              It has two tiers: <strong className="text-white">budget</strong> ({budgetImageModel.shortName}, the default) and{' '}
              <strong className="text-white">best</strong> ({bestImageModel.shortName}). To use it, just ask the <Code>build</Code> agent
              for an image, or for something that needs one — it decides to call the tool itself. To force it, use the{' '}
              <Code>/image</Code> command. Either way, OpenCode asks for your approval before every call, because each image costs
              money; afterwards the tool reports the saved path and the cost. Only <Code>build</Code> and <Code>build-premium</Code> can
              use it; <Code>plan</Code> and the subagents can't.
            </p>
            <ul className="mt-2 flex flex-col gap-1 font-mono text-xs text-emerald-300">
              <li>&gt; generate a flat fox logo, save it as public/logo.png</li>
              <li>&gt; add a hero section with an illustration</li>
              <li>&gt; /image best a photorealistic coffee cup → assets/cup.png</li>
            </ul>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
            <h3 className="mb-1.5 font-bold text-white">This project</h3>
            <p className="text-xs leading-relaxed">
              {diskTarget
                ? <>Write on disk writes into <Code>{diskTarget}</Code>:</>
                : <>Unzip the download in the project root. It contains:</>}{' '}
              <Code>.opencode/opencode.jsonc</Code> and <Code>.opencode/plugins/image-generation.js</Code>. OpenCode reads both from there.
              Token: <Code>.openrouter-token</Code> in the project root.
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
            <h3 className="mb-1.5 font-bold text-white">User-wide</h3>
            <p className="text-xs leading-relaxed">
              Run <Code>make install</Code> in this repo, or <Code>./setup-user-config</Code> from the zip next to its <Code>.opencode/</Code>. It merges the
              config into <Code>~/.config/opencode/opencode.jsonc</Code> and copies the plugin to <Code>~/.config/opencode/plugins/</Code>.
              Lines it adds end in <Code>// @ormc</Code>; re-run it to update them. Token: <Code>~/.config/opencode/.openrouter-token</Code>.
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-400">Then run <Code>opencode service restart</Code>.</p>

        <button
          onClick={() => setShowConfig(v => !v)}
          aria-expanded={showConfig}
          className="flex items-center gap-1.5 self-start text-xs font-semibold text-slate-300 hover:text-white transition-colors"
        >
          <ChevronRight className={`h-4 w-4 transition-transform ${showConfig ? 'rotate-90' : ''}`} />
          <span>{showConfig ? 'Hide' : 'Show'} opencode.jsonc ({configJsonString.split('\n').length} lines)</span>
        </button>

        {showConfig && (
          <div className="relative rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-cyan-300 overflow-x-auto shadow-inner">
            <pre>{configJsonString}</pre>
          </div>
        )}
      </div>
    </div>
  );
};
