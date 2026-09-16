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

export const T2I_LEADERBOARD_ELO_MAP: Record<string, number> = {
  'google/gemini-3.1-flash-image': 1279,
  'google/gemini-3.1-flash-image-preview': 1279,
  'google/gemini-3-pro-image': 1246,
  'google/gemini-3-pro-image-preview': 1246,
  'black-forest-labs/flux-2-pro': 1225,
  'google/gemini-3.1-flash-lite-image': 1220,
  'black-forest-labs/flux-2-flex': 1218,
  'black-forest-labs/flux-1.1-pro': 1215,
  'recraft-ai/recraft-v3': 1210,
  'openai/gpt-5.4-image-2': 1205,
  'ideogram/ideogram-v2': 1195,
  'openai/gpt-5-image': 1194,
  'google/gemini-2.5-flash-image': 1189,
  'openai/gpt-5-image-mini': 1186,
  'midjourney/midjourney-v6.1': 1180,
  'bytedance-seed/seedream-4.5': 1175,
  'black-forest-labs/flux-1-dev': 1150,
  'stability-ai/sd3.5-large': 1120,
  'openai/dall-e-3': 1090,
  'black-forest-labs/flux-1-schnell': 1080,
  'stability-ai/sdxl-1.0': 1050,
};

export const EXTRA_IMAGE_MODELS: OpenRouterModelRaw[] = [
  {
    id: 'black-forest-labs/flux-2-pro',
    name: 'Black Forest Labs: FLUX 2 [pro]',
    description: 'Black Forest Labs next-generation FLUX 2 pro image model with supreme visual clarity and prompt adherence.',
    context_length: 4096,
    pricing: { prompt: '0.00000125', completion: '0.000005', image_output: '0.05' },
    architecture: { modality: 'text->image', input_modalities: ['text'], output_modalities: ['image'] }
  },
  {
    id: 'black-forest-labs/flux-2-flex',
    name: 'Black Forest Labs: FLUX 2 [flex]',
    description: 'Black Forest Labs versatile FLUX 2 model optimized for fast flexible image rendering.',
    context_length: 4096,
    pricing: { prompt: '0.000001', completion: '0.000004', image_output: '0.04' },
    architecture: { modality: 'text->image', input_modalities: ['text'], output_modalities: ['image'] }
  },
  {
    id: 'google/gemini-3.1-flash-image',
    name: 'Google: Nano Banana 2 (Gemini 3.1 Flash Image)',
    description: 'Google state-of-the-art native image generation and editing model with advanced reasoning.',
    context_length: 128000,
    pricing: { prompt: '0.00000075', completion: '0.00000375', image_output: '0.03' },
    architecture: { modality: 'text+image->text+image', input_modalities: ['text', 'image'], output_modalities: ['image', 'text'] }
  },
  {
    id: 'google/gemini-3-pro-image',
    name: 'Google: Nano Banana Pro (Gemini 3 Pro Image)',
    description: 'Google flagship pro-grade text-to-image synthesis model.',
    context_length: 128000,
    pricing: { prompt: '0.000002', completion: '0.000010', image_output: '0.08' },
    architecture: { modality: 'text+image->text+image', input_modalities: ['text', 'image'], output_modalities: ['image', 'text'] }
  },
  {
    id: 'black-forest-labs/flux-1.1-pro',
    name: 'Black Forest Labs: FLUX 1.1 [pro]',
    description: 'State-of-the-art text-to-image generation by Black Forest Labs with hyper-realistic detail.',
    context_length: 4096,
    pricing: { prompt: '0.000001', completion: '0.000004', image_output: '0.04' },
    architecture: { modality: 'text->image', input_modalities: ['text'], output_modalities: ['image'] }
  },
  {
    id: 'recraft-ai/recraft-v3',
    name: 'Recraft: Recraft V3 (20B)',
    description: 'Top-rated graphic design, vector art, and photorealistic raster image generation model.',
    context_length: 4096,
    pricing: { prompt: '0.000001', completion: '0.000004', image_output: '0.04' },
    architecture: { modality: 'text->image', input_modalities: ['text'], output_modalities: ['image'] }
  },
  {
    id: 'openai/gpt-5.4-image-2',
    name: 'OpenAI: GPT-5.4 Image 2',
    description: 'OpenAI advanced multimodal image output generator with fine image detail and text rendering.',
    context_length: 128000,
    pricing: { prompt: '0.00000125', completion: '0.000005', image_output: '0.05' },
    architecture: { modality: 'text+image->text+image', input_modalities: ['text', 'image'], output_modalities: ['image', 'text'] }
  },
  {
    id: 'ideogram/ideogram-v2',
    name: 'Ideogram: Ideogram v2',
    description: 'Industry leader in accurate typography rendering, text-in-image design, and poster art.',
    context_length: 4096,
    pricing: { prompt: '0.000002', completion: '0.000008', image_output: '0.08' },
    architecture: { modality: 'text->image', input_modalities: ['text'], output_modalities: ['image'] }
  },
  {
    id: 'openai/gpt-5-image',
    name: 'OpenAI: GPT-5 Image',
    description: 'OpenAI native text-to-image synthesis model.',
    context_length: 128000,
    pricing: { prompt: '0.000001', completion: '0.000004', image_output: '0.04' },
    architecture: { modality: 'text+image->text+image', input_modalities: ['text', 'image'], output_modalities: ['image', 'text'] }
  },
  {
    id: 'google/gemini-2.5-flash-image',
    name: 'Google: Nano Banana (Gemini 2.5 Flash Image)',
    description: 'Fast, cost-effective multimodal image output model.',
    context_length: 64000,
    pricing: { prompt: '0.0000005', completion: '0.000002', image_output: '0.02' },
    architecture: { modality: 'text+image->text+image', input_modalities: ['text', 'image'], output_modalities: ['image', 'text'] }
  },
  {
    id: 'openai/gpt-5-image-mini',
    name: 'OpenAI: GPT-5 Image Mini',
    description: 'Lightweight, fast image generation model by OpenAI.',
    context_length: 64000,
    pricing: { prompt: '0.0000004', completion: '0.0000015', image_output: '0.015' },
    architecture: { modality: 'text+image->text+image', input_modalities: ['text', 'image'], output_modalities: ['image', 'text'] }
  },
  {
    id: 'midjourney/midjourney-v6.1',
    name: 'Midjourney: Midjourney v6.1',
    description: 'Renowned aesthetic text-to-image generator known for cinematic lighting and artistic style.',
    context_length: 4096,
    pricing: { prompt: '0.00000125', completion: '0.000005', image_output: '0.05' },
    architecture: { modality: 'text->image', input_modalities: ['text'], output_modalities: ['image'] }
  },
  {
    id: 'bytedance-seed/seedream-4.5',
    name: 'ByteDance Seed: Seedream 4.5',
    description: 'ByteDance in-house image generation model with high editing consistency, portrait refinement, and text rendering.',
    context_length: 4096,
    pricing: { prompt: '0.000001', completion: '0.000004', image_output: '0.04' },
    architecture: { modality: 'text->image', input_modalities: ['text'], output_modalities: ['image'] }
  },
  {
    id: 'black-forest-labs/flux-1-dev',
    name: 'Black Forest Labs: FLUX.1 [dev]',
    description: 'Open-weights 12B parameter guidance-distilled model by Black Forest Labs.',
    context_length: 4096,
    pricing: { prompt: '0.0000006', completion: '0.0000025', image_output: '0.025' },
    architecture: { modality: 'text->image', input_modalities: ['text'], output_modalities: ['image'] }
  },
  {
    id: 'stability-ai/sd3.5-large',
    name: 'Stability AI: Stable Diffusion 3.5 Large',
    description: 'Stability AI 8B Multimodal Diffusion Transformer (MMDiT) flagship image generator.',
    context_length: 4096,
    pricing: { prompt: '0.00000075', completion: '0.000003', image_output: '0.03' },
    architecture: { modality: 'text->image', input_modalities: ['text'], output_modalities: ['image'] }
  },
  {
    id: 'openai/dall-e-3',
    name: 'OpenAI: DALL·E 3',
    description: 'OpenAI classic text-to-image model integrated into ChatGPT and OpenAI API.',
    context_length: 4096,
    pricing: { prompt: '0.000001', completion: '0.000004', image_output: '0.04' },
    architecture: { modality: 'text->image', input_modalities: ['text'], output_modalities: ['image'] }
  },
  {
    id: 'black-forest-labs/flux-1-schnell',
    name: 'Black Forest Labs: FLUX.1 [schnell]',
    description: 'Ultra-fast 4-step distilled open-weights image generator.',
    context_length: 4096,
    pricing: { prompt: '0.0000001', completion: '0.0000003', image_output: '0.003' },
    architecture: { modality: 'text->image', input_modalities: ['text'], output_modalities: ['image'] }
  },
  {
    id: 'stability-ai/sdxl-1.0',
    name: 'Stability AI: SDXL 1.0',
    description: 'High-resolution open-weights latent diffusion model.',
    context_length: 4096,
    pricing: { prompt: '0.00000005', completion: '0.0000002', image_output: '0.002' },
    architecture: { modality: 'text->image', input_modalities: ['text'], output_modalities: ['image'] }
  }
];

