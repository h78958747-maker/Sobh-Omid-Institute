
export interface GeneratedImageResult {
  imageUrl: string;
  timestamp: number;
}

export interface ProcessingState {
  isLoading: boolean;
  error: string | null;
}

export type AspectRatio = '1:1' | '3:4' | '4:3' | '9:16' | '16:9' | '21:9' | 'AUTO';

export type QualityMode = 'standard' | 'high';

export type LightingIntensity = 'soft' | 'cinematic' | 'dramatic' | 'intense';

export type ColorGradingStyle = 'none' | 'warm_vintage' | 'cool_noir' | 'teal_orange' | 'classic_bw';

export interface HistoryItem {
  id: string;
  imageUrl: string;
  prompt: string;
  aspectRatio: AspectRatio;
  timestamp: number;
  // Restore state
  skinTexture?: boolean;
  faceDetail?: number;
  lighting?: LightingIntensity;
  colorGrading?: ColorGradingStyle;
}

export type Language = 'en' | 'fa';
export type Theme = 'light' | 'dark';

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface SavedPrompt {
  id: string;
  name: string;
  text: string;
}

export interface BackgroundPreset {
  id: string;
  labelKey: string;
  prompt: string;
  color?: string; // CSS color for the UI circle
}

export interface BackgroundConfig {
  type: 'preset' | 'custom_color';
  value: string; // preset id or hex code
}

export interface PromptSuggestion {
  id: string;
  labelKey: string;
  prompt: string;
  color: string;
}

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    aistudio?: AIStudio;
  }
}