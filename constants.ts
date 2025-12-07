
import { BackgroundPreset, QualityMode, LightingIntensity, ColorGradingStyle, PromptSuggestion } from "./types";

export const DEFAULT_PROMPT = `Cinematic studio portrait style, extremely detailed and ultra realistic face with natural skin pores, fine textures, and authentic features, sharp focus on facial details, vibrant yet natural colors, realistic three-dimensional lighting and shadows, dramatic but soft cinematic studio lighting, smooth depth of field, professional cinematic color grading, bright and attractive background, hyper-detailed, lifelike`;

export const QUALITY_MODIFIERS: Record<QualityMode, string> = {
  standard: "",
  high: ", 4K resolution, masterpiece quality, high-end editorial photography style"
};

export const LIGHTING_STYLES: Record<LightingIntensity, string> = {
  soft: "soft diffused studio lighting, gentle shadows, flattering portrait light, evenly lit",
  cinematic: "cinematic three-dimensional lighting, professional studio setup, dramatic key light, balanced contrast, rim light",
  dramatic: "dramatic lighting, strong key light, deep mysterious shadows, high contrast chiaroscuro",
  intense: "intense mood lighting, harsh shadows, edgy look, strong backlight"
};

export const COLOR_GRADING_STYLES: Record<ColorGradingStyle, string> = {
  none: "",
  warm_vintage: "warm vintage color grading, nostalgic tones, golden hour feel, kodak portra style",
  cool_noir: "cool noir cinematic tones, desaturated blues, moody atmosphere, matrix green tint",
  teal_orange: "vibrant teal and orange cinematic color grading, hollywood blockbuster look, complementary colors",
  classic_bw: "classic black and white photography, high contrast monochrome, timeless silver screen look"
};

export const MODEL_NAME = 'gemini-2.5-flash-image';

export const BACKGROUND_PRESETS: BackgroundPreset[] = [
  { id: 'default', labelKey: 'bgDefault', prompt: '', color: 'linear-gradient(135deg, #374151 50%, #1f2937 50%)' },
  { id: 'studio_dark', labelKey: 'bgStudioDark', prompt: 'clean dark grey professional studio background', color: '#333333' },
  { id: 'studio_light', labelKey: 'bgStudioLight', prompt: 'clean bright off-white professional studio background', color: '#e5e5e5' },
  { id: 'solid_black', labelKey: 'bgSolidBlack', prompt: 'solid pitch black background', color: '#000000' },
  { id: 'solid_white', labelKey: 'bgSolidWhite', prompt: 'solid pure white background', color: '#ffffff' },
  { id: 'bokeh', labelKey: 'bgBokeh', prompt: 'warm cinematic bokeh blurred lights background', color: 'linear-gradient(45deg, #fbbf24, #b45309)' },
  { id: 'city', labelKey: 'bgCity', prompt: 'blurred city night lights background', color: 'linear-gradient(45deg, #3b82f6, #1e3a8a)' },
  { id: 'nature', labelKey: 'bgNature', prompt: 'blurred lush green nature background', color: 'linear-gradient(45deg, #22c55e, #14532d)' },
];

export const PROMPT_SUGGESTIONS: PromptSuggestion[] = [
  { id: 'noir', labelKey: 'styleNoir', prompt: 'film noir style, high contrast black and white, dramatic venetian blind shadows, mystery, 1940s aesthetic', color: 'from-gray-900 to-black' },
  { id: 'cyberpunk', labelKey: 'styleCyberpunk', prompt: 'cyberpunk style, neon blue and pink lighting, futuristic atmosphere, rain-slicked reflections, chromatic aberration', color: 'from-pink-600 to-blue-600' },
  { id: 'fantasy', labelKey: 'styleFantasy', prompt: 'ethereal fantasy portrait, magical glowing lighting, soft dreamlike focus, intricate details, elven aesthetic', color: 'from-purple-500 to-indigo-500' },
  { id: 'vintage', labelKey: 'styleVintage', prompt: 'vintage 1950s photography, warm sepia tones, film grain, analog camera aesthetic, nostalgic feel', color: 'from-orange-700 to-yellow-600' },
  { id: 'fashion', labelKey: 'styleFashion', prompt: 'high fashion editorial, avant-garde makeup, bold styling, clean minimalist background, sharp focus', color: 'from-red-600 to-rose-500' },
];

export const LOADING_MESSAGES = [
  "loadAnalyzing",
  "loadEnhancing",
  "loadLighting",
  "loadColor",
  "loadFinalizing"
];
