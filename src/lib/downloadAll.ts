import type { AppState } from '@/types';
import { PLATFORMS, ALL_CHANNELS } from './platforms';

export type ProgressFn = (done: number, total: number) => void;

const CAPTURE_TIMEOUT_MS = 10_000;

async function captureWithFallback(el: HTMLElement, w: number, h: number): Promise<Blob> {
  const { captureElement } = await import('./captureElement');
  const { default: html2canvas } = await import('html2canvas');

  try {
    const blob = await Promise.race<Blob>([
      captureElement(el, w, h),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), CAPTURE_TIMEOUT_MS),
      ),
    ]);
    return blob;
  } catch {
    // SVG foreignObject timed out or failed — fall back to html2canvas
    const canvas = await html2canvas(el, {
      scale:           1,
      useCORS:         true,
      allowTaint:      true,
      backgroundColor: '#000',
      logging:         false,
      imageTimeout:    0,
      removeContainer: true,
    });
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        b => (b ? resolve(b) : reject(new Error('toBlob failed'))),
        'image/png',
      );
    });
  }
}

export async function downloadAll(
  state: AppState,
  onProgress?: ProgressFn,
): Promise<void> {
  const { default: JSZip } = await import('jszip');

  const campaign   = state.campaign.trim().replace(/\s+/g, '_');
  const date       = new Date().toISOString().split('T')[0];
  const folderName = `${campaign}_${date}`;
  const zip        = new JSZip();

  // Collect selected formats in channel order
  const selected: Array<{ platform: string; label: string; w: number; h: number; key: string }> = [];
  for (const platform of ALL_CHANNELS) {
    for (const f of PLATFORMS[platform]) {
      const key = f._platformKey || `${platform}_${f.label}`;
      if (state.selected.has(key)) {
        selected.push({ platform, label: f.label, w: f.w, h: f.h, key });
      }
    }
  }

  onProgress?.(0, selected.length);

  // Sequential — parallel large-canvas captures exhaust memory and stall
  for (let i = 0; i < selected.length; i++) {
    const { platform, label, w, h, key } = selected[i];

    const el = document.querySelector(`[data-format-key="${key}"]`) as HTMLElement | null;
    if (!el) throw new Error(`Ad element not found for "${key}". Make sure the format is selected and visible in the grid.`);

    const blob     = await captureWithFallback(el, w, h);
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
