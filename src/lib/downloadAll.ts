import type { AppState, Background } from '@/types';
import { PLATFORMS, ALL_CHANNELS } from './platforms';
import { renderAdHTML } from './renderAd';

export type ProgressFn = (done: number, total: number) => void;

export async function downloadAll(
  state:      AppState,
  bgs:        Background[],
  onProgress?: ProgressFn,
): Promise<void> {
  const { default: JSZip } = await import('jszip');

  const campaign   = state.campaign.trim().replace(/\s+/g, '_');
  const date       = new Date().toISOString().split('T')[0];
  const folderName = `${campaign}_${date}`;
  const zip        = new JSZip();

  // Collect selected formats in channel order
  const selected: Array<{ platform: string; label: string; key: string; w: number; h: number }> = [];
  for (const platform of ALL_CHANNELS) {
    for (const f of PLATFORMS[platform]) {
      const key = f._platformKey || `${platform}_${f.label}`;
      if (state.selected.has(key)) {
        selected.push({ platform, label: f.label, key, w: f.w, h: f.h });
      }
    }
  }

  onProgress?.(0, selected.length);

  // Sequential — parallel large captures exhaust memory
  for (let i = 0; i < selected.length; i++) {
    const { platform, label, key, w, h } = selected[i];

    // Apply per-format overrides
    const overrides = state.formatOverrides[key] || {};
    const effectiveState: AppState = {
      ...state,
      headline: overrides.hl  || state.headline,
      cta:      overrides.cta || state.cta,
    };

    // Find the FormatSpec so we can build the full HTML document
    const f = PLATFORMS[platform as keyof typeof PLATFORMS]
      .find(fmt => (fmt._platformKey || `${platform}_${fmt.label}`) === key)!;

    const html = await renderAdHTML(f, effectiveState, bgs);

    const res = await fetch('/api/capture', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ html, width: w, height: h }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.error('API error:', body);
      throw new Error(body.error || res.statusText || 'Unknown error');
    }

    const blob     = await res.blob();
    const fileName = `${campaign}_${platform}_${label}.png`;
    zip.folder(folderName)!.file(fileName, blob);

    onProgress?.(i + 1, selected.length);
  }

  const content = await zip.generateAsync({ type: 'blob' });
  const a       = document.createElement('a');
  a.download    = `${folderName}.zip`;
  a.href        = URL.createObjectURL(content);
  a.click();
  URL.revokeObjectURL(a.href);
}
