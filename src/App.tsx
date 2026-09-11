import { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { PresetBar } from './components/PresetBar';
import type { PresetConfig } from './components/PresetBar';
import { ScatterPlotView } from './components/ScatterPlotView';
import { ModelCatalogView } from './components/ModelCatalogView';
import { OpenCodeConfigView } from './components/OpenCodeConfigView';
import { ModelDetailModal } from './components/ModelDetailModal';
import type { ProcessedModel, AxisMetricKey } from './types/openrouter';
import { getInitialModels, fetchLiveModels } from './services/modelService';

export default function App() {
  const [models, setModels] = useState<ProcessedModel[]>(() => getInitialModels());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLive, setIsLive] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<'scatter' | 'opencode' | 'table'>('scatter');
  const [selectedModelDetail, setSelectedModelDetail] = useState<ProcessedModel | null>(null);
  
  const [activePresetId, setActivePresetId] = useState<string | null>('intelligence');
  
  const [xAxisKey, setXAxisKey] = useState<AxisMetricKey>('blendedCostPerM');
  const [yAxisKey, setYAxisKey] = useState<AxisMetricKey>('intelligenceIndex');
  const [isXLog, setIsXLog] = useState<boolean>(true);
  const [isYLog, setIsYLog] = useState<boolean>(false);
  const [showPareto, setShowPareto] = useState<boolean>(true);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [filterFreeOnly, setFilterFreeOnly] = useState<boolean>(false);
  const [filterReasoningOnly, setFilterReasoningOnly] = useState<boolean>(false);
  const [filterMultimodalOnly, setFilterMultimodalOnly] = useState<boolean>(false);

  // Live fetch on load
  const loadLiveModels = useCallback(async () => {
    setIsLoading(true);
    try {
      const liveData = await fetchLiveModels();
      if (liveData && liveData.length > 0) {
        setModels(liveData);
        setIsLive(true);
      }
    } catch (err) {
      console.warn('Using cached snapshot data due to API notice:', err);
      setIsLive(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLiveModels();
  }, [loadLiveModels]);

  const handleApplyPreset = (preset: PresetConfig) => {
    setActivePresetId(preset.id);
    setXAxisKey(preset.xAxis);
    setYAxisKey(preset.yAxis);
    if (preset.xLog !== undefined) setIsXLog(preset.xLog);
    if (preset.yLog !== undefined) setIsYLog(preset.yLog);
    if (preset.filterFreeOnly !== undefined) setFilterFreeOnly(preset.filterFreeOnly);
    if (preset.filterReasoningOnly !== undefined) setFilterReasoningOnly(preset.filterReasoningOnly);
    
    if (activeTab !== 'scatter') setActiveTab('scatter');
  };

  return (
    <div className="min-h-screen bg-[#07090e] bg-grid-pattern text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-white">
      
      {/* Top Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        totalModels={models.length}
        filteredModelsCount={models.length}
        isLive={isLive}
        isLoading={isLoading}
        onRefresh={loadLiveModels}
      />

      {/* Quick Presets Bar */}
      <PresetBar
        activePresetId={activePresetId}
        onApplyPreset={handleApplyPreset}
      />

      {/* Main Content Body */}
      <main className="flex-1 pb-16">
        {activeTab === 'scatter' && (
          <ScatterPlotView
            models={models}
            selectedModel={selectedModelDetail}
            onSelectModel={setSelectedModelDetail}
            xAxisKey={xAxisKey}
            setXAxisKey={(k) => { setXAxisKey(k); setActivePresetId(null); }}
            yAxisKey={yAxisKey}
            setYAxisKey={(k) => { setYAxisKey(k); setActivePresetId(null); }}
            isXLog={isXLog}
            setIsXLog={setIsXLog}
            isYLog={isYLog}
            setIsYLog={setIsYLog}
            showPareto={showPareto}
            setShowPareto={setShowPareto}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            selectedProviders={selectedProviders}
            setSelectedProviders={setSelectedProviders}
            filterFreeOnly={filterFreeOnly}
            setFilterFreeOnly={setFilterFreeOnly}
            filterReasoningOnly={filterReasoningOnly}
            setFilterReasoningOnly={setFilterReasoningOnly}
            filterMultimodalOnly={filterMultimodalOnly}
            setFilterMultimodalOnly={setFilterMultimodalOnly}
          />
        )}

        {activeTab === 'opencode' && (
          <OpenCodeConfigView
            models={models}
            onSelectModelDetail={setSelectedModelDetail}
          />
        )}

        {activeTab === 'table' && (
          <ModelCatalogView
            models={models}
            onSelectModelDetail={setSelectedModelDetail}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-800/80 bg-slate-950/80 py-6 text-center text-xs text-slate-500 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 sm:flex-row sm:px-6">
          <p>© 2026 OpenRouter Model Positioning Matrix • Real-time AI benchmarks & pricing visualization</p>
          <div className="flex items-center gap-4 text-slate-400">
            <a href="https://openrouter.ai/models" target="_blank" rel="noreferrer" className="hover:text-cyan-400">
              OpenRouter Models
            </a>
            <span>•</span>
            <a href="https://artificialanalysis.ai" target="_blank" rel="noreferrer" className="hover:text-cyan-400">
              Artificial Analysis
            </a>
          </div>
        </div>
      </footer>

      {/* Model Specs Detail Modal */}
      <ModelDetailModal
        model={selectedModelDetail}
        onClose={() => setSelectedModelDetail(null)}
      />

    </div>
  );
}
