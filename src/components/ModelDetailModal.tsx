import React, { useState } from 'react';
import type { ProcessedModel } from '../types/openrouter';
import { getProviderColor } from '../services/modelService';
import { X, ExternalLink, Code2, Bot, Brain, Copy, Check } from 'lucide-react';

interface ModelDetailModalProps {
  model: ProcessedModel | null;
  onClose: () => void;
}

export const ModelDetailModal: React.FC<ModelDetailModalProps> = ({
  model,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'pricing' | 'raw'>('overview');
  const [copied, setCopied] = useState(false);

  if (!model) return null;

  const col = getProviderColor(model.provider);

  const copyId = () => {
    navigator.clipboard.writeText(model.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="glass-panel relative flex flex-col w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl border border-slate-700/80 shadow-2xl bg-slate-950">
        
        {/* Modal Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div 
              className="flex h-12 w-12 items-center justify-center rounded-xl border font-bold text-lg"
              style={{ backgroundColor: col.bg, borderColor: col.border, color: col.hex }}
            >
              {model.provider.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white">{model.name}</h3>
                {model.isFree && (
                  <span className="rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 text-[10px] font-bold">
                    FREE
                  </span>
                )}
                {model.isImageOutput && (
                  <span className="rounded bg-pink-500/20 text-pink-300 border border-pink-500/40 px-2 py-0.5 text-[10px] font-bold">
                    IMAGE GEN
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400 font-mono mt-0.5">
                <span>{model.id}</span>
                <button onClick={copyId} className="text-slate-500 hover:text-cyan-400">
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-900/30 px-5 text-xs font-semibold text-slate-400">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-4 border-b-2 transition-colors ${
              activeTab === 'overview' ? 'border-cyan-500 text-cyan-300 font-bold' : 'border-transparent hover:text-white'
            }`}
          >
            Overview & Benchmarks
          </button>
          <button
            onClick={() => setActiveTab('pricing')}
            className={`py-3 px-4 border-b-2 transition-colors ${
              activeTab === 'pricing' ? 'border-cyan-500 text-cyan-300 font-bold' : 'border-transparent hover:text-white'
            }`}
          >
            Pricing & Limits
          </button>
          <button
            onClick={() => setActiveTab('raw')}
            className={`py-3 px-4 border-b-2 transition-colors ${
              activeTab === 'raw' ? 'border-cyan-500 text-cyan-300 font-bold' : 'border-transparent hover:text-white'
            }`}
          >
            Raw JSON Specs
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs text-slate-300">
          {activeTab === 'overview' && (
            <>
              {/* Description */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3.5 leading-relaxed text-slate-300">
                {model.description}
              </div>

              {/* Benchmark Cards Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col items-center justify-center p-3 rounded-xl border border-cyan-500/20 bg-cyan-500/5">
                  <Brain className="h-5 w-5 text-cyan-400 mb-1" />
                  <span className="text-[11px] text-slate-400 font-medium">Intelligence</span>
                  <span className="text-base font-bold text-cyan-300 mt-0.5">
                    {model.intelligenceIndex !== null ? model.intelligenceIndex : 'N/A'}
                  </span>
                </div>

                <div className="flex flex-col items-center justify-center p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
                  <Code2 className="h-5 w-5 text-emerald-400 mb-1" />
                  <span className="text-[11px] text-slate-400 font-medium">Coding</span>
                  <span className="text-base font-bold text-emerald-300 mt-0.5">
                    {model.codingIndex !== null ? model.codingIndex : 'N/A'}
                  </span>
                </div>

                <div className="flex flex-col items-center justify-center p-3 rounded-xl border border-purple-500/20 bg-purple-500/5">
                  <Bot className="h-5 w-5 text-purple-400 mb-1" />
                  <span className="text-[11px] text-slate-400 font-medium">Agentic</span>
                  <span className="text-base font-bold text-purple-300 mt-0.5">
                    {model.agenticIndex !== null ? model.agenticIndex : 'N/A'}
                  </span>
                </div>
              </div>

              {/* Spec Details Table */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-2.5">
                <h4 className="font-bold text-white uppercase text-[11px] tracking-wider mb-2">Technical Specs</h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400">Context Window:</span>
                    <div className="font-semibold text-white">{Math.round(model.contextLength / 1000)}k tokens</div>
                  </div>
                  <div>
                    <span className="text-slate-400">Max Completion:</span>
                    <div className="font-semibold text-white">
                      {model.maxCompletionTokens ? `${Math.round(model.maxCompletionTokens / 1000)}k tokens` : 'N/A'}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400">Input Modalities:</span>
                    <div className="font-semibold text-cyan-300">{model.inputModalities.join(', ')}</div>
                  </div>
                  <div>
                    <span className="text-slate-400">Image Output:</span>
                    <div className="font-semibold text-pink-300">{model.isImageOutput ? 'Supported (Text-to-Image / Multi)' : 'No'}</div>
                  </div>
                  <div>
                    <span className="text-slate-400">Reasoning Support:</span>
                    <div className="font-semibold text-purple-300">
                      {model.hasReasoning ? `Yes (${model.reasoningEfforts.join(', ') || 'default'})` : 'No'}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'pricing' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/50">
                  <span className="text-slate-400 text-[11px]">Prompt / Input Token Price</span>
                  <div className="text-lg font-bold text-cyan-300 mt-1">
                    {model.isFree ? 'Free' : `$${model.promptCostPerM.toFixed(3)} / 1M`}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/50">
                  <span className="text-slate-400 text-[11px]">Completion / Output Token Price</span>
                  <div className="text-lg font-bold text-cyan-300 mt-1">
                    {model.isFree ? 'Free' : `$${model.completionCostPerM.toFixed(3)} / 1M`}
                  </div>
                </div>
              </div>

              {model.raw.pricing?.input_cache_read && (
                <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/40">
                  <span className="text-slate-400 text-[11px]">Cache Read Price:</span>
                  <span className="font-mono text-cyan-300 ml-2 font-bold">
                    ${(parseFloat(model.raw.pricing.input_cache_read) * 1_000_000).toFixed(4)} / 1M tokens
                  </span>
                </div>
              )}

              {model.raw.pricing?.web_search && (
                <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/40">
                  <span className="text-slate-400 text-[11px]">Web Search Surcharge:</span>
                  <span className="font-mono text-amber-300 ml-2 font-bold">
                    ${model.raw.pricing.web_search} per query
                  </span>
                </div>
              )}
            </div>
          )}

          {activeTab === 'raw' && (
            <pre className="p-4 rounded-xl border border-slate-800 bg-slate-950 font-mono text-[11px] text-emerald-400 overflow-x-auto max-h-96">
              {JSON.stringify(model.raw, null, 2)}
            </pre>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-between p-4 border-t border-slate-800 bg-slate-900/60">
          <a
            href={`https://openrouter.ai/models/${model.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-semibold text-cyan-400 hover:underline"
          >
            <span>View on OpenRouter.ai</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-lg bg-slate-800 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