export function processRawModel(raw: OpenRouterModelRaw): ProcessedModel {
  const promptVal = parseFloat(raw.pricing?.prompt || '0');
  const completionVal = parseFloat(raw.pricing?.completion || '0');
  
  const promptCostPerM = promptVal * 1_000_000;
  const completionCostPerM = completionVal * 1_000_000;
  const blendedCostPerM = (promptCostPerM * 3 + completionCostPerM) / 4;
  
  const provider = extractProvider(raw.id, raw.name);
  
  let arenaElo: number | null = null;
  let t2iLeaderboardElo: number | null = T2I_LEADERBOARD_ELO_MAP[raw.id] ?? null;

  if (raw.benchmarks?.design_arena && raw.benchmarks.design_arena.length > 0) {
    const maxElo = Math.max(...raw.benchmarks.design_arena.map(b => b.elo));
    if (!isNaN(maxElo) && maxElo > 0) arenaElo = maxElo;

    if (t2iLeaderboardElo === null) {
      const imgCat = raw.benchmarks.design_arena.find(b => b.category === 'image' || b.category === 'graphicdesign');
      if (imgCat && !isNaN(imgCat.elo) && imgCat.elo > 0) t2iLeaderboardElo = imgCat.elo;
    }
  }

  const shortName = raw.name.replace(/^(OpenAI|Anthropic|Google|DeepSeek|Meta|Qwen|Z\.ai|Sakana|Mistral|IBM|inclusionAI|Black Forest Labs|Recraft|Ideogram|Midjourney|ByteDance Seed|Stability AI):\s*/i, '');
  const outputModalities = raw.architecture?.output_modalities || ['text'];
  const isImageOutput = outputModalities.includes('image') || !!raw.pricing?.image_output || t2iLeaderboardElo !== null;

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
    t2iLeaderboardElo,
    arenaElo,
    
    isMultimodal: (raw.architecture?.input_modalities?.length || 0) > 1,
    isImageOutput,
    inputModalities: raw.architecture?.input_modalities || ['text'],
    outputModalities,
    hasReasoning: !!raw.reasoning,
    reasoningEfforts: raw.reasoning?.supported_efforts || [],
    isModerated: !!raw.top_provider?.is_moderated,
    raw
  };
}

