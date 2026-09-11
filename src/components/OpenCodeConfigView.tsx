import React, { useState, useMemo } from 'react';
import type { ProcessedModel } from '../types/openrouter';
import { calculateParetoFrontier, findKneePointModel } from '../services/modelService';
import { Code2, Bot, Brain, Copy, Download, Check, ExternalLink, Terminal, Cpu, Zap } from 'lucide-react';

interface OpenCodeConfigViewProps {
  models: ProcessedModel[];
  onSelectModelDetail: (model: ProcessedModel) => void;
}

export const OpenCodeConfigView: React.FC<OpenCodeConfigViewProps> = ({
  models,
  onSelectModelDetail
}) => {
  const [useBatchEndpoints, setUseBatchEndpoints] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // Compute Knee models for Coding, Agentic, and Intelligence (excluding rate-limited free demo models)
  const codingKnee = useMemo(() => {
    let dataset = models.filter(m => !m.isFree);
    if (!useBatchEndpoints) dataset = dataset.filter(m => !m.id.endsWith(':batch'));
    const pareto = calculateParetoFrontier(dataset, 'blendedCostPerM', 'codingIndex');
    return findKneePointModel(pareto, 'blendedCostPerM', 'codingIndex', true, false) || pareto[0] || models[0];
  }, [models, useBatchEndpoints]);

  const agenticKnee = useMemo(() => {
    let dataset = models.filter(m => !m.isFree);
    if (!useBatchEndpoints) dataset = dataset.filter(m => !m.id.endsWith(':batch'));
    const pareto = calculateParetoFrontier(dataset, 'blendedCostPerM', 'agenticIndex');
    return findKneePointModel(pareto, 'blendedCostPerM', 'agenticIndex', true, false) || pareto[0] || models[0];
  }, [models, useBatchEndpoints]);

  const intelKnee = useMemo(() => {
    let dataset = models.filter(m => !m.isFree);
    if (!useBatchEndpoints) dataset = dataset.filter(m => !m.id.endsWith(':batch'));
    const pareto = calculateParetoFrontier(dataset, 'blendedCostPerM', 'intelligenceIndex');
    return findKneePointModel(pareto, 'blendedCostPerM', 'intelligenceIndex', true, false) || pareto[0] || models[0];
  }, [models, useBatchEndpoints]);

  // Fast budget model (sub 10 cent or free model with best coding)
  const fastBudgetModel = useMemo(() => {
    const budgetModels = models.filter(m => m.blendedCostPerM <= 0.10 && m.codingIndex !== null);
    if (budgetModels.length === 0) return models.find(m => m.isFree) || models[0];
    budgetModels.sort((a, b) => (b.codingIndex || 0) - (a.codingIndex || 0));
    return budgetModels[0];
  }, [models]);



  // Generate OpenCode JSON configuration object
  const openCodeConfigJson = useMemo(() => {
    const cleanId = (id?: string) => id ? id.replace(':batch', '') : '';

    const config: Record<string, any> = {
      "$schema": "https://opencode.ai/config.v1.json",
      "model": codingKnee ? `openrouter/${cleanId(codingKnee.id)}` : "openrouter/z-ai/glm-5.3-flash",
      "agent": {
        "build": {
          "model": codingKnee ? `openrouter/${cleanId(codingKnee.id)}` : "openrouter/z-ai/glm-5.3-flash"
        },
        "plan": {
          "model": intelKnee ? `openrouter/${cleanId(intelKnee.id)}` : "openrouter/z-ai/glm-5.3-flash"
        },
        "general": {
          "model": fastBudgetModel ? `openrouter/${cleanId(fastBudgetModel.id)}` : "openrouter/deepseek/deepseek-v4-flash-0731"
        }
      }
    };

    return config;
  }, [intelKnee, codingKnee, fastBudgetModel]);

  const jsonString = useMemo(() => JSON.stringify(openCodeConfigJson, null, 2), [openCodeConfigJson]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadJsonFile = () => {
    const element = document.createElement("a");
    const file = new Blob([jsonString], {type: 'application/json'});
    element.href = URL.createObjectURL(file);
    element.download = "opencode.json";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
      
      {/* Top Banner */}
      <div className="glass-panel flex flex-col gap-4 rounded-2xl p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Terminal className="h-6 w-6 text-cyan-400" />
              <h2 className="text-xl font-bold text-white">OpenCode Max ROI Configuration Generator</h2>
              <span className="rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-0.5 text-xs font-bold">
                Kneedle Algorithm Optimized
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Automatically assigns the exact mathematical "Knee Point" (Max ROI) OpenRouter models to specific agent roles (Orchestrator, Coder, Agentic Tools, Fast Budget).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={copyToClipboard}
              className="flex items-center gap-1.5 rounded-xl border border-cyan-500/50 bg-cyan-500/15 px-3.5 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-500/25 transition-all shadow-lg shadow-cyan-500/10"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              <span>{copied ? 'Copied to Clipboard!' : 'Copy opencode.json'}</span>
            </button>

            <button
              onClick={downloadJsonFile}
              className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-200 hover:bg-slate-700 hover:text-white transition-colors"
            >
              <Download className="h-4 w-4 text-amber-400" />
              <span>Download File</span>
            </button>
          </div>
        </div>

        {/* Configuration Toggles */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-1 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer text-slate-300 font-medium">
              <input
                type="checkbox"
                checked={useBatchEndpoints}
                onChange={(e) => setUseBatchEndpoints(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-0"
              />
              <span>Allow Discounted Batch Endpoints (`:batch` ~ 50% lower cost)</span>
            </label>


          </div>

          <div className="text-[11px] text-slate-400 font-mono">
            Provider: <strong className="text-cyan-300">OpenRouter (OpenAI-compatible endpoint)</strong>
          </div>
        </div>
      </div>

      {/* Role Assignment Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        
        {/* 1. Orchestrator */}
        <div 
          onClick={() => intelKnee && onSelectModelDetail(intelKnee)}
          className="glass-panel glass-panel-hover flex flex-col justify-between rounded-2xl p-4 cursor-pointer relative overflow-hidden border-cyan-500/30"
        >
          <div className="flex items-start justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                <Brain className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">Orchestrator</h4>
                <p className="text-[10px] text-slate-400">Architecture & Planning</p>
              </div>
            </div>
            <span className="rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 text-[10px] font-bold">
              ★ Intel Knee
            </span>
          </div>

          {intelKnee && (
            <div className="py-3 space-y-1.5">
              <div className="font-bold text-cyan-300 text-sm">{intelKnee.shortName}</div>
              <div className="text-[11px] font-mono text-slate-400">{intelKnee.id}</div>
              <div className="flex items-center gap-3 text-xs text-slate-300 pt-1">
                <span>Cost: <strong className="text-white">{intelKnee.isFree ? 'Free' : `$${intelKnee.blendedCostPerM.toFixed(3)}/1M`}</strong></span>
                <span>Intel: <strong className="text-cyan-400">{intelKnee.intelligenceIndex ?? 'N/A'}</strong></span>
              </div>
            </div>
          )}

          <div className="text-[10px] text-slate-400 border-t border-slate-800/80 pt-2 flex items-center justify-between">
            <span>Optimal reasoning per dollar</span>
            <ExternalLink className="h-3 w-3 text-slate-500" />
          </div>
        </div>

        {/* 2. Coding */}
        <div 
          onClick={() => codingKnee && onSelectModelDetail(codingKnee)}
          className="glass-panel glass-panel-hover flex flex-col justify-between rounded-2xl p-4 cursor-pointer relative overflow-hidden border-emerald-500/30"
        >
          <div className="flex items-start justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <Code2 className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">Code Editor</h4>
                <p className="text-[10px] text-slate-400">Refactoring & Editing</p>
              </div>
            </div>
            <span className="rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 text-[10px] font-bold">
              ★ Coding Knee
            </span>
          </div>

          {codingKnee && (
            <div className="py-3 space-y-1.5">
              <div className="font-bold text-emerald-300 text-sm">{codingKnee.shortName}</div>
              <div className="text-[11px] font-mono text-slate-400">{codingKnee.id}</div>
              <div className="flex items-center gap-3 text-xs text-slate-300 pt-1">
                <span>Cost: <strong className="text-white">{codingKnee.isFree ? 'Free' : `$${codingKnee.blendedCostPerM.toFixed(3)}/1M`}</strong></span>
                <span>Coding: <strong className="text-emerald-400">{codingKnee.codingIndex ?? 'N/A'}</strong></span>
              </div>
            </div>
          )}

          <div className="text-[10px] text-slate-400 border-t border-slate-800/80 pt-2 flex items-center justify-between">
            <span>Peak SWE benchmark ROI</span>
            <ExternalLink className="h-3 w-3 text-slate-500" />
          </div>
        </div>

        {/* 3. Agentic */}
        <div 
          onClick={() => agenticKnee && onSelectModelDetail(agenticKnee)}
          className="glass-panel glass-panel-hover flex flex-col justify-between rounded-2xl p-4 cursor-pointer relative overflow-hidden border-purple-500/30"
        >
          <div className="flex items-start justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/30">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">Agentic Tools</h4>
                <p className="text-[10px] text-slate-400">Search & Tool Execution</p>
              </div>
            </div>
            <span className="rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 text-[10px] font-bold">
              ★ Agent Knee
            </span>
          </div>

          {agenticKnee && (
            <div className="py-3 space-y-1.5">
              <div className="font-bold text-purple-300 text-sm">{agenticKnee.shortName}</div>
              <div className="text-[11px] font-mono text-slate-400">{agenticKnee.id}</div>
              <div className="flex items-center gap-3 text-xs text-slate-300 pt-1">
                <span>Cost: <strong className="text-white">{agenticKnee.isFree ? 'Free' : `$${agenticKnee.blendedCostPerM.toFixed(3)}/1M`}</strong></span>
                <span>Agentic: <strong className="text-purple-400">{agenticKnee.agenticIndex ?? 'N/A'}</strong></span>
              </div>
            </div>
          )}

          <div className="text-[10px] text-slate-400 border-t border-slate-800/80 pt-2 flex items-center justify-between">
            <span>High precision tool-calling</span>
            <ExternalLink className="h-3 w-3 text-slate-500" />
          </div>
        </div>

        {/* 4. Fast Budget */}
        <div 
          onClick={() => fastBudgetModel && onSelectModelDetail(fastBudgetModel)}
          className="glass-panel glass-panel-hover flex flex-col justify-between rounded-2xl p-4 cursor-pointer relative overflow-hidden border-blue-500/30"
        >
          <div className="flex items-start justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/30">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">Fast / Cheap</h4>
                <p className="text-[10px] text-slate-400">Linting & Quick Checks</p>
              </div>
            </div>
            <span className="rounded bg-blue-500/20 text-blue-300 border border-blue-500/40 px-1.5 py-0.5 text-[10px] font-bold">
              Sub-10¢
            </span>
          </div>

          {fastBudgetModel && (
            <div className="py-3 space-y-1.5">
              <div className="font-bold text-blue-300 text-sm">{fastBudgetModel.shortName}</div>
              <div className="text-[11px] font-mono text-slate-400">{fastBudgetModel.id}</div>
              <div className="flex items-center gap-3 text-xs text-slate-300 pt-1">
                <span>Cost: <strong className="text-white">{fastBudgetModel.isFree ? 'Free' : `$${fastBudgetModel.blendedCostPerM.toFixed(3)}/1M`}</strong></span>
                <span>Coding: <strong className="text-blue-400">{fastBudgetModel.codingIndex ?? 'N/A'}</strong></span>
              </div>
            </div>
          )}

          <div className="text-[10px] text-slate-400 border-t border-slate-800/80 pt-2 flex items-center justify-between">
            <span>Sub-10 cent execution</span>
            <ExternalLink className="h-3 w-3 text-slate-500" />
          </div>
        </div>

      </div>

      {/* Code Syntax Preview Box */}
      <div className="glass-panel flex flex-col rounded-2xl p-4 sm:p-6 shadow-2xl gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-3 gap-2">
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-cyan-400" />
            <h3 className="text-base font-bold text-white">Generated `opencode.json` File Snippet</h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">Place in project root directory or `~/.config/opencode/opencode.json`</span>
        </div>

        <div className="relative rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-cyan-300 overflow-x-auto shadow-inner">
          <pre>{jsonString}</pre>
        </div>

        {/* CLI Usage & Restart Instructions */}
        <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-4 text-xs space-y-2">
          <div className="font-bold text-cyan-300 flex items-center gap-1.5">
            <Terminal className="h-4 w-4 text-cyan-400" />
            <span>How to launch OpenCode with your new config:</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-slate-300 font-mono text-[11px] pt-1">
            <div className="bg-slate-900/90 border border-slate-800 p-2.5 rounded-lg space-y-1">
              <div className="text-amber-400 font-sans font-bold">1. Start a New Session (or Lock Model):</div>
              <div className="text-cyan-300 selection:bg-cyan-500 selection:text-white">opencode -m openrouter/{codingKnee ? codingKnee.id.replace(':batch', '') : 'z-ai/glm-5.3-flash'}</div>
            </div>
            <div className="bg-slate-900/90 border border-slate-800 p-2.5 rounded-lg space-y-1">
              <div className="text-amber-400 font-sans font-bold">2. Clear Stale TUI Model Cache:</div>
              <div className="text-cyan-300">rm ~/.local/state/opencode/model.json && opencode</div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};
