export type Channel = 'ttd' | 'linkedin' | 'sixsense' | 'meta';

export type AssetSetKey = 'full' | 'ttd' | 'linkedin' | 'sixsense' | 'meta';

export interface AssetSpec {
  width: number;
  height: number;
  channel: Channel;
  formats: Array<'jpg' | 'png'>;
  /** Max file size in KB */
  maxFileSizeKB: number;
  /** Human label e.g. "300×250" */
  label: string;
  /** Unique key for selection state */
  key: string;
}

export interface GradientParams {
  seed: number;
  /** 0–1 relative horizontal glow centre */
  glowX: number;
  /** 0–1 relative vertical glow centre */
  glowY: number;
  /** 0–1 relative glow radius (relative to max canvas dimension) */
  glowRadius: number;
  /** HSL hue of the primary glow (0–360) */
  glowHue: number;
  /** HSL saturation of glow (0–100) */
  glowSat: number;
  /** HSL lightness of glow centre (0–100) */
  glowLit: number;
  /** Glow opacity 0–1 */
  glowIntensity: number;
  /** Slight hue shift on dark base (220–240 range for deep navy) */
  baseHue: number;
}

export interface FormState {
  projectName: string;
  text: string;
  cta: string;
  activeSet: AssetSetKey;
  /** Selected spec keys when user has deselected individual sizes */
  selectedKeys: Set<string>;
}

export interface GeneratedAd {
  spec: AssetSpec;
  /** Preview canvas (scaled-down) */
  previewCanvas: HTMLCanvasElement;
}