export function getInitialModels(): ProcessedModel[] {
  const base = (snapshotData as OpenRouterModelRaw[]).map(processRawModel);
  const extra = EXTRA_IMAGE_MODELS.map(processRawModel);
  const existingIds = new Set(base.map((m: ProcessedModel) => m.id));
  const newExtras = extra.filter((m: ProcessedModel) => !existingIds.has(m.id));
  return [...base, ...newExtras];
}

export async function fetchLiveModels(): Promise<ProcessedModel[]> {
  const response = await fetch('https://openrouter.ai/api/v1/models');
  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${response.statusText}`);
  }
  const json = await response.json();
  if (Array.isArray(json.data)) {
    const live = json.data.map(processRawModel);
    const extra = EXTRA_IMAGE_MODELS.map(processRawModel);
    const liveIds = new Set(live.map((m: ProcessedModel) => m.id));
    const newExtras = extra.filter((m: ProcessedModel) => !liveIds.has(m.id));
    return [...live, ...newExtras];
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
    case 't2iLeaderboardElo': return model.t2iLeaderboardElo;
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

// Helper Kneedle calculation
function calculateKneedle(
  models: ProcessedModel[],
  xKey: AxisMetricKey,
  yKey: AxisMetricKey,
  isXLog: boolean,
  isYLog: boolean
): ProcessedModel | null {
  if (models.length < 3) return null;

  const getX = (m: ProcessedModel) => {
    const rawX = getMetricValue(m, xKey)!;
    return isXLog ? Math.log10(rawX + 0.001) : rawX;
  };
  const getY = (m: ProcessedModel) => {
    const rawY = getMetricValue(m, yKey)!;
    return isYLog ? Math.log10(rawY + 0.001) : rawY;
  };

  const minX = getX(models[0]);
  const maxX = getX(models[models.length - 1]);
  const minY = getY(models[0]);
  const maxY = getY(models[models.length - 1]);

  if (maxX === minX || maxY === minY) return null;

  let maxDist = -Infinity;
  let kneeModel: ProcessedModel | null = null;

  models.forEach(m => {
    const nx = (getX(m) - minX) / (maxX - minX);
    const ny = (getY(m) - minY) / (maxY - minY);
    const dist = (ny - nx) / Math.sqrt(2);
    if (dist > maxDist) {
      maxDist = dist;
      kneeModel = m;
    }
  });

  return maxDist > 0.015 ? kneeModel : null;
}

export interface KneeWinners {
  budgetKnee: ProcessedModel | null;
  sotaKnee: ProcessedModel | null;
}

// Find both Marginal Gain Rule Winners (Best Budget Knee & Best SOTA Knee)
export function findMarginalGainWinners(
  paretoModels: ProcessedModel[],
  xKey: AxisMetricKey,
  yKey: AxisMetricKey,
  isXLog: boolean = false,
  isYLog: boolean = false
): KneeWinners {
  if (paretoModels.length < 2) {
    return { budgetKnee: paretoModels[0] || null, sotaKnee: null };
  }

  // 1. Overall SOTA Knee (Full Range Pareto curve)
  const fullKnee = calculateKneedle(paretoModels, xKey, yKey, isXLog, isYLog);

  // 2. Budget Tier Knee (capped to sub-$2.50 or lower 60% range)
  const isXCost = xKey.toLowerCase().includes('cost');
  let budgetKnee: ProcessedModel | null = null;

  if (isXCost) {
    const maxCostLimit = Math.max(2.5, (getMetricValue(paretoModels[0], xKey) ?? 0) * 10);
    const budgetCandidates = paretoModels.filter(m => (getMetricValue(m, xKey) ?? Infinity) <= maxCostLimit);
    if (budgetCandidates.length >= 3) {
      budgetKnee = calculateKneedle(budgetCandidates, xKey, yKey, isXLog, isYLog);
    }
  }

  if (!budgetKnee) {
    const halfSlice = paretoModels.slice(0, Math.max(2, Math.ceil(paretoModels.length * 0.6)));
    budgetKnee = calculateKneedle(halfSlice, xKey, yKey, isXLog, isYLog) || paretoModels[0];
  }

  const finalBudget = budgetKnee || fullKnee;
  const finalSota = (fullKnee && fullKnee.id !== finalBudget?.id) ? fullKnee : null;

  return {
    budgetKnee: finalBudget,
    sotaKnee: finalSota
  };
}

// Find the Value Recovery model: above the Budget Knee, a Pareto front built
// from multiple independently-priced model families is rarely a smooth curve —
// one family's tier often buys little (a "dip" in marginal value per log-dollar)
// before the next family's tier resumes a good rate. This flags the model right
// after the steepest such dip-then-rebound, i.e. the first point past the dip
// where you're clearly buying real capability again, without singling out any
// fixed price ceiling.
//
// A rebound sitting at the very top of the observed price range is inherently
// less trustworthy than one in the interior: it only has support/corroboration
// on one side (nothing pricier exists to confirm the trend), the classic
// boundary-bias problem in local regression/kernel estimation. Rather than a
// hard rule that excludes the priciest model outright (fragile — it doesn't
// generalize across metrics, families or thin frontiers like Text-to-Image),
// each candidate's rate is scaled by how close it sits to the *center* of the
// frontier's own price range: 0 at either extreme, 1 at the exact center, with
// a floor so it's a handicap, never a disqualification. See "How the Chart
// Recommends Models" below the catalog table for the full derivation.
const VALUE_RECOVERY_RATIO_THRESHOLD = 1.3;
const VALUE_RECOVERY_BOUNDARY_WEIGHT_FLOOR = 0.15;

export function findValueRecoveryModel(
  paretoModels: ProcessedModel[],
  xKey: AxisMetricKey,
  yKey: AxisMetricKey,
  isXLog: boolean,
  isYLog: boolean,
  budgetKnee: ProcessedModel | null
): ProcessedModel | null {
  if (!budgetKnee) return null;

  const budgetIndex = paretoModels.findIndex(m => m.id === budgetKnee.id);
  if (budgetIndex === -1) return null;

  // Only the tier at-or-above the Budget Knee's price is relevant.
  const upperTier = paretoModels.slice(budgetIndex);
  if (upperTier.length < 3) return null;

  const tx = (m: ProcessedModel) => {
    const raw = getMetricValue(m, xKey)!;
    return isXLog ? Math.log10(raw + 0.001) : raw;
  };
  const ty = (m: ProcessedModel) => {
    const raw = getMetricValue(m, yKey)!;
    return isYLog ? Math.log10(raw + 0.001) : raw;
  };

  // Marginal rate of return (Y gained per unit of X) for each consecutive step.
  const xPositions = upperTier.map(tx);
  const slopes: number[] = [];
  for (let i = 0; i < upperTier.length - 1; i++) {
    const dx = xPositions[i + 1] - xPositions[i];
    const dy = ty(upperTier[i + 1]) - ty(upperTier[i]);
    slopes.push(dx !== 0 ? dy / dx : 0);
  }

  const rangeStart = xPositions[0];
  const rangeEnd = xPositions[xPositions.length - 1];
  const halfRange = (rangeEnd - rangeStart) / 2;

  // A step only qualifies as a genuine "rebound" if its rate is meaningfully
  // better than the step immediately before it (a local minimum in the rate
  // sequence). Among qualifying rebounds, rank by absolute rate discounted by
  // boundary distance, not by raw rate or ratio alone — see comment above.
  let bestScore = -Infinity;
  let recoveryIndex = -1;

  for (let i = 1; i < slopes.length; i++) {
    const rateIntoDip = slopes[i - 1];
    const rateOutOfDip = slopes[i];
    if (rateIntoDip <= 0) continue;

    const ratio = rateOutOfDip / rateIntoDip;
    if (ratio <= VALUE_RECOVERY_RATIO_THRESHOLD) continue;

    const candidateIndex = i + 1;
    const boundaryDistance = halfRange > 0
      ? Math.min(xPositions[candidateIndex] - rangeStart, rangeEnd - xPositions[candidateIndex]) / halfRange
      : 0;
    const weight = VALUE_RECOVERY_BOUNDARY_WEIGHT_FLOOR + (1 - VALUE_RECOVERY_BOUNDARY_WEIGHT_FLOOR) * boundaryDistance;
    const score = rateOutOfDip * weight;

    if (score > bestScore) {
      bestScore = score;
      recoveryIndex = candidateIndex;
    }
  }

  return recoveryIndex >= 0 ? upperTier[recoveryIndex] : null;
}
