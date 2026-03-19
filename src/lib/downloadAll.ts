import type { AppState, Background } from '@/types';
import { PLATFORMS, ALL_CHANNELS } from './platforms';
import { renderAd } from './renderAd';

export type ProgressFn = (done: number, total: number) => void;

export async function downloadAll(
  state: AppState,
  bgs: Background[],
  onProgress?: ProgressFn,
): Promise<void> {
  const [{ default: html2canvas }, { default: JSZip }] = await Promise.all([
    import('html2canvas'),
    import('jszip'),
  ]);

  // Spaces → underscores in campaign name for safe filenames
  const campaign = state.campaign.trim().replace(/\s+/g, '_');
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const folderName = `${campaign}_${date}`;
  const zip = new JSZip();

  // Collect selected formats across all channels
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
  await document.fonts.ready;

  for (let i = 0; i < selected.length; i++) {
    const { platform, label, w, h, key } = selected[i];
    const format = PLATFORMS[platform as keyof typeof PLATFORMS].find(f => f.label === label)!;

    // Apply per-format overrides
    const overrideData = state.formatOverrides[key] || {};
    const effectiveState: AppState = {
      ...state,
      headline: overrideData.hl || state.headline,
      cta:      overrideData.cta || state.cta,
    };

    const html = renderAd(format, effectiveState, bgs);

    // Each element is appended directly to body, positioned just off the left
    // edge of the viewport — visible to html2canvas but not to the user
    const el = document.createElement('div');
    el.style.cssText = `position:fixed;top:0;left:-${w + 100}px;width:${w}px;height:${h}px;overflow:hidden;pointer-events:none;`;
    el.innerHTML = html;
    document.body.appendChild(el);

    try {
      // Re-await fonts and allow 200 ms for images/paint to settle
      await document.fonts.ready;
      await new Promise(r => setTimeout(r, 200));

      const canvas = await html2canvas(el, {
        scale:           1,
        useCORS:         true,
        allowTaint:      true,
        backgroundColor: null,
        width:           w,
        height:          h,
        logging:         false,
      });

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
      });

      const fileName = `${campaign}_${platform}_${label}.png`;
      zip.folder(folderName)!.file(fileName, blob);
    } finally {
      document.body.removeChild(el);
    }

    onProgress?.(i + 1, selected.length);
  }

  const content = await zip.generateAsync({ type: 'blob' });
  const a = document.createElement('a');
  a.download = `${folderName}.zip`;
  a.href = URL.createObjectURL(content);
  a.click();
  URL.revokeObjectURL(a.href);
}
