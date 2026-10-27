import React, { useState, useMemo, useEffect } from 'react';
import { 
  ScatterChart, 
  Scatter, 
  XAxis, 
  YAxis, 
  ZAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  CartesianGrid,
  Line,
  matchByDataKey
} from 'recharts';
import type { ProcessedModel, AxisMetricKey } from '../types/openrouter';
import { AXIS_OPTIONS } from '../types/openrouter';
import { getMetricValue, calculateParetoFrontier, findMarginalGainWinners, findValueRecoveryModel, computePickGain, getProviderColor, estimateVramGB } from '../services/modelService';
import { loadDay, type DaySummary } from '../services/history';
import { HistoryTimeline, type TimelineEntry } from './HistoryTimeline';
import { Search, Layers, Info, Sparkles, Sliders, ExternalLink, Zap, Repeat } from 'lucide-react';

// X-axis is fixed to Blended Cost — this is the only cost view the app supports.
const X_AXIS_KEY: AxisMetricKey = 'blendedCostPerM';

const PLAY_STEP_MS = 900;

// Bubble fill when the "VRAM" size has no parameter count for the model.
const NO_VRAM_COLOR = '#475569';

const formatGB = (gb: number) => gb >= 100 ? `${Math.round(gb)} GB` : `${gb.toFixed(gb >= 10 ? 0 : 1)} GB`;

interface ScatterPlotViewProps {
  models: ProcessedModel[];
  isLive: boolean;
  historyDays: DaySummary[] | null;
  selectedModel: ProcessedModel | null;
  onSelectModel: (model: ProcessedModel) => void;
  yAxisKey: AxisMetricKey;
  setYAxisKey: (key: AxisMetricKey) => void;
  isXLog: boolean;
  setIsXLog: (val: boolean) => void;
  isYLog: boolean;
  setIsYLog: (val: boolean) => void;
  showPareto: boolean;
  setShowPareto: (val: boolean) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedProviders: string[];
  setSelectedProviders: React.Dispatch<React.SetStateAction<string[]>>;
  filterFreeOnly: boolean;
  setFilterFreeOnly: (val: boolean) => void;
  filterReasoningOnly: boolean;
  setFilterReasoningOnly: (val: boolean) => void;
  filterMultimodalOnly: boolean;
  setFilterMultimodalOnly: (val: boolean) => void;
  filterImageOutputOnly: boolean;
  setFilterImageOutputOnly: (val: boolean) => void;
}

