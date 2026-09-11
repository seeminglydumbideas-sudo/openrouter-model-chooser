import type { OpenRouterModelRaw, ProcessedModel, AxisMetricKey } from '../types/openrouter';
import snapshotData from '../data/snapshot.json';

export const PROVIDER_COLORS: Record<string, { bg: string; border: string; hex: string }> = {
  'OpenAI': { bg: 'rgba(16, 185, 129, 0.2)', border: '#10b981', hex: '#10b981' },
  'Anthropic': { bg: 'rgba(217, 119, 6, 0.2)', border: '#d97706', hex: '#d97706' },
  'Google': { bg: 'rgba(59, 130, 246, 0.2)', border: '#3b82f6', hex: '#3b82f6' },
  'DeepSeek': { bg: 'rgba(99, 102, 241, 0.2)', border: '#6366f1', hex: '#6366f1' },
  'Meta': { bg: 'rgba(14, 165, 233, 0.2)', border: '#0ea5e9', hex: '#0ea5e9' },
  'Qwen': { bg: 'rgba(168, 85, 247, 0.2)', border: '#a855f7', hex: '#a855f7' },
  'Z.ai': { bg: 'rgba(236, 72, 153, 0.2)', border: '#ec4899', hex: '#ec4899' },
  'Sakana AI': { bg: 'rgba(20, 184, 166, 0.2)', border: '#14b8a6', hex: '#14b8a6' },
  'Mistral AI': { bg: 'rgba(249, 115, 22, 0.2)', border: '#f97316', hex: '#f97316' },
  'IBM': { bg: 'rgba(37, 99, 235, 0.2)', border: '#2563eb', hex: '#2563eb' },
  'InclusionAI': { bg: 'rgba(139, 92, 246, 0.2)', border: '#8b5cf6', hex: '#8b5cf6' },
  'Cohere': { bg: 'rgba(5, 150, 105, 0.2)', border: '#059669', hex: '#059669' },
  'xAI': { bg: 'rgba(244, 63, 94, 0.2)', border: '#f43f5e', hex: '#f43f5e' },
  'Other': { bg: 'rgba(156, 163, 175, 0.2)', border: '#9ca3af', hex: '#9ca3af' },
};

export function getProviderColor(provider: string): { bg: string; border: string; hex: string } {
  return PROVIDER_COLORS[provider] || PROVIDER_COLORS['Other'];
}

export function extractProvider(id: string, name: string): string {
  const cleanId = id.replace(/^~/, '').toLowerCase();
  const cleanName = name.toLowerCase();

  if (cleanId.startsWith('openai/') || cleanName.includes('openai')) return 'OpenAI';
  if (cleanId.startsWith('anthropic/') || cleanName.includes('claude')) return 'Anthropic';
  if (cleanId.startsWith('google/') || cleanName.includes('gemini')) return 'Google';
  if (cleanId.startsWith('deepseek/') || cleanName.includes('deepseek')) return 'DeepSeek';
  if (cleanId.startsWith('meta/') || cleanId.startsWith('meta-llama/') || cleanName.includes('llama') || cleanName.includes('muse')) return 'Meta';
  if (cleanId.startsWith('qwen/') || cleanName.includes('qwen')) return 'Qwen';
  if (cleanId.startsWith('z-ai/') || cleanName.includes('z.ai') || cleanName.includes('glm')) return 'Z.ai';
  if (cleanId.startsWith('sakana/') || cleanName.includes('sakana')) return 'Sakana AI';
  if (cleanId.startsWith('mistralai/') || cleanName.includes('mistral') || cleanName.includes('codestral')) return 'Mistral AI';
  if (cleanId.startsWith('ibm-granite/') || cleanName.includes('granite')) return 'IBM';
  if (cleanId.startsWith('inclusionai/') || cleanName.includes('ling 3')) return 'InclusionAI';
  if (cleanId.startsWith('cohere/')) return 'Cohere';
  if (cleanId.startsWith('x-ai/') || cleanName.includes('grok')) return 'xAI';

  const parts = cleanId.split('/');
  if (parts.length > 1) {
    const rawVendor = parts[0];
    return rawVendor.charAt(0).toUpperCase() + rawVendor.slice(1);
  }
  return 'Other';
}

export function processRawModel(raw: OpenRouterModelRaw): ProcessedModel {
  const promptVal = parseFloat(raw.pricing?.prompt || '0');
  const completionVal = parseFloat(raw.pricing?.completion || '0');
  
  const promptCostPerM = promptVal * 1_000_000;
  const completionCostPerM = completionVal * 1_000_000;
  const blendedCostPerM = (promptCostPerM * 3 + completionCostPerM) / 4;
  
  const provider = extractProvider(raw.id, raw.name);
  
  let arenaElo: number | null = null;
  if (raw.benchmarks?.design_arena && raw.benchmarks.design_arena.length > 0) {
    const maxElo = Math.max(...raw.benchmarks.design_arena.map(b => b.elo));
    if (!isNaN(maxElo)) arenaElo = maxElo;
  }

  const shortName = raw.name.replace(/^(OpenAI|Anthropic|Google|DeepSeek|Meta|Qwen|Z\.ai|Sakana|Mistral|IBM|inclusionAI):\s*/i, '');

  return {
    id: raw.id,
    name: raw.name,
    shortName,
    provider,
    description: raw.description || 'No description provided.',
    created: raw.created || 0,
    contextLength: raw.context_length || 0,
    maxCompletionTokens: raw.top_provider?.max_completion_tokens || 0,
    
    promptCostPerM,
    completionCostPerM,
    blendedCostPerM,
    isFree: promptCostPerM === 0 && completionCostPerM === 0,
    
    intelligenceIndex: raw.benchmarks?.artificial_analysis?.intelligence_index ?? null,
    codingIndex: raw.benchmarks?.artificial_analysis?.coding_index ?? null,
    agenticIndex: raw.benchmarks?.artificial_analysis?.agentic_index ?? null,
    arenaElo,
    
    isMultimodal: (raw.architecture?.input_modalities?.length || 0) > 1,
    inputModalities: raw.architecture?.input_modalities || ['text'],
    outputModalities: raw.architecture?.output_modalities || ['text'],
    hasReasoning: !!raw.reasoning,
    reasoningEfforts: raw.reasoning?.supported_efforts || [],
    isModerated: !!raw.top_provider?.is_moderated,
    raw
  };
}

