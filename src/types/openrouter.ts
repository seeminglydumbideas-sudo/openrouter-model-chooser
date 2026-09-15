export interface OpenRouterModelRaw {
  id: string;
  name: string;
  canonical_slug?: string;
  hugging_face_id?: string | null;
  created?: number;
  description?: string;
  context_length: number;
  architecture?: {
    modality?: string;
    input_modalities?: string[];
    output_modalities?: string[];
    tokenizer?: string;
    instruct_type?: string | null;
  };
  pricing: {
    prompt: string;
    completion: string;
    input_cache_read?: string;
    input_cache_write?: string;
    web_search?: string;
    internal_reasoning?: string;
    image?: string;
    image_output?: string;
    [key: string]: string | undefined;
  };
  top_provider?: {
    context_length: number;
    max_completion_tokens?: number;
    is_moderated?: boolean;
  };
  supported_parameters?: string[];
  benchmarks?: {
    artificial_analysis?: {
      intelligence_index?: number | null;
      coding_index?: number | null;
      agentic_index?: number | null;
    };
    design_arena?: Array<{
      arena: string;
      category: string;
      elo: number;
      win_rate: number;
      rank: number;
    }>;
  };
  reasoning?: {
    mandatory?: boolean;
    default_enabled?: boolean;
    supported_efforts?: string[];
    default_effort?: string;
  };
}

export interface ProcessedModel {
  id: string;
  name: string;
  shortName: string;
  provider: string;
  description: string;
  created: number;
  contextLength: number;
  maxCompletionTokens: number;
  
  // Pricing ($ per 1M tokens)
  promptCostPerM: number;
  completionCostPerM: number;
  blendedCostPerM: number; // (3*prompt + completion)/4
  isFree: boolean;
  
  // Benchmarks
  intelligenceIndex: number | null;
  codingIndex: number | null;
  agenticIndex: number | null;
  t2iLeaderboardElo: number | null;
  
  // Design Arena highest Elo if available
  arenaElo: number | null;
  
  // Capabilities
  isMultimodal: boolean;
  isImageOutput: boolean;
  inputModalities: string[];
  outputModalities: string[];
  hasReasoning: boolean;
  reasoningEfforts: string[];
  isModerated: boolean;
  raw: OpenRouterModelRaw;
}

export type AxisMetricKey = 
  | 'blendedCostPerM' 
  | 'promptCostPerM' 
  | 'completionCostPerM' 
  | 'intelligenceIndex' 
  | 'codingIndex' 
  | 'agenticIndex' 
  | 't2iLeaderboardElo'
  | 'contextLength' 
  | 'arenaElo';

export interface AxisOption {
  key: AxisMetricKey;
  label: string;
  unit: string;
  description: string;
  format: (val: number | null) => string;
  isLogDefault?: boolean;
}

export const AXIS_OPTIONS: AxisOption[] = [
  {
    key: 'blendedCostPerM',
    label: 'Blended Cost ($ / 1M Tokens)',
    unit: '$',
    description: 'Calculated using a standard 3:1 input to output token ratio',
    format: (val) => val === 0 ? 'Free' : val !== null ? `$${val.toFixed( val < 0.1 ? 4 : 2 )}` : 'N/A',
    isLogDefault: true
  },
  {
    key: 'promptCostPerM',
    label: 'Prompt Cost ($ / 1M Tokens)',
    unit: '$',
    description: 'Cost per 1 million input tokens',
    format: (val) => val === 0 ? 'Free' : val !== null ? `$${val.toFixed( val < 0.1 ? 4 : 2 )}` : 'N/A',
    isLogDefault: true
  },
  {
    key: 'completionCostPerM',
    label: 'Completion Cost ($ / 1M Tokens)',
    unit: '$',
    description: 'Cost per 1 million generated output tokens',
    format: (val) => val === 0 ? 'Free' : val !== null ? `$${val.toFixed( val < 0.1 ? 4 : 2 )}` : 'N/A',
    isLogDefault: true
  },
  {
    key: 'intelligenceIndex',
    label: 'Intelligence Index',
    unit: 'pts',
    description: 'Artificial Analysis overall intelligence rating benchmark',
    format: (val) => val !== null ? `${val.toFixed(1)}` : 'N/A'
  },
  {
    key: 'codingIndex',
    label: 'Coding Index',
    unit: 'pts',
    description: 'Benchmark rating for software engineering & code generation',
    format: (val) => val !== null ? `${val.toFixed(1)}` : 'N/A'
  },
  {
    key: 'agenticIndex',
    label: 'Agentic Index',
    unit: 'pts',
    description: 'Benchmark score for multi-step tool use & agent workflows',
    format: (val) => val !== null ? `${val.toFixed(1)}` : 'N/A'
  },
  {
    key: 't2iLeaderboardElo',
    label: 'HuggingFace Text-to-Image ELO',
    unit: 'Elo',
    description: 'Artificial Analysis / Hugging Face Text-to-Image Arena ELO rating',
    format: (val) => val !== null ? `${Math.round(val)}` : 'N/A'
  },
  {
    key: 'contextLength',
    label: 'Context Window (Tokens)',
    unit: 'k tok',
    description: 'Maximum context length in tokens',
    format: (val) => val !== null ? (val >= 1_000_000 ? `${(val/1_000_000).toFixed(1)}M` : `${Math.round(val/1000)}k`) : 'N/A',
    isLogDefault: true
  },
  {
    key: 'arenaElo',
    label: 'Design Arena ELO (Overall)',
    unit: 'Elo',
    description: 'Design Arena benchmark ELO rating across visual/coding tasks',
    format: (val) => val !== null ? `${Math.round(val)}` : 'N/A'
  }
];

export interface QuickPreset {
  id: string;
  title: string;
  description: string;
  icon: string;
  xAxis: AxisMetricKey;
  yAxis: AxisMetricKey;
  xLog?: boolean;
  yLog?: boolean;
  filterProvider?: string;
  filterReasoningOnly?: boolean;
  filterFreeOnly?: boolean;
  minContext?: number;
}
