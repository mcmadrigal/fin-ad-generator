import { toPng } from 'html-to-image';
import type { AppState } from '@/types';
import { PLATFORMS, ALL_CHANNELS } from './platforms';

export type ProgressFn = (done: number, total: number) => void;

export async function downloadAll(
  state:       AppState,
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

  for (let i = 0; i < selected.length; i++) {
    const { platform, label, key, w, h } = selected[i];

    const el = document.querySelector(`[data-format-key="${key}"]`) as HTMLElement | null;
    if (!el) throw new Error(`Ad element not found for "${key}". Make sure the format is selected and visible in the grid.`);

    const dataUrl = await toPng(el, {
      width:        w,
      height:       h,
      pixelRatio:   1,
      skipFonts:    false,
      style: {
        width:           w + 'px',
        height:          h + 'px',
        overflow:        'hidden',
        transform:       'none',
        transformOrigin: 'top left',
      },
      canvasWidth:  w,
      canvasHeight: h,
    });

    // Convert data URL to Blob for zipping
    const blob     = await fetch(dataUrl).then(r => r.blob());
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