export function getInitialModels(): ProcessedModel[] {
  return (snapshotData as OpenRouterModelRaw[]).map(processRawModel);
}

export async function fetchLiveModels(): Promise<ProcessedModel[]> {
  const response = await fetch('https://openrouter.ai/api/v1/models');
  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${response.statusText}`);
  }
  const json = await response.json();
  if (Array.isArray(json.data)) {
    return json.data.map(processRawModel);
  }
  throw new Error('Invalid OpenRouter API format');
}

export function getMetricValue(model: ProcessedModel, metricKey: AxisMetricKey): number | null {
  switch (metricKey) {
    case 'blendedCostPerM': return model.blendedCostPerM;
    case 'promptCostPerM': return model.promptCostPerM;
    case 'completionCostPerM': return model.completionCostPerM;
    case 'intelligenceIndex': return model.intelligenceIndex;
    case 'codingIndex': return model.codingIndex;
    case 'agenticIndex': return model.agenticIndex;
    case 'contextLength': return model.contextLength;
    case 'arenaElo': return model.arenaElo;
    default: return null;
  }
}

// Pareto Frontier Calculation
export function calculateParetoFrontier(
  models: ProcessedModel[], 
  xKey: AxisMetricKey, 
  yKey: AxisMetricKey
): ProcessedModel[] {
  const isXCost = xKey.toLowerCase().includes('cost');
  const isYCost = yKey.toLowerCase().includes('cost');

  const validModels = models.filter(m => {
    const x = getMetricValue(m, xKey);
    const y = getMetricValue(m, yKey);
    return x !== null && y !== null && !isNaN(x) && !isNaN(y);
  });

  const frontier: ProcessedModel[] = [];

  for (const m of validModels) {
    const mx = getMetricValue(m, xKey)!;
    const my = getMetricValue(m, yKey)!;

    let isDominated = false;
    for (const other of validModels) {
      if (other.id === m.id) continue;
      const ox = getMetricValue(other, xKey)!;
      const oy = getMetricValue(other, yKey)!;

      // Better or equal on X:
      const xBetterOrEqual = isXCost ? ox <= mx : ox >= mx;
      // Better or equal on Y:
      const yBetterOrEqual = isYCost ? oy <= my : oy >= my;

      // Strictly better on at least one:
      const xStrictlyBetter = isXCost ? ox < mx : ox > mx;
      const yStrictlyBetter = isYCost ? oy < my : oy > my;

      if (xBetterOrEqual && yBetterOrEqual && (xStrictlyBetter || yStrictlyBetter)) {
        isDominated = true;
        break;
      }
    }

    if (!isDominated) {
      frontier.push(m);
    }
  }

  // Sort frontier for drawing connected line
  return frontier.sort((a, b) => {
    const ax = getMetricValue(a, xKey)!;
    const bx = getMetricValue(b, xKey)!;
    return ax - bx;
  });
}

// Find Knee Point (Elbow) Model using Kneedle Algorithm
export function findKneePointModel(
  paretoModels: ProcessedModel[],
  xKey: AxisMetricKey,
  yKey: AxisMetricKey,
  isXLog: boolean = false,
  isYLog: boolean = false
): ProcessedModel | null {
  if (paretoModels.length < 3) return null;

  // Cap candidate models to sub-$2.50/1M to avoid extreme $20/1M flagship outliers distorting the baseline chord
  const isXCost = xKey.toLowerCase().includes('cost');
  let candidateModels = paretoModels;
  if (isXCost) {
    const budgetModels = paretoModels.filter(m => getMetricValue(m, xKey)! <= 2.5);
    if (budgetModels.length >= 3) {
      candidateModels = budgetModels;
    }
  }

  const getX = (m: ProcessedModel) => {
    const rawX = getMetricValue(m, xKey)!;
    return isXLog ? Math.log10(rawX + 0.001) : rawX;
  };
  const getY = (m: ProcessedModel) => {
    const rawY = getMetricValue(m, yKey)!;
    return isYLog ? Math.log10(rawY + 0.001) : rawY;
  };

  const minX = getX(candidateModels[0]);
  const maxX = getX(candidateModels[candidateModels.length - 1]);
  const minY = getY(candidateModels[0]);
  const maxY = getY(candidateModels[candidateModels.length - 1]);

  if (maxX === minX || maxY === minY) return null;

  let maxDist = -Infinity;
  let kneeModel: ProcessedModel | null = null;

  candidateModels.forEach(m => {
    const nx = (getX(m) - minX) / (maxX - minX);
    const ny = (getY(m) - minY) / (maxY - minY);
    // Perpendicular distance to baseline secant line
    const dist = (ny - nx) / Math.sqrt(2);
    if (dist > maxDist) {
      maxDist = dist;
      kneeModel = m;
    }
  });

  return maxDist > 0.02 ? kneeModel : null;
}
