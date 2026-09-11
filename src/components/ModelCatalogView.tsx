import React, { useState, useMemo } from 'react';
import type { ProcessedModel } from '../types/openrouter';
import { getProviderColor } from '../services/modelService';
import { Search, Download, ArrowUpDown } from 'lucide-react';

interface ModelCatalogViewProps {
  models: ProcessedModel[];
  onSelectModelDetail: (model: ProcessedModel) => void;
}

type SortField = 'name' | 'provider' | 'blendedCostPerM' | 'intelligenceIndex' | 'codingIndex' | 'agenticIndex' | 'contextLength';

export const ModelCatalogView: React.FC<ModelCatalogViewProps> = ({
  models,
  onSelectModelDetail
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('blendedCostPerM');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [freeOnly, setFreeOnly] = useState(false);
  const [reasoningOnly, setReasoningOnly] = useState(false);
  const pageSize = 25;
  const [currentPage, setCurrentPage] = useState(1);

  // Available unique providers
  const providers = useMemo(() => {
    const set = new Set<string>();
    models.forEach(m => set.add(m.provider));
    return Array.from(set).sort();
  }, [models]);

  // Filtered and sorted models
  const processedList = useMemo(() => {
    let list = [...models];

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(m => 
        m.name.toLowerCase().includes(q) || 
        m.id.toLowerCase().includes(q) || 
        m.provider.toLowerCase().includes(q)
      );
    }

    // Provider filter
    if (providerFilter !== 'all') {
      list = list.filter(m => m.provider === providerFilter);
    }

    // Free filter
    if (freeOnly) {
      list = list.filter(m => m.isFree);
    }

    // Reasoning filter
    if (reasoningOnly) {
      list = list.filter(m => m.hasReasoning);
    }

    // Sorting
    list.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (valA === null || valA === undefined) valA = sortDirection === 'asc' ? Infinity : -Infinity;
      if (valB === null || valB === undefined) valB = sortDirection === 'asc' ? Infinity : -Infinity;

      if (typeof valA === 'string') {
        return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortDirection === 'asc' ? valA - valB : valB - valA;
    });

    return list;
  }, [models, searchQuery, providerFilter, freeOnly, reasoningOnly, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(processedList.length / pageSize) || 1;
  const paginatedModels = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return processedList.slice(start, start + pageSize);
  }, [processedList, currentPage, pageSize]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const exportCSV = () => {
    const headers = ['ID', 'Name', 'Provider', 'Blended Cost ($/1M)', 'Prompt Cost ($/1M)', 'Completion Cost ($/1M)', 'Intelligence Index', 'Coding Index', 'Agentic Index', 'Context Window'];
    const rows = processedList.map(m => [
      `"${m.id}"`,
      `"${m.name.replace(/"/g, '""')}"`,
      `"${m.provider}"`,
      m.blendedCostPerM,
      m.promptCostPerM,
      m.completionCostPerM,
      m.intelligenceIndex ?? '',
      m.codingIndex ?? '',
      m.agenticIndex ?? '',
      m.contextLength
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `openrouter_models_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
      
      {/* Search & Filter Header Bar */}
      <div className="glass-panel flex flex-col gap-4 rounded-2xl p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white">OpenRouter Model Catalog Table</h2>
            <p className="text-xs text-slate-400">
              Showing {processedList.length} models matching active filters
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white"
            >
              <Download className="h-3.5 w-3.5 text-cyan-400" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
          {/* Search */}
          <div className="relative sm:col-span-6 lg:col-span-5">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search by model name or provider..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-xl border border-slate-800 bg-slate-900/90 pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          {/* Provider Select */}
          <div className="sm:col-span-3 lg:col-span-3">
            <select
              value={providerFilter}
              onChange={(e) => {
                setProviderFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-medium text-white focus:border-cyan-500 focus:outline-none"
            >
              <option value="all">All Providers ({providers.length})</option>
              {providers.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Quick Toggles */}
          <div className="flex items-center gap-2 sm:col-span-3 lg:col-span-4">
            <button
              onClick={() => setFreeOnly(!freeOnly)}
              className={`flex-1 rounded-xl border py-2 text-xs font-medium transition-all ${
                freeOnly ? 'border-amber-500/50 bg-amber-500/15 text-amber-300' : 'border-slate-800 bg-slate-900 text-slate-400'
              }`}
            >
              Free Only
            </button>
            <button
              onClick={() => setReasoningOnly(!reasoningOnly)}
              className={`flex-1 rounded-xl border py-2 text-xs font-medium transition-all ${
                reasoningOnly ? 'border-purple-500/50 bg-purple-500/15 text-purple-300' : 'border-slate-800 bg-slate-900 text-slate-400'
              }`}
            >
              Reasoning
            </button>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="glass-panel overflow-x-auto rounded-2xl p-4 sm:p-6 shadow-2xl">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
              <th className="py-3 px-3 cursor-pointer hover:text-white" onClick={() => handleSort('name')}>
                <div className="flex items-center gap-1">
                  <span>Model</span>
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th className="py-3 px-3 cursor-pointer hover:text-white" onClick={() => handleSort('provider')}>
                <div className="flex items-center gap-1">
                  <span>Provider</span>
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th className="py-3 px-3 cursor-pointer hover:text-white" onClick={() => handleSort('blendedCostPerM')}>
                <div className="flex items-center gap-1">
                  <span>Blended ($/1M)</span>
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th className="py-3 px-3 cursor-pointer hover:text-white" onClick={() => handleSort('intelligenceIndex')}>
                <div className="flex items-center gap-1">
                  <span>Intelligence</span>
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th className="py-3 px-3 cursor-pointer hover:text-white" onClick={() => handleSort('codingIndex')}>
                <div className="flex items-center gap-1">
                  <span>Coding</span>
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th className="py-3 px-3 cursor-pointer hover:text-white" onClick={() => handleSort('agenticIndex')}>
                <div className="flex items-center gap-1">
                  <span>Agentic</span>
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th className="py-3 px-3 cursor-pointer hover:text-white" onClick={() => handleSort('contextLength')}>
                <div className="flex items-center gap-1">
                  <span>Context</span>
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th className="py-3 px-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-200">
            {paginatedModels.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-500">
                  No models found matching search query.
                </td>
              </tr>
            ) : (
              paginatedModels.map(m => {
                const col = getProviderColor(m.provider);
                return (
                  <tr 
                    key={m.id}
                    className="hover:bg-slate-900/80 transition-colors cursor-pointer group"
                    onClick={() => onSelectModelDetail(m)}
                  >
                    <td className="py-3 px-3 font-semibold text-white group-hover:text-cyan-300">
                      <div>{m.shortName}</div>
                      <div className="text-[10px] text-slate-500 font-mono truncate max-w-[200px]">{m.id}</div>
                    </td>

                    <td className="py-3 px-3">
                      <span 
                        className="rounded px-2 py-0.5 text-[10px] font-bold border"
                        style={{ backgroundColor: col.bg, borderColor: col.border, color: col.hex }}
                      >
                        {m.provider}
                      </span>
                    </td>

                    <td className="py-3 px-3 font-mono font-bold text-cyan-300">
                      {m.isFree ? <span className="text-amber-400">Free</span> : `$${m.blendedCostPerM.toFixed(2)}`}
                    </td>

                    <td className="py-3 px-3 font-semibold">
                      {m.intelligenceIndex !== null ? (
                        <span className="text-slate-200">{m.intelligenceIndex}</span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>

                    <td className="py-3 px-3 font-semibold">
                      {m.codingIndex !== null ? (
                        <span className="text-emerald-400">{m.codingIndex}</span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>

                    <td className="py-3 px-3 font-semibold">
                      {m.agenticIndex !== null ? (
                        <span className="text-purple-400">{m.agenticIndex}</span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-slate-300 font-mono">
                      {Math.round(m.contextLength / 1000)}k
                    </td>

                    <td className="py-3 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onSelectModelDetail(m)}
                        className="rounded bg-slate-800 px-2.5 py-1 text-[11px] font-medium text-cyan-300 hover:bg-cyan-600 hover:text-white transition-colors"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Pagination Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-800 text-xs text-slate-400">
          <div>
            Page {currentPage} of {totalPages} ({processedList.length} total items)
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1 text-slate-300 hover:bg-slate-800 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1 text-slate-300 hover:bg-slate-800 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>

      </div>

    </div>
  );
};