export const ScatterPlotView: React.FC<ScatterPlotViewProps> = ({
  models: currentModels,
  isLive,
  historyDays,
  selectedModel,
  onSelectModel,
  yAxisKey,
  setYAxisKey,
  isXLog,
  setIsXLog,
  isYLog,
  setIsYLog,
  showPareto,
  setShowPareto,
  searchQuery,
  setSearchQuery,
  selectedProviders,
  setSelectedProviders,
  filterFreeOnly,
  setFilterFreeOnly,
  filterReasoningOnly,
  setFilterReasoningOnly,
  filterMultimodalOnly,
  setFilterMultimodalOnly,
  filterImageOutputOnly,
  setFilterImageOutputOnly,
}) => {
  const [sizeMetric, setSizeMetric] = useState<'context' | 'cost' | 'vram' | 'equal'>('context');
  const [excludeBatch, setExcludeBatch] = useState<boolean>(true);

  // Timeline: one entry per recorded day. Today's live fetch is the last entry
  // even if the server has not stored it (yet). selectedDate null = latest.
  const timeline = useMemo<TimelineEntry[]>(() => {
    if (!historyDays || historyDays.length === 0) return [];
    const today = new Date().toISOString().slice(0, 10);
    if (!isLive || historyDays.some(d => d.date === today)) return historyDays;
    return [...historyDays, { date: today, synthetic: false, count: currentModels.length, added: 0, removed: 0, repriced: 0, rescored: 0, unsaved: true }];
  }, [historyDays, isLive, currentModels.length]);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [dayModels, setDayModels] = useState<{ date: string; models: ProcessedModel[] } | null>(null);

  const selectedIndex = useMemo(() => {
    const i = selectedDate ? timeline.findIndex(d => d.date === selectedDate) : -1;
    return i >= 0 ? i : timeline.length - 1;
  }, [timeline, selectedDate]);
  const shownDate = timeline[selectedIndex]?.date ?? null;
  // The live fetch already is today's data; anything else comes from the server.
  const showsCurrent = shownDate === null || (isLive && shownDate === new Date().toISOString().slice(0, 10));

  const isLoadingDay = !showsCurrent && dayModels?.date !== shownDate;

  useEffect(() => {
    if (showsCurrent || !shownDate) return;
    let cancelled = false;
    loadDay(shownDate)
      .then(models => { if (!cancelled) setDayModels({ date: shownDate, models }); })
      .catch(err => console.warn('History record unavailable:', err));
    return () => { cancelled = true; };
  }, [shownDate, showsCurrent]);

  // While a day loads, the previous one stays on screen, so points move instead of blinking.
  const models = showsCurrent || !dayModels ? currentModels : dayModels.models;

  useEffect(() => {
    // Wait for the current day to be on screen before stepping on.
    if (!isPlaying || isLoadingDay || selectedIndex >= timeline.length - 1) return;
    const timer = setTimeout(() => {
      const next = selectedIndex + 1;
      if (next >= timeline.length - 1) {
        setSelectedDate(null);
        setIsPlaying(false);
      } else {
        setSelectedDate(timeline[next].date);
      }
    }, PLAY_STEP_MS);
    return () => clearTimeout(timer);
  }, [isPlaying, selectedIndex, timeline, isLoadingDay]);

  const selectDay = (index: number) => {
    setIsPlaying(false);
    setSelectedDate(index >= timeline.length - 1 ? null : timeline[index].date);
  };
  const togglePlay = () => {
    if (!isPlaying && selectedIndex >= timeline.length - 1) setSelectedDate(timeline[0].date);
    setIsPlaying(!isPlaying);
  };

  const xAxisOption = AXIS_OPTIONS.find(a => a.key === X_AXIS_KEY)!;
  const yAxisOption = AXIS_OPTIONS.find(a => a.key === yAxisKey) || AXIS_OPTIONS[1];

  // All unique providers from models list
  const availableProviders = useMemo(() => {
    const set = new Set<string>();
    models.forEach(m => set.add(m.provider));
    return Array.from(set).sort();
  }, [models]);

  // Filtered dataset
  const filteredModels = useMemo(() => {
    return models.filter(m => {
      // Exclude batch endpoints for real-time interactive evaluation
      if (excludeBatch && m.id.endsWith(':batch')) return false;

      // Search
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const matchName = m.name.toLowerCase().includes(q);
        const matchId = m.id.toLowerCase().includes(q);
        const matchProvider = m.provider.toLowerCase().includes(q);
        if (!matchName && !matchId && !matchProvider) return false;
      }
      // Provider
      if (selectedProviders.length > 0 && !selectedProviders.includes(m.provider)) {
        return false;
      }
      // Free
      if (filterFreeOnly && !m.isFree) return false;
      // Reasoning
      if (filterReasoningOnly && !m.hasReasoning) return false;
      // Multimodal
      if (filterMultimodalOnly && !m.isMultimodal) return false;
      // Image Output
      if (filterImageOutputOnly && !m.isImageOutput) return false;

      // Metric presence check
      const xVal = getMetricValue(m, X_AXIS_KEY);
      const yVal = getMetricValue(m, yAxisKey);
      if (xVal === null || yVal === null || isNaN(xVal) || isNaN(yVal)) return false;

      // Log scale filter out 0 values if log is enabled
      if (isXLog && xVal <= 0) return false;
      if (isYLog && yVal <= 0) return false;

      return true;
    });
  }, [
    models, 
    excludeBatch,
    searchQuery, 
    selectedProviders, 
    filterFreeOnly, 
    filterReasoningOnly, 
    filterMultimodalOnly,
    filterImageOutputOnly,
    yAxisKey, 
    isXLog, 
    isYLog
  ]);

  // Pareto Frontier models
  const paretoModels = useMemo(() => {
    if (!showPareto) return [];
    return calculateParetoFrontier(filteredModels, X_AXIS_KEY, yAxisKey);
  }, [filteredModels, yAxisKey, showPareto]);

  const paretoIds = useMemo(() => new Set(paretoModels.map(m => m.id)), [paretoModels]);

  // Knee Model calculation (Marginal Gain Rule Winners: Budget Knee & SOTA Knee)
  const kneeWinners = useMemo(() => {
    if (!showPareto || paretoModels.length < 2) return { budgetKnee: null, sotaKnee: null };
    return findMarginalGainWinners(paretoModels, X_AXIS_KEY, yAxisKey, isXLog, isYLog);
  }, [paretoModels, yAxisKey, isXLog, isYLog, showPareto]);

  // Value Recovery: the model right after the steepest "marginal value dips then
  // rebounds" transition above the Budget Knee (see findValueRecoveryModel).
  const valueRecoveryModel = useMemo(() => {
    if (!showPareto) return null;
    return findValueRecoveryModel(paretoModels, X_AXIS_KEY, yAxisKey, isXLog, isYLog, kneeWinners.budgetKnee);
  }, [paretoModels, yAxisKey, isXLog, isYLog, kneeWinners.budgetKnee, showPareto]);

  // What the Value Recovery pick buys over the Budget Knee, so its significance
  // is visible next to its name.
  const valueRecoveryGain = useMemo(() => {
    if (!valueRecoveryModel || !kneeWinners.budgetKnee) return null;
    return computePickGain(kneeWinners.budgetKnee, valueRecoveryModel, X_AXIS_KEY, yAxisKey);
  }, [valueRecoveryModel, kneeWinners.budgetKnee, yAxisKey]);

  // Secant baseline line points
  const secantLineData = useMemo(() => {
    if (!showPareto || paretoModels.length < 2) return [];
    const first = paretoModels[0];
    const last = paretoModels[paretoModels.length - 1];
    return [
      { x: getMetricValue(first, X_AXIS_KEY)!, y: getMetricValue(first, yAxisKey)! },
      { x: getMetricValue(last, X_AXIS_KEY)!, y: getMetricValue(last, yAxisKey)! }
    ];
  }, [paretoModels, yAxisKey, showPareto]);

  // Transform data for Recharts
  const chartData = useMemo(() => {
    return filteredModels.map(m => {
      const x = getMetricValue(m, X_AXIS_KEY)!;
      const y = getMetricValue(m, yAxisKey)!;
      
      let z = 100;
      if (sizeMetric === 'context') {
        z = Math.max(30, Math.min(600, Math.log2(m.contextLength / 1000 + 1) * 60));
      } else if (sizeMetric === 'cost') {
        z = Math.max(30, Math.min(600, Math.log10(m.blendedCostPerM + 1) * 150));
      } else if (sizeMetric === 'vram') {
        // Log scale: estimates span ~1 GB (small models) to ~1 TB (largest MoEs).
        z = m.params ? Math.max(30, Math.min(600, Math.log2(estimateVramGB(m.params) + 1) * 60)) : 30;
      }

      const noVram = sizeMetric === 'vram' && !m.params;
      const color = noVram ? { hex: NO_VRAM_COLOR } : getProviderColor(m.provider);
      const isPareto = paretoIds.has(m.id);
      const isBudgetKnee = kneeWinners.budgetKnee?.id === m.id;
      const isValueRecovery = valueRecoveryModel?.id === m.id;
      const isSelected = selectedModel?.id === m.id;

      return {
        x,
        y,
        z,
        model: m,
        color: color.hex,
        isPareto,
        isBudgetKnee,
        isValueRecovery,
        isSelected,
        noVram
      };
    });
  }, [filteredModels, yAxisKey, sizeMetric, paretoIds, kneeWinners, valueRecoveryModel, selectedModel]);

  // Pareto line points sorted
  const paretoLineData = useMemo(() => {
    return paretoModels.map(m => ({
      x: getMetricValue(m, X_AXIS_KEY)!,
      y: getMetricValue(m, yAxisKey)!
    }));
  }, [paretoModels, yAxisKey]);

  const toggleProvider = (p: string) => {
    setSelectedProviders(prev => 
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    );
  };

  const selectAllProviders = () => setSelectedProviders([]);

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
      
      {/* Controls Bar & Filters */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        
        {/* Left: Controls & Axis Selection */}
        <div className="glass-panel flex flex-col gap-4 rounded-2xl p-4 lg:col-span-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Sliders className="h-4 w-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Matrix Axes</h3>
            </div>
            <span className="text-xs text-slate-400 font-medium">
              {filteredModels.length} models visible
            </span>
          </div>

          {/* X Axis (fixed to Blended Cost) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>X-Axis (Horizontal)</span>
              <button
                onClick={() => setIsXLog(!isXLog)}
                className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${
                  isXLog ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300 font-bold' : 'border-slate-800 text-slate-400'
                }`}
              >
                {isXLog ? 'Log Scale ON' : 'Linear Scale'}
              </button>
            </label>
            <div className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-medium text-white shadow-inner">
              {xAxisOption.label}
            </div>
            <span className="text-[11px] text-slate-400">{xAxisOption.description}</span>
          </div>

          {/* Y Axis Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>Y-Axis (Vertical)</span>
              <button
                onClick={() => setIsYLog(!isYLog)}
                className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${
                  isYLog ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300 font-bold' : 'border-slate-800 text-slate-400'
                }`}
              >
                {isYLog ? 'Log Scale ON' : 'Linear Scale'}
              </button>
            </label>
            <select
              value={yAxisKey}
              onChange={(e) => setYAxisKey(e.target.value as AxisMetricKey)}
              className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-medium text-white shadow-inner focus:border-cyan-500 focus:outline-none"
            >
              {AXIS_OPTIONS.map(opt => (
                <option key={opt.key} value={opt.key}>{opt.label}</option>
              ))}
            </select>
            <span className="text-[11px] text-slate-400">{yAxisOption.description}</span>
          </div>

          {/* Bubble Size & Pareto Frontier Toggles */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-400">Bubble Size</label>
              <select
                value={sizeMetric}
                onChange={(e) => setSizeMetric(e.target.value as any)}
                className="rounded-md border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-white"
              >
                <option value="context">Context Size</option>
                <option value="cost">Blended Cost</option>
                <option value="vram">VRAM (open weights)</option>
                <option value="equal">Uniform Size</option>
              </select>
              {sizeMetric === 'vram' && (
                <span className="text-[10px] text-slate-500">≈ 4-bit estimate · gray = closed or size unknown</span>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-400">Pareto Frontier</label>
              <button
                onClick={() => setShowPareto(!showPareto)}
                className={`flex items-center justify-center gap-1.5 rounded-md border py-1.5 px-2 text-xs font-medium transition-all ${
                  showPareto
                    ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300 shadow-sm'
                    : 'border-slate-800 bg-slate-900 text-slate-400'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>{showPareto ? 'Frontier ON' : 'Show Line'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right: Search & Quick Filters */}
        <div className="glass-panel flex flex-col gap-3 rounded-2xl p-4 lg:col-span-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search models by name, ID or provider..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-900/90 pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            {/* Feature Filter Buttons */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
              <button
                onClick={() => setExcludeBatch(!excludeBatch)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all shrink-0 ${
                  excludeBatch
                    ? 'border-amber-500/50 bg-amber-500/15 text-amber-300 shadow-sm shadow-amber-500/10'
                    : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                <span>{excludeBatch ? '✓ Real-Time API Only' : 'Include Batch'}</span>
              </button>

              <button
                onClick={() => setFilterFreeOnly(!filterFreeOnly)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all shrink-0 ${
                  filterFreeOnly
                    ? 'border-amber-500/50 bg-amber-500/15 text-amber-300'
                    : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                <span>Free Only</span>
              </button>

              <button
                onClick={() => setFilterReasoningOnly(!filterReasoningOnly)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all shrink-0 ${
                  filterReasoningOnly
                    ? 'border-purple-500/50 bg-purple-500/15 text-purple-300'
                    : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                <span>Reasoning</span>
              </button>

              <button
                onClick={() => setFilterMultimodalOnly(!filterMultimodalOnly)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all shrink-0 ${
                  filterMultimodalOnly
                    ? 'border-blue-500/50 bg-blue-500/15 text-blue-300'
                    : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                <span>Multimodal</span>
              </button>

              <button
                onClick={() => setFilterImageOutputOnly(!filterImageOutputOnly)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all shrink-0 ${
                  filterImageOutputOnly
                    ? 'border-pink-500/50 bg-pink-500/15 text-pink-300'
                    : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                <span>🖼️ Image Output</span>
              </button>
            </div>
          </div>

          {/* Provider Filter Chips */}
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-800/80">
            <span className="text-[11px] font-semibold text-slate-400 mr-1">Providers:</span>
            <button
              onClick={selectAllProviders}
              className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors ${
                selectedProviders.length === 0
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                  : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              All ({availableProviders.length})
            </button>
            {availableProviders.map(p => {
              const isSelected = selectedProviders.includes(p);
              const col = getProviderColor(p);
              return (
                <button
                  key={p}
                  onClick={() => toggleProvider(p)}
                  className="rounded-md px-2 py-0.5 text-[11px] font-medium transition-all flex items-center gap-1 border"
                  style={{
                    backgroundColor: isSelected ? col.bg : 'rgba(15, 23, 42, 0.6)',
                    borderColor: isSelected ? col.border : 'rgba(255,255,255,0.08)',
                    color: isSelected ? col.hex : '#9ca3af'
                  }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: col.hex }} />
                  {p}
                </button>
              );
            })}
          </div>
        </div>

      </div>

      {/* Main Scatter Canvas Area */}
      <div className="glass-panel relative flex flex-col rounded-2xl p-4 sm:p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-cyan-400" />
            <div>
              <h2 className="text-base font-bold text-white">
                {yAxisOption.label} <span className="text-slate-500 font-normal">vs</span> {xAxisOption.label}
              </h2>
              <p className="text-xs text-slate-400">
                Click any node to inspect model specs or add to comparison
              </p>
            </div>
          </div>

          {showPareto && paretoModels.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {kneeWinners.budgetKnee && (
                <div 
                  onClick={() => onSelectModel(kneeWinners.budgetKnee!)}
                  className="flex items-center gap-1.5 rounded-lg border border-amber-500/50 bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-300 shadow-lg shadow-amber-500/10 cursor-pointer hover:bg-amber-500/25 transition-all"
                  title="Best Budget Value Knee (Maximum ROI at lower cost)"
                >
                  <Zap className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
                  <span>⚡ Best Budget Knee: {kneeWinners.budgetKnee.shortName}</span>
                </div>
              )}
              {valueRecoveryModel && (
                <div
                  onClick={() => onSelectModel(valueRecoveryModel)}
                  className="flex items-center gap-1.5 rounded-lg border border-violet-500/50 bg-violet-500/15 px-3 py-1 text-xs font-bold text-violet-300 shadow-lg shadow-violet-500/10 cursor-pointer hover:bg-violet-500/25 transition-all"
                  title={
                    'Value Recovery: marginal value dipped above the Budget Knee, then resumed a good rate here' +
                    (valueRecoveryGain
                      ? `\nvs. Budget Knee: ${valueRecoveryGain.deltaScore >= 0 ? '+' : ''}${valueRecoveryGain.deltaScore.toFixed(1)} pts (${(valueRecoveryGain.pctGain * 100).toFixed(0)}%) for ×${valueRecoveryGain.costMultiple.toFixed(1)} cost — ${valueRecoveryGain.pointsPerDoubling.toFixed(2)} pts per cost doubling`
                      : '')
                  }
                >
                  <Repeat className="h-3.5 w-3.5 text-violet-400 animate-pulse" />
                  <span>🔁 Value Recovery: {valueRecoveryModel.shortName}</span>
                  {valueRecoveryGain && (
                    <span className="font-medium text-violet-200/80">
                      · +{valueRecoveryGain.deltaScore.toFixed(1)} pts for ×{valueRecoveryGain.costMultiple.toFixed(valueRecoveryGain.costMultiple < 10 ? 1 : 0)} cost
                      · {valueRecoveryGain.pointsPerDoubling.toFixed(1)}/2×
                    </span>
                  )}
                </div>
              )}
              <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                <Sparkles className="h-3.5 w-3.5" />
                <span>{paretoModels.length} Pareto Models</span>
              </div>
            </div>
          )}
        </div>

        {/* Recharts Container */}
        <div className="h-[520px] w-full relative">
          {filteredModels.length === 0 ? (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-slate-400">
              <Info className="h-10 w-10 text-slate-600" />
              <p className="text-sm font-medium">No models match the active filters or log scale constraints.</p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedProviders([]);
                  setFilterFreeOnly(false);
                  setFilterReasoningOnly(false);
                  setFilterMultimodalOnly(false);
                  setFilterImageOutputOnly(false);
                }}
                className="rounded-lg bg-cyan-600 px-4 py-2 text-xs font-semibold text-white hover:bg-cyan-500"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 30, bottom: 40, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
                
                <XAxis
                  type="number"
                  dataKey="x"
                  name={xAxisOption.label}
                  scale={isXLog ? 'log' : 'linear'}
                  domain={isXLog ? ['auto', 'auto'] : [0, 'auto']}
                  stroke="#64748b"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  tickFormatter={xAxisOption.format}
                />

                <YAxis
                  type="number"
                  dataKey="y"
                  name={yAxisOption.label}
                  scale={isYLog ? 'log' : 'linear'}
                  domain={isYLog ? ['auto', 'auto'] : [0, 'auto']}
                  stroke="#64748b"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  tickFormatter={yAxisOption.format}
                />

                <ZAxis type="number" dataKey="z" range={[60, 500]} />

                <Tooltip
                  cursor={{ strokeDasharray: '3 3', stroke: '#06b6d4' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      const m: ProcessedModel = data.model;
                      const col = getProviderColor(m.provider);
                      return (
                        <div className="flex flex-col gap-2 p-3 text-xs rounded-xl bg-slate-950/95 border border-slate-700/80 shadow-2xl backdrop-blur-xl max-w-xs">
                          <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-2">
                            <div>
                              <div className="font-bold text-white text-sm">{m.shortName}</div>
                              <div className="text-[11px] text-slate-400 font-mono">{m.id}</div>
                            </div>
                            <span 
                              className="rounded px-2 py-0.5 text-[10px] font-bold border shrink-0"
                              style={{ backgroundColor: col.bg, borderColor: col.border, color: col.hex }}
                            >
                              {m.provider}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[11px] py-1">
                            <div>
                              <span className="text-slate-400">{xAxisOption.label}:</span>
                              <div className="font-semibold text-cyan-300">{xAxisOption.format(data.x)}</div>
                            </div>
                            <div>
                              <span className="text-slate-400">{yAxisOption.label}:</span>
                              <div className="font-semibold text-cyan-300">{yAxisOption.format(data.y)}</div>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-800">
                            {data.isBudgetKnee && (
                              <span className="rounded bg-amber-500/20 text-amber-300 border border-amber-500/50 px-1.5 py-0.5 text-[10px] font-bold flex items-center gap-1">
                                <Zap className="h-3 w-3 text-amber-400" /> ⚡ Best Budget Knee
                              </span>
                            )}
                            {data.isValueRecovery && (
                              <span className="rounded bg-violet-500/20 text-violet-300 border border-violet-500/50 px-1.5 py-0.5 text-[10px] font-bold flex items-center gap-1">
                                <Repeat className="h-3 w-3 text-violet-400" /> 🔁 Value Recovery
                              </span>
                            )}
                            {data.isPareto && !data.isBudgetKnee && !data.isValueRecovery && (
                              <span className="rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.5 text-[10px] font-bold flex items-center gap-1">
                                <Sparkles className="h-3 w-3" /> Pareto Efficient
                              </span>
                            )}
                            {m.isFree && (
                              <span className="rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 text-[10px] font-bold">
                                FREE
                              </span>
                            )}
                            {m.hasReasoning && (
                              <span className="rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 px-1.5 py-0.5 text-[10px] font-bold">
                                Reasoning
                              </span>
                            )}
                            {m.isMultimodal && (
                              <span className="rounded bg-blue-500/20 text-blue-300 border border-blue-500/40 px-1.5 py-0.5 text-[10px] font-bold">
                                Vision
                              </span>
                            )}
                            {m.isImageOutput && (
                              <span className="rounded bg-pink-500/20 text-pink-300 border border-pink-500/40 px-1.5 py-0.5 text-[10px] font-bold">
                                🖼️ Image Gen
                              </span>
                            )}
                          </div>

                          <div className="text-[10px] text-slate-400 pt-1">
                            Context: <span className="text-slate-200 font-semibold">{Math.round(m.contextLength / 1000)}k tokens</span>
                          </div>

                          <div className="text-[10px] text-slate-400">
                            {m.params ? (
                              <>
                                Open weights: <span className="text-slate-200 font-semibold">{(m.params / 1e9).toFixed(m.params < 1e10 ? 1 : 0)}B params</span>
                                {m.paramsSource === 'name' && ' (from name)'}
                                {m.hfGated && ' · gated'}
                                {m.hfLicense && ` · ${m.hfLicense}`}
                                <div>
                                  VRAM ≈ <span className="text-slate-200 font-semibold">{formatGB(estimateVramGB(m.params, 4))}</span> 4-bit
                                  {' · '}{formatGB(estimateVramGB(m.params, 8))} 8-bit
                                  {' · '}{formatGB(estimateVramGB(m.params, 16))} 16-bit
                                </div>
                              </>
                            ) : m.hfId ? (
                              <>Open weights ({m.hfId}), size unknown</>
                            ) : (
                              <>No open weights listed</>
                            )}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />

                {/* Secant Chord Baseline Line */}
                {showPareto && secantLineData.length === 2 && (
                  <Line
                    type="linear"
                    dataKey="y"
                    data={secantLineData}
                    stroke="#6366f1"
                    strokeWidth={1.5}
                    strokeDasharray="2 4"
                    dot={false}
                    isAnimationActive={false}
                  />
                )}

                {/* Pareto Frontier Line Overlay */}
                {showPareto && paretoLineData.length > 1 && (
                  <Line
                    type="monotone"
                    dataKey="y"
                    data={paretoLineData}
                    stroke="#10b981"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={false}
                    isAnimationActive={true}
                  />
                )}

                {/* Scatter Dots */}
                <Scatter
                  data={chartData}
                  animationMatchBy={matchByDataKey('model.id')}
                  onClick={(entry: any) => {
                    if (entry && entry.model) {
                      onSelectModel(entry.model);
                    }
                  }}
                  className="cursor-pointer"
                >
                  {chartData.map((entry) => {
                    const isSelected = entry.isSelected;
                    const isPareto = entry.isPareto;

                    let stroke = entry.color;
                    let strokeWidth = 1.5;
                    let opacity = entry.noVram ? 0.25 : 0.85;

                    if (isSelected) {
                      stroke = '#ffffff';
                      strokeWidth = 3.5;
                      opacity = 1;
                    } else if (entry.isBudgetKnee && showPareto) {
                      stroke = '#f59e0b'; // Amber for Budget Knee
                      strokeWidth = 3.5;
                      opacity = 1;
                    } else if (entry.isValueRecovery && showPareto) {
                      stroke = '#8b5cf6'; // Violet for Value Recovery
                      strokeWidth = 3.5;
                      opacity = 1;
                    } else if (isPareto && showPareto) {
                      stroke = '#10b981';
                      strokeWidth = 2.5;
                      opacity = 1;
                    }
                    if (entry.noVram && !isSelected) opacity = Math.min(opacity, 0.35);

                    return (
                      <Cell
                        key={entry.model.id}
                        fill={entry.color}
                        stroke={stroke}
                        strokeWidth={strokeWidth}
                        fillOpacity={opacity}
                      />
                    );
                  })}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Day histogram + slider: replays the recorded history in the matrix */}
        {timeline.length > 0 && (
          <HistoryTimeline
            entries={timeline}
            selectedIndex={selectedIndex}
            onSelect={selectDay}
            isPlaying={isPlaying}
            onTogglePlay={togglePlay}
            isLoadingDay={isLoadingDay}
          />
        )}

        {/* Selected Model Quick Action Banner */}
        {selectedModel && (
          <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-cyan-500/40 bg-slate-900/90 p-3.5 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div 
                className="flex h-10 w-10 items-center justify-center rounded-lg border font-bold text-sm"
                style={{
                  backgroundColor: getProviderColor(selectedModel.provider).bg,
                  borderColor: getProviderColor(selectedModel.provider).border,
                  color: getProviderColor(selectedModel.provider).hex
                }}
              >
                {selectedModel.provider.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-white">{selectedModel.name}</h4>
                  <span className="text-xs text-slate-400 font-mono">{selectedModel.id}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-300 mt-0.5">
                  <span>Blended: <strong className="text-cyan-300">{selectedModel.isFree ? 'Free' : `$${selectedModel.blendedCostPerM.toFixed(2)}/1M`}</strong></span>
                  <span>Intel: <strong className="text-cyan-300">{selectedModel.intelligenceIndex ?? 'N/A'}</strong></span>
                  <span>Coding: <strong className="text-cyan-300">{selectedModel.codingIndex ?? 'N/A'}</strong></span>
                  <span>Agentic: <strong className="text-cyan-300">{selectedModel.agenticIndex ?? 'N/A'}</strong></span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onSelectModel(selectedModel)}
                className="flex items-center gap-1.5 rounded-lg border border-cyan-500/50 bg-cyan-500/15 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/25 transition-all"
              >
                <span>Inspect Full Specs</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

      </div>

    </div>
  );
};
