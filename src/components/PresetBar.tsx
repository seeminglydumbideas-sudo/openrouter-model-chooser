import React from 'react';
import type { AxisMetricKey } from '../types/openrouter';
import { Code2, Bot, Brain, Sparkles, Maximize2, Trophy, Flame } from 'lucide-react';

export interface PresetConfig {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  xAxis: AxisMetricKey;
  yAxis: AxisMetricKey;
  xLog?: boolean;
  yLog?: boolean;
  filterFreeOnly?: boolean;
  filterReasoningOnly?: boolean;
}

interface PresetBarProps {
  activePresetId: string | null;
  onApplyPreset: (preset: PresetConfig) => void;
}

export const PRESETS: PresetConfig[] = [
  {
    id: 'coding',
    name: 'Coding Champions',
    description: 'Price vs Software Engineering capability score',
    icon: <Code2 className="h-4 w-4 text-emerald-400" />,
    xAxis: 'blendedCostPerM',
    yAxis: 'codingIndex',
    xLog: true,
    yLog: false,
  },
  {
    id: 'agentic',
    name: 'Agentic Leaders',
    description: 'Price vs Tool-Use & Multi-step agent workflow score',
    icon: <Bot className="h-4 w-4 text-purple-400" />,
    xAxis: 'blendedCostPerM',
    yAxis: 'agenticIndex',
    xLog: true,
    yLog: false,
  },
  {
    id: 'intelligence',
    name: 'Frontier Intelligence',
    description: 'Price vs Overall Intelligence rating',
    icon: <Brain className="h-4 w-4 text-cyan-400" />,
    xAxis: 'blendedCostPerM',
    yAxis: 'intelligenceIndex',
    xLog: true,
    yLog: false,
  },
  {
    id: 'value',
    name: 'Best Free Models',
    description: 'Capability distribution of 100% free OpenRouter models',
    icon: <Sparkles className="h-4 w-4 text-amber-400" />,
    xAxis: 'blendedCostPerM',
    yAxis: 'intelligenceIndex',
    xLog: false,
    yLog: false,
    filterFreeOnly: true,
  },
  {
    id: 'context',
    name: 'Long Context Masters',
    description: 'Context Window size vs Intelligence Index',
    icon: <Maximize2 className="h-4 w-4 text-blue-400" />,
    xAxis: 'contextLength',
    yAxis: 'intelligenceIndex',
    xLog: true,
    yLog: false,
  },
  {
    id: 'arena',
    name: 'Design Arena ELO',
    description: 'Price vs Design Arena benchmark ELO rating',
    icon: <Trophy className="h-4 w-4 text-rose-400" />,
    xAxis: 'blendedCostPerM',
    yAxis: 'arenaElo',
    xLog: true,
    yLog: false,
  }
];

export const PresetBar: React.FC<PresetBarProps> = ({ activePresetId, onApplyPreset }) => {
  return (
    <div className="w-full border-b border-slate-800/60 bg-slate-950/40 px-4 py-3 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl items-center gap-3 overflow-x-auto pb-1 scrollbar-thin">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 shrink-0 uppercase tracking-wider">
          <Flame className="h-3.5 w-3.5 text-amber-400" /> Presets:
        </span>
        <div className="flex items-center gap-2">
          {PRESETS.map((preset) => {
            const isActive = activePresetId === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => onApplyPreset(preset)}
                title={preset.description}
                className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all shrink-0 ${
                  isActive
                    ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300 shadow-sm shadow-cyan-500/20 ring-1 ring-cyan-500/30'
                    : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                {preset.icon}
                <span>{preset.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
