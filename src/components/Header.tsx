import React from 'react';
import { Cpu, RefreshCw, Compass, Table, Terminal } from 'lucide-react';

interface HeaderProps {
  activeTab: 'scatter' | 'opencode' | 'table';
  setActiveTab: (tab: 'scatter' | 'opencode' | 'table') => void;
  totalModels: number;
  filteredModelsCount: number;
  isLive: boolean;
  isLoading: boolean;
  onRefresh: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  totalModels,
  filteredModelsCount,
  isLive,
  isLoading,
  onRefresh
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        
        {/* Brand & Subtitle */}
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 via-indigo-600 to-purple-600 p-0.5 shadow-lg shadow-cyan-500/20">
            <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-slate-950">
              <Cpu className="h-6 w-6 text-cyan-400 animate-pulse" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
                OpenRouter <span className="bg-gradient-to-r from-cyan-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">Model Positioning</span>
              </h1>
              <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-xs font-semibold text-cyan-400">
                v2026
              </span>
            </div>
            <p className="text-xs text-slate-400 sm:text-sm">
              Pricing vs Coding, Agentic & Intelligence Matrix ({filteredModelsCount} of {totalModels} models)
            </p>
          </div>
        </div>

        {/* Live Status & Tab Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Live Indicator */}
          <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-xs font-medium text-slate-300">
            <span className="relative flex h-2.5 w-2.5">
              <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${isLive ? 'bg-emerald-400' : 'bg-amber-400'} opacity-75`}></span>
              <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${isLive ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
            </span>
            <span>{isLive ? 'Live API Data' : 'Cached Snapshot'}</span>
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="ml-1 rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors disabled:opacity-50"
              title="Refresh OpenRouter API Data"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex rounded-xl border border-slate-800 bg-slate-900/80 p-1">
            <button
              onClick={() => setActiveTab('scatter')}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all ${
                activeTab === 'scatter'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Compass className="h-4 w-4" />
              <span>2D Matrix</span>
            </button>

            <button
              onClick={() => setActiveTab('opencode')}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all ${
                activeTab === 'opencode'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Terminal className="h-4 w-4 text-amber-400" />
              <span>OpenCode Config</span>
            </button>

            <button
              onClick={() => setActiveTab('table')}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all ${
                activeTab === 'table'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Table className="h-4 w-4" />
              <span>Catalog Table</span>
            </button>
          </nav>
        </div>

      </div>
    </header>
  );
};
